const mongoose = require('mongoose');

const DeletedPaymentSchema = new mongoose.Schema({
    originalPaymentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    mode: { type: String, required: true },
    billsAllocated: [{
        bill: { type: mongoose.Schema.Types.ObjectId, ref: 'Bill' },
        amount: Number
    }],
    deletedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DeletedPayment', DeletedPaymentSchema);
