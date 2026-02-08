import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PaymentHistoryScreen = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [suppliers, setSuppliers] = useState([]);

    // Filters
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterMode, setFilterMode] = useState('');

    const navigate = useNavigate();

    useEffect(() => {
        fetchSuppliers();
        fetchPayments();
    }, []);

    useEffect(() => {
        fetchPayments();
    }, [filterSupplier, filterDate, filterMode]);

    const fetchSuppliers = async () => {
        try { const res = await axios.get('http://localhost:5001/api/suppliers'); setSuppliers(res.data); } catch (e) { }
    };

    const fetchPayments = async () => {
        try {
            const params = {};
            if (filterSupplier) params.supplier = filterSupplier;
            if (filterDate) params.date = filterDate;
            if (filterMode) params.mode = filterMode;

            const res = await axios.get('http://localhost:5001/api/payments', { params });
            setPayments(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handleDelete = async (paymentId) => {
        if (!window.confirm('Are you sure you want to delete this payment record? This will revert the bill statuses.')) return;

        try {
            await axios.delete(`http://localhost:5001/api/payments/${paymentId}`);
            alert('Payment Deleted Successfully!');
            fetchPayments(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Delete failed: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleEdit = (payment) => {
        // Navigate to payment screen with edit mode - tricky because PaymentScreen is built for "New Payment".
        // To simplify for this artifact: We pass 'editPayment' in state to PaymentScreen
        // Does PaymentScreen handle it? We need to update PaymentScreen next.
        // We need to pass the supplier object too.
        navigate('/payment', { state: { supplier: payment.supplier, editPayment: payment } });
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: '1rem' }}>
                &larr; Back to Dashboard
            </button>
            <h1 style={{ marginBottom: '1rem' }}>Payment History</h1>

            {/* Filters */}
            <div className="card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', padding: '1rem' }}>
                <strong>Filter By:</strong>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} style={{ padding: '0.5rem' }}>
                    <option value="">All Suppliers</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ padding: '0.5rem' }} />
                <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ padding: '0.5rem' }}>
                    <option value="">All Modes</option>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                </select>
                <button className="btn btn-secondary" onClick={() => { setFilterSupplier(''); setFilterDate(''); setFilterMode(''); }}>Reset</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {payments.length === 0 ? <p>No payments match your filters.</p> : payments.map(payment => (
                    <div key={payment._id} className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem' }}>{payment.supplier?.name || 'Unknown Supplier'}</h2>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    {new Date(payment.date).toLocaleDateString()} &bull; {payment.mode}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--success)' }}>
                                    ${payment.amount.toLocaleString()}
                                </div>
                                <button
                                    onClick={() => handleEdit(payment)}
                                    style={{
                                        background: 'none', border: 'none', color: 'var(--primary)',
                                        cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline', marginTop: '0.2rem'
                                    }}
                                >
                                    Edit Transaction
                                </button>
                                <button
                                    onClick={() => handleDelete(payment._id)}
                                    style={{
                                        background: 'none', border: 'none', color: '#ef4444',
                                        cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline', marginTop: '0.2rem', marginLeft: '1rem'
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Allocated to: {payment.billsAllocated.map(a => a.bill?.billNumber).join(', ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PaymentHistoryScreen;
