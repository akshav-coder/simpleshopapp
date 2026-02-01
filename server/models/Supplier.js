const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: String,
  phone: String,
});

module.exports = mongoose.model('Supplier', SupplierSchema);
