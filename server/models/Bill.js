const mongoose = require('mongoose');

const BillSchema = new mongoose.Schema({
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    date: { type: Date, default: Date.now },
    status: { type: String, enum: ['Credit', 'Paid', 'Partially Paid'], default: 'Credit' },
    billNumber: { type: String, required: true }
});

module.exports = mongoose.model('Bill', BillSchema);
