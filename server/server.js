const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/simpleshop';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
const Supplier = require('./models/Supplier');
const Bill = require('./models/Bill');
const Payment = require('./models/Payment');

// GET all suppliers with their bills
app.get('/api/suppliers', async (req, res) => {
    try {
        const suppliers = await Supplier.find().lean();

        const suppliersWithBills = await Promise.all(suppliers.map(async (supplier) => {
            const bills = await Bill.find({ supplier: supplier._id }).sort({ date: 1 });
            const totalCredit = bills.reduce((sum, b) => sum + (b.amount - (b.paidAmount || 0)), 0);
            return { ...supplier, bills, totalCredit };
        }));

        res.json(suppliersWithBills);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET Statement (Merged Ledger)
app.get('/api/suppliers/:id/statement', async (req, res) => {
    try {
        const { id } = req.params;
        const supplier = await Supplier.findById(id).lean();
        if (!supplier) return res.status(404).json({ message: 'Supplier not found' });

        const bills = await Bill.find({ supplier: id }).lean();
        const payments = await Payment.find({ supplier: id }).lean();

        // Standardize structure
        const ledger = [
            ...bills.map(b => ({ type: 'Bill', date: b.date, amount: b.amount, ref: b.billNumber, id: b._id, status: b.status })),
            ...payments.map(p => ({ type: 'Payment', date: p.date, amount: p.amount, ref: p.mode, id: p._id }))
        ].sort((a, b) => new Date(a.date) - new Date(b.date));

        res.json({ supplier, ledger });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET all payments with Filters
app.get('/api/payments', async (req, res) => {
    try {
        const { supplier, mode, date } = req.query;
        let query = {};

        if (supplier) query.supplier = supplier;
        if (mode) query.mode = mode;
        if (date) {
            // Match exactly that day
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            query.date = { $gte: start, $lt: end };
        }

        const payments = await Payment.find(query)
            .populate('supplier')
            .populate('billsAllocated.bill')
            .sort({ date: -1 });
        res.json(payments);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Helper to allocate payment
const allocatePayment = async (supplierId, amount, selectedBillAllocations, dbDate) => {
    let paymentAmount = Number(amount);
    let allocatedBillsInfo = [];

    // STRATEGY 1: EXPLICIT MANUAL ALLOCATION (id + specific amount)
    if (selectedBillAllocations && selectedBillAllocations.length > 0) {
        for (const alloc of selectedBillAllocations) {
            if (paymentAmount <= 0) break;

            const bill = await Bill.findById(alloc.billId);
            if (bill) {
                // If user specifies amount, use it (capped by what they sent vs bill due)
                let amountToPay = 0;

                if (alloc.manualAmount !== undefined && alloc.manualAmount !== null) {
                    amountToPay = Number(alloc.manualAmount);
                } else {
                    // Fallback to "pay whole bill if possible" if they just selected checkbox without manual input
                    amountToPay = bill.amount - (bill.paidAmount || 0);
                }

                // Safety: Can't pay more than Total Payment available
                amountToPay = Math.min(amountToPay, paymentAmount);
                // Safety: Can't pay more than Bill Due (unless overpayment logic exists, assume no)
                const remainingDue = bill.amount - (bill.paidAmount || 0);
                amountToPay = Math.min(amountToPay, remainingDue);

                if (amountToPay > 0) {
                    bill.paidAmount = (bill.paidAmount || 0) + amountToPay;
                    bill.status = bill.paidAmount >= bill.amount - 0.01 ? 'Paid' : 'Partially Paid'; // tolerance
                    await bill.save();

                    paymentAmount -= amountToPay;
                    allocatedBillsInfo.push({ bill: bill._id, amount: amountToPay });
                }
            }
        }
    }

    // STRATEGY 2: AUTO ALLOCATION (If remaining amount > 0)
    if (paymentAmount > 0.01) {
        const bills = await Bill.find({
            supplier: supplierId,
            status: { $ne: 'Paid' },
            _id: { $nin: allocatedBillsInfo.map(a => a.bill) }
        }).sort({ date: 1 });

        for (const bill of bills) {
            if (paymentAmount <= 0.01) break;

            const remainingDue = bill.amount - (bill.paidAmount || 0);
            const allocation = Math.min(paymentAmount, remainingDue);

            bill.paidAmount = (bill.paidAmount || 0) + allocation;
            bill.status = bill.paidAmount >= bill.amount - 0.01 ? 'Paid' : 'Partially Paid';
            await bill.save();

            paymentAmount -= allocation;
            allocatedBillsInfo.push({ bill: bill._id, amount: allocation });
        }
    }

    return allocatedBillsInfo;
};

// CREATE Payment
app.post('/api/pay/allocate', async (req, res) => {
    const { supplierId, amount, date, mode, selectedBillAllocations } = req.body;
    // selectedBillAllocations expected format: [{ billId: '...', manualAmount: 500 }, { billId: '...' }]

    if (!supplierId || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid payment data' });
    }

    try {
        const allocatedBillsInfo = await allocatePayment(
            supplierId,
            amount,
            selectedBillAllocations,
            date
        );

        const payment = new Payment({
            supplier: supplierId,
            amount: Number(amount),
            date: date || new Date(),
            mode: mode || 'Other',
            billsAllocated: allocatedBillsInfo
        });
        await payment.save();

        res.json({ message: 'Payment recorded successfully', payment });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// EDIT Payment
app.put('/api/payments/:id', async (req, res) => {
    const { id } = req.params;
    const { amount, date, mode, selectedBillAllocations } = req.body; // New details

    try {
        const payment = await Payment.findById(id);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        // 1. REVERT old allocation
        for (const alloc of payment.billsAllocated) {
            const bill = await Bill.findById(alloc.bill);
            if (bill) {
                bill.paidAmount = Math.max(0, (bill.paidAmount || 0) - alloc.amount);
                // Re-evaluate status
                bill.status = bill.paidAmount >= bill.amount - 0.01 ? 'Paid' : (bill.paidAmount > 0 ? 'Partially Paid' : 'Credit');
                await bill.save();
            }
        }

        // 2. APPLY new allocation
        // Use the helper, but note helper updates DB directly.
        // We pass the supplier ID from the existing payment reference
        // And the NEW metadata.

        const allocatedBillsInfo = await allocatePayment(
            payment.supplier,
            amount,
            selectedBillAllocations,
            date
        );

        // 3. UPDATE Payment Record
        payment.amount = amount;
        payment.date = date;
        payment.mode = mode;
        payment.billsAllocated = allocatedBillsInfo;
        await payment.save();

        res.json({ message: 'Payment updated successfully', payment });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE Payment
app.delete('/api/payments/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const payment = await Payment.findById(id);
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        // REVERT allocation
        for (const alloc of payment.billsAllocated) {
            const bill = await Bill.findById(alloc.bill);
            if (bill) {
                bill.paidAmount = Math.max(0, (bill.paidAmount || 0) - alloc.amount);
                // Re-evaluate status
                bill.status = bill.paidAmount >= bill.amount - 0.01 ? 'Paid' : (bill.paidAmount > 0 ? 'Partially Paid' : 'Credit');
                await bill.save();
            }
        }

        await Payment.findByIdAndDelete(id);
        res.json({ message: 'Payment deleted successfully' });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    })
    .catch(err => console.error(err));
