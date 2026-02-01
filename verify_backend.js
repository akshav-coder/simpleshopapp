
const axios = require('axios');

const API_URL = 'http://localhost:5001/api';

async function verify() {
    try {
        // 1. Fetch Suppliers
        console.log('Fetching suppliers...');
        const suppliersRes = await axios.get(`${API_URL}/suppliers`);
        const supplier = suppliersRes.data[0];

        if (!supplier) {
            console.error('No suppliers found!');
            return;
        }

        console.log(`Found supplier: ${supplier.name} (${supplier._id})`);

        const bill = supplier.bills.find(b => b.status !== 'Paid');
        if (!bill) {
            console.error('No unpaid bills found for this supplier');
            return;
        }
        console.log(`Found unpaid bill: ${bill.billNumber} (${bill._id}), Amount: ${bill.amount}, Paid: ${bill.paidAmount}`);

        // 2. Prepare Payment Payload
        // Amount 5000. Manual allocation 1000 to this bill.
        // The specific logic we built: selectedBillAllocations is { billId: amount }
        const paymentPayload = {
            supplierId: supplier._id,
            amount: 5000,
            date: new Date().toISOString(),
            mode: 'Cash',
            selectedBillAllocations: {
                [bill._id]: 1000
            }
        };

        // 3. Post Payment
        console.log('Sending payment request with manual allocation...');
        const payRes = await axios.post(`${API_URL}/pay/allocate`, paymentPayload);

        console.log('Payment Response:', JSON.stringify(payRes.data, null, 2));

        // 4. Verify Allocation
        // The response should show the bill allocated 1000 manually + potential auto allocation if 5000 > 1000 (which it is).
        // Wait, if we manually allocate 1000, the remaining 4000 should be auto-allocated to oldest bills.
        // We should check if our specific bill got at least 1000.

        const allocatedBill = payRes.data.payment.allocatedBills.find(b => b.billId === bill._id);
        if (allocatedBill) {
            console.log(`Target Bill Allocated Amount: ${allocatedBill.amount}`);
            if (allocatedBill.amount >= 1000) {
                console.log('SUCCESS: Manual allocation verified.');
            } else {
                console.error('FAILURE: Allocated amount is less than manual request.');
            }
        } else {
            console.error('FAILURE: Target bill was not allocated any amount.');
        }

    } catch (error) {
        console.error('Error during verification:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

verify();
