
const axios = require('axios');
const API_URL = 'http://localhost:5001/api';

async function verifyFlow() {
    try {
        console.log('--- 1. Create a fresh payment ---');
        // Fetch a supplier and unpaid bill
        const suppliers = await axios.get(`${API_URL}/suppliers`);
        const supplier = suppliers.data[0];
        const bill = supplier.bills.find(b => b.status !== 'Paid');

        if (!bill) { console.log('No unpaid bills found. Skipping.'); return; }

        const payRes = await axios.post(`${API_URL}/pay/allocate`, {
            supplierId: supplier._id,
            amount: 1000,
            date: new Date(),
            mode: 'Cash', // Fixed: Valid enum
            selectedBillAllocations: [{ billId: bill._id, manualAmount: 1000 }]
        });
        const paymentId = payRes.data.payment._id;
        console.log(`Created payment ${paymentId} for bill ${bill.billNumber} (amount 1000)`);

        console.log('--- 2. Delete the payment ---');
        await axios.delete(`${API_URL}/payments/${paymentId}`);
        console.log('Payment deleted.');

        // Verify it's in archive
        const deletedRes = await axios.get(`${API_URL}/deleted-payments`);
        const archived = deletedRes.data.find(d => d.originalPaymentId === paymentId);
        if (archived) console.log('Verified: Payment found in archive.');
        else console.error('ERROR: Payment NOT found in archive.');

        // Verify bill reverted
        const suppliersAfter = await axios.get(`${API_URL}/suppliers`);
        const billAfter = suppliersAfter.data[0].bills.find(b => b._id === bill._id);
        console.log(`Bill Status after delete: ${billAfter.status}, Paid: ${billAfter.paidAmount}`);

        console.log('--- 3. Restore the payment ---');
        await axios.post(`${API_URL}/deleted-payments/${archived._id}/restore`);
        console.log('Payment restored.');

        // Verify archive gone
        const deletedResAfter = await axios.get(`${API_URL}/deleted-payments`);
        const archivedAfter = deletedResAfter.data.find(d => d._id === archived._id);
        if (!archivedAfter) console.log('Verified: Archive record removed.');
        else console.error('ERROR: Archive record still exists.');

        // Verify bill paid again
        const suppliersFinal = await axios.get(`${API_URL}/suppliers`);
        const billFinal = suppliersFinal.data[0].bills.find(b => b._id === bill._id);
        console.log(`Bill Status after restore: ${billFinal.status}, Paid: ${billFinal.paidAmount}`);


        console.log('--- 4. Verify Validation Failure (Balance Changed) ---');
        // 4a. Create another payment
        const payRes2 = await axios.post(`${API_URL}/pay/allocate`, {
            supplierId: supplier._id,
            amount: 500,
            date: new Date(),
            mode: 'Cash',
            selectedBillAllocations: [{ billId: bill._id, manualAmount: 500 }]
        });
        const paymentId2 = payRes2.data.payment._id;
        console.log(`Created payment 2 ${paymentId2} for 500.`);

        // 4b. Delete it
        await axios.delete(`${API_URL}/payments/${paymentId2}`);
        console.log('Payment 2 deleted.');

        // 4c. Pay the bill FULLY closely with another transaction so balance < 500
        const currentBill = (await axios.get(`${API_URL}/suppliers`)).data[0].bills.find(b => b._id === bill._id);
        const amountToPayFully = (currentBill.amount - (currentBill.paidAmount || 0));

        // Let's pay nearly all of it so 500 can't fit
        // If remaining is 1000, paying 600 leaves 400. Restore 500 should fail.
        if (amountToPayFully > 500) {
            await axios.post(`${API_URL}/pay/allocate`, {
                supplierId: supplier._id,
                amount: amountToPayFully - 100, // Leave only 100
                date: new Date(),
                mode: 'Cash', // Use valid mode
                selectedBillAllocations: [{ billId: bill._id, manualAmount: amountToPayFully - 100 }]
            });
            console.log('Interfering payment made. Bill balance should be low.');
        }

        // 4d. Try Restore Payment 2
        const deletedRes2 = await axios.get(`${API_URL}/deleted-payments`);
        const archived2 = deletedRes2.data.find(d => d.originalPaymentId === paymentId2);

        try {
            await axios.post(`${API_URL}/deleted-payments/${archived2._id}/restore`);
            console.error('ERROR: Restore SHOULD have failed but succeeded.');
        } catch (e) {
            console.log('Verified: Restore failed as expected with message:', e.response?.data?.message);
        }

    } catch (e) {
        console.error('Test Failed:', e.message);
        if (e.response) console.error(e.response.data);
    }
}

verifyFlow();
