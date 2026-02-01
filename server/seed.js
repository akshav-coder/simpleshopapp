require('dotenv').config();
const mongoose = require('mongoose');
const Supplier = require('./models/Supplier');
const Bill = require('./models/Bill');
const Payment = require('./models/Payment');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/simpleshop';

const seedData = async () => {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await Payment.deleteMany({});
        await Bill.deleteMany({});
        await Supplier.deleteMany({});
        console.log('Cleared existing data');

        const suppliers = [];
        for (let i = 1; i <= 10; i++) {
            suppliers.push({
                name: `Supplier ${i}`,
                email: `supplier${i}@example.com`,
                phone: `555-010${i}`
            });
        }

        const createdSuppliers = await Supplier.insertMany(suppliers);
        console.log(`Created ${createdSuppliers.length} suppliers`);

        const bills = [];
        for (const supplier of createdSuppliers) {
            for (let j = 1; j <= 10; j++) {
                // Amount between 10,001 and 50,000
                const amount = Math.floor(Math.random() * 40000) + 10001;
                bills.push({
                    supplier: supplier._id,
                    amount: amount,
                    paidAmount: 0,
                    status: 'Credit',
                    billNumber: `BILL-${supplier.name.split(' ')[1]}-${j}`,
                    date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)) // Random date in past
                });
            }
        }

        const createdBills = await Bill.insertMany(bills);
        console.log(`Created ${createdBills.length} bills`);

        // --- CREATE SAMPLE PAYMENTS ---
        console.log('Generating sample payments...');
        // Pay fully for the first bill of the first 3 suppliers
        for (let i = 0; i < 3; i++) {
            const supplier = createdSuppliers[i];
            const supplierBills = createdBills.filter(b => b.supplier.toString() === supplier._id.toString());

            if (supplierBills.length > 0) {
                const billToPay = supplierBills[0];
                const amount = billToPay.amount;

                // Create Payment
                const payment = new Payment({
                    supplier: supplier._id,
                    amount: amount,
                    date: new Date(),
                    mode: 'Bank Transfer',
                    billsAllocated: [{ bill: billToPay._id, amount: amount }]
                });
                await payment.save();

                // Update Bill
                billToPay.paidAmount = amount;
                billToPay.status = 'Paid';
                await billToPay.save();
            }
        }

        // Partial payment for Supplier 4
        const s4 = createdSuppliers[3];
        const s4Bills = createdBills.filter(b => b.supplier.toString() === s4._id.toString());
        if (s4Bills.length > 0) {
            const bill = s4Bills[0];
            const partialAmount = 5000;

            const payment = new Payment({
                supplier: s4._id,
                amount: partialAmount,
                date: new Date(),
                mode: 'Cash',
                billsAllocated: [{ bill: bill._id, amount: partialAmount }]
            });
            await payment.save();

            bill.paidAmount = partialAmount;
            bill.status = 'Partially Paid';
            await bill.save();
        }

        console.log('Sample payments created');
        console.log('Seeding complete');
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedData();
