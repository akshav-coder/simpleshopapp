const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    mode: { type: String, enum: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'], required: true },
    billsAllocated: [{ // Keep track of which bills were paid
        bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
        amount: Number
    }]
});

module.exports = mongoose.model('Payment', PaymentSchema);
