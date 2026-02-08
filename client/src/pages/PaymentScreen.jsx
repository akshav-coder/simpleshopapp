import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const PaymentScreen = () => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const supplier = state?.supplier;
    const editPayment = state?.editPayment; // If editing

    // Form State
    const [amountToPay, setAmountToPay] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMode, setPaymentMode] = useState('Cash');
    const [processing, setProcessing] = useState(false);

    // Bill Selections: { billId: manualAmount (string) }
    // If key exists, it means "checked". If value is '', it means "auto/full".
    const [selectedAllocations, setSelectedAllocations] = useState({});

    // Supplier Data Fetching
    const [fullSupplier, setFullSupplier] = useState(supplier);
    const [loadingSupplier, setLoadingSupplier] = useState(false);

    // Fetch full supplier details if bills are missing
    useEffect(() => {
        const fetchDetails = async () => {
            if (supplier && !supplier.bills) {
                setLoadingSupplier(true);
                try {
                    const res = await axios.get('http://localhost:5001/api/suppliers');
                    const found = res.data.find(s => s._id === supplier._id);
                    if (found) setFullSupplier(found);
                } catch (e) {
                    console.error(e);
                    alert("Failed to load supplier details");
                }
                setLoadingSupplier(false);
            }
        };
        fetchDetails();
    }, [supplier]);

    const unpaidBills = useMemo(() => {
        if (!fullSupplier?.bills) return [];
        // If editing, we MUST include bills that were allocated in the current editPayment, 
        // even if their *current* status on the supplier object is 'Paid'.
        // Why? Because we might want to un-allocate them or change the amount.
        const currentAllocatedBillIds = editPayment?.billsAllocated?.map(a => {
            if (!a.bill) return null; // Handle missing bill ref
            const raw = typeof a.bill === 'object' ? a.bill._id : a.bill;
            return raw.toString();
        }).filter(id => id) || []; // Filter out nulls

        return fullSupplier.bills.filter(b => b.status !== 'Paid' || currentAllocatedBillIds.includes(b._id));
    }, [fullSupplier, editPayment]);

    // Pre-fill if editing
    useEffect(() => {
        if (editPayment) {
            setAmountToPay(editPayment.amount.toString());
            setPaymentDate(new Date(editPayment.date).toISOString().split('T')[0]);
            setPaymentMode(editPayment.mode);

            // Pre-fill allocated bills
            if (editPayment.billsAllocated && editPayment.billsAllocated.length > 0) {
                const initialAlloc = {};
                editPayment.billsAllocated.forEach(alloc => {
                    // Handle both populated bill object or just ID
                    if (!alloc.bill) return;
                    const rawId = typeof alloc.bill === 'object' ? alloc.bill._id : alloc.bill;
                    const billId = rawId.toString();
                    initialAlloc[billId] = alloc.amount.toString();
                });
                setSelectedAllocations(initialAlloc);
            }
        }
    }, [editPayment]);

    // Update total amount when manual allocations change
    useEffect(() => {
        const ids = Object.keys(selectedAllocations);
        if (ids.length > 0 && !editPayment) { // Only auto-sum if NOT editing (or strictly manual user action, but simpler to just avoid overwrite on load)
            // Actually, we want to update amount if user changes allocations. 
            // But on initial load of editPayment, we are setting both amount and allocations.
            // The order of effects matters. 
            // Better strategy: Only update amount if the user MANUALLY triggers a change.
            // For now, let's leave the logic but maybe guard it? 
            // If we set allocations first, this effect fires and sets amount. Use the editPayment amount instead.
        }

        // Revised logic: only sum up if we simply have allocations. 
        // If we are editing, the amount is already set. 
        // But if the user changes an allocation, we might want to update the total?
        // Let's keep existing logic but be careful.

        if (ids.length > 0) {
            const sum = ids.reduce((acc, id) => {
                const manual = selectedAllocations[id];
                if (manual) return acc + Number(manual);

                const bill = unpaidBills.find(b => b._id === id);
                return acc + (bill ? (bill.amount - (bill.paidAmount || 0)) : 0);
            }, 0);

            // Only update if sum is different and it's not the initial edit load. 
            // To simplify: The user can adjust the total amount manually effectively. 
            // If they click checkboxes, it sums up.
            if (sum > 0) setAmountToPay(sum.toString());
        }
    }, [selectedAllocations, unpaidBills]); // added unpaidBills dependency

    // --- PROJECTION LOGIC ---
    const projectedAllocation = useMemo(() => {
        if (!amountToPay || Number(amountToPay) <= 0 || !fullSupplier) return [];

        let remainingMoney = Number(amountToPay);
        const projection = [];
        const manualIds = Object.keys(selectedAllocations);

        // 1. Manual/Checked Allocations
        if (manualIds.length > 0) {
            for (const id of manualIds) {
                if (remainingMoney <= 0) break;
                const bill = unpaidBills.find(b => b._id === id);
                if (!bill) continue;

                const due = bill.amount - (bill.paidAmount || 0);
                const manualVal = selectedAllocations[id];

                let alloc = 0;
                if (manualVal) {
                    alloc = Math.min(Number(manualVal), remainingMoney, due);
                } else {
                    alloc = Math.min(due, remainingMoney);
                }

                if (alloc > 0) {
                    projection.push({
                        billId: bill._id, // Added ID for easier lookup
                        billNumber: bill.billNumber,
                        amount: alloc,
                        status: alloc >= due - 0.01 ? 'Paid' : 'Partially Paid'
                    });
                    remainingMoney -= alloc;
                }
            }
        }

        // 2. Auto Sequential Allocation (for remaining money)
        if (remainingMoney > 0.01) {
            // Filter out bills already touched or paid
            const touchedIds = projection.map(p => p.billId);
            const candidates = unpaidBills
                .filter(b => !touchedIds.includes(b._id))
                .sort((a, b) => new Date(a.date) - new Date(b.date)); // Oldest first

            for (const bill of candidates) {
                if (remainingMoney <= 0.01) break;

                const due = bill.amount - (bill.paidAmount || 0);
                const alloc = Math.min(due, remainingMoney);

                projection.push({
                    billId: bill._id,
                    billNumber: bill.billNumber,
                    amount: alloc,
                    status: alloc >= due - 0.01 ? 'Paid' : 'Partially Paid'
                });
                remainingMoney -= alloc;
            }
        }

        return projection;
    }, [amountToPay, selectedAllocations, fullSupplier, unpaidBills]);


    if (!supplier) return <div className="container">No supplier selected</div>;
    if (loadingSupplier || !fullSupplier) return <div className="container">Loading...</div>;

    // toggleBill removed as we use direct input now

    const handleManualAmountChange = (id, val) => {
        const newAlloc = { ...selectedAllocations };
        newAlloc[id] = val;
        setSelectedAllocations(newAlloc);
    };

    const handlePayment = async () => {
        if (!amountToPay || isNaN(amountToPay) || Number(amountToPay) <= 0) {
            alert('Please enter a valid amount');
            return;
        }
        setProcessing(true);
        try {
            const allocationPayload = Object.keys(selectedAllocations).map(billId => ({
                billId,
                manualAmount: selectedAllocations[billId] ? Number(selectedAllocations[billId]) : null
            }));

            const payload = {
                supplierId: fullSupplier._id,
                amount: Number(amountToPay),
                date: paymentDate,
                mode: paymentMode,
                selectedBillAllocations: allocationPayload
            };

            if (editPayment) {
                await axios.put(`http://localhost:5001/api/payments/${editPayment._id}`, payload);
                alert('Payment Updated Successfully!');
                navigate('/history');
            } else {
                await axios.post('http://localhost:5001/api/pay/allocate', payload);
                alert('Payment Recorded Successfully!');
                navigate('/');
            }
        } catch (err) {
            console.error(err);
            alert('Payment failed: ' + (err.response?.data?.message || err.message));
            setProcessing(false);
        }
    };

    // Delete logic moved to History Screen

    return (
        <div className="container">
            <button className="btn btn-secondary" onClick={() => navigate(editPayment ? '/history' : '/')} style={{ marginBottom: '1rem' }}>
                &larr; Back
            </button>

            <div className="card" style={{ borderLeft: editPayment ? '5px solid orange' : '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1>{fullSupplier.name}</h1>
                        <p style={{ color: 'var(--text-muted)' }}>{fullSupplier.email}</p>
                        {editPayment && <span style={{ background: 'orange', color: 'white', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>EDITING TRANSACTION</span>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary" onClick={() => navigate(`/statement/${fullSupplier._id}`)}>
                            View Statement of Account
                        </button>
                    </div>
                </div>

                {/* SUMMARY SECTION */}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '2rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Balance Due</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#dc2626' }}>
                            ${fullSupplier.bills?.reduce((acc, b) => acc + (b.amount - (b.paidAmount || 0)), 0).toLocaleString()}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#666' }}>Amount to be Paid</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#16a34a' }}>
                            ${Number(amountToPay || 0).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem' }}>
                {/* Left Column: Bills */}
                <div style={{ flex: 2 }}>
                    <h3 style={{ marginBottom: '1rem' }}>Allocate to Bills (Optional)</h3>
                    {unpaidBills.length === 0 ? <p>No unpaid bills available.</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {unpaidBills.map(bill => {
                                const due = bill.amount - (bill.paidAmount || 0);
                                const isManual = selectedAllocations[bill._id] !== undefined;
                                const manualVal = selectedAllocations[bill._id];

                                // Find projection for this bill
                                const projection = projectedAllocation.find(p => p.billId === bill._id);
                                const displayedAlloc = isManual ? manualVal : (projection ? projection.amount : '');

                                return (
                                    <div key={bill._id} className="card"
                                        style={{
                                            padding: '0.75rem', margin: 0,
                                            display: 'flex', alignItems: 'center', gap: '1rem',
                                            border: isManual ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                            backgroundColor: (projection && projection.amount > 0) ? '#f0fdf4' : 'white'
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <strong>{bill.billNumber}</strong>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(bill.date).toLocaleDateString()}</div>
                                        </div>

                                        <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                            <div style={{ fontWeight: 'bold' }}>${due.toLocaleString()}</div>
                                            <div style={{ fontSize: '0.7rem', color: '#666' }}>Due</div>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <label style={{ fontSize: '0.7rem', color: '#666', marginBottom: '2px' }}>Allocation</label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={displayedAlloc}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    // If empty, remove manual key (dynamic mode)
                                                    // OR keep it as 0 if user explicitly typed 0
                                                    handleManualAmountChange(bill._id, val);
                                                }}
                                                className="input-field"
                                                style={{
                                                    width: '100px',
                                                    padding: '0.25rem',
                                                    border: isManual ? '1px solid var(--primary)' : '1px solid #ccc',
                                                    textAlign: 'right',
                                                    fontWeight: (projection && projection.amount > 0) ? 'bold' : 'normal',
                                                    color: (projection && projection.amount > 0) ? '#166534' : 'black'
                                                }}
                                            />
                                            {projection && projection.status === 'Paid' && (
                                                <span style={{ fontSize: '0.65rem', color: '#166534', fontWeight: 'bold' }}>Fully Paid</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Column: Payment Form & Visualizations */}
                <div style={{ flex: 1 }}>
                    <div className="card" style={{ position: 'sticky', top: '1rem' }}>
                        <h3>{editPayment ? 'Update Details' : 'Payment Details'}</h3>

                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Total Amount</label>
                            <input
                                type="number"
                                value={amountToPay}
                                onChange={(e) => setAmountToPay(e.target.value)}
                                className="input-field"
                                style={{ width: '100%', padding: '0.6rem' }}
                            />
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Payment Date</label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem' }}
                            />
                        </div>

                        <div style={{ margin: '1rem 0' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Mode</label>
                            <select
                                value={paymentMode}
                                onChange={(e) => setPaymentMode(e.target.value)}
                                style={{ width: '100%', padding: '0.6rem' }}
                            >
                                <option value="Cash">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="Cheque">Cheque</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        {/* HISTORY (PREVIOUS ALLOCATION) for reference */}
                        {editPayment && editPayment.billsAllocated && (
                            <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#c2410c' }}>Previously Allocated</h4>
                                <ul style={{ paddingLeft: '1.2rem', margin: 0, fontSize: '0.85rem' }}>
                                    {editPayment.billsAllocated.map((alloc, idx) => (
                                        <li key={idx} style={{ marginBottom: '0.25rem' }}>
                                            <strong>{alloc.bill?.billNumber || 'Unknown Bill'}</strong>: ${alloc.amount.toLocaleString()}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <div style={{ marginTop: '1.5rem' }}>
                            <button
                                className="btn"
                                style={{ width: '100%' }}
                                disabled={!amountToPay || processing}
                                onClick={handlePayment}
                            >
                                {processing ? 'Processing...' : (editPayment ? 'Update Transaction' : 'Record Payment')}
                            </button>


                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentScreen;
