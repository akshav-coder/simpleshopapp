
const axios = require('axios');
const API_URL = 'http://localhost:5001/api';

async function verifyDelete() {
    try {
        console.log('1. Fetching Payments to find a candidate to delete...');
        const paymentsRes = await axios.get(`${API_URL}/payments`);
        const paymentToDelete = paymentsRes.data[0];

        if (!paymentToDelete) {
            console.log('No payments found to delete. Skipping.');
            return;
        }

        console.log(`Found payment ${paymentToDelete._id} for amount ${paymentToDelete.amount}`);
        const billAllocated = paymentToDelete.billsAllocated[0];

        if (billAllocated) {
            console.log(`It paid bill ${billAllocated.bill.billNumber} with amount ${billAllocated.amount}`);
        }

        console.log('2. Deleting Payment...');
        await axios.delete(`${API_URL}/payments/${paymentToDelete._id}`);
        console.log('Payment Deleted.');

        console.log('3. Verifying Reversion...');
        if (billAllocated) {
            const suppliersRes = await axios.get(`${API_URL}/suppliers`);
            const supplier = suppliersRes.data.find(s => s._id === paymentToDelete.supplier._id);
            const bill = supplier.bills.find(b => b._id === billAllocated.bill._id);

            console.log(`Bill ${bill.billNumber} status is now: ${bill.status}`);
            console.log(`Bill Paid Amount is now: ${bill.paidAmount}`);

            if (bill.status !== 'Paid') {
                console.log('SUCCESS: Bill status reverted (not Paid).');
            } else {
                console.log('WARNING: Bill is still Paid (maybe it was fully paid before? or reversion failed?)');
            }
        }

    } catch (e) {
        console.error('Error verifying delete:', e.message);
    }
}

verifyDelete();
