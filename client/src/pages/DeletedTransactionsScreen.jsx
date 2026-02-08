import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const DeletedTransactionsScreen = () => {
    const [deletedPayments, setDeletedPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDeletedPayments();
    }, []);

    const fetchDeletedPayments = async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/deleted-payments');
            setDeletedPayments(res.data);
        } catch (err) {
            console.error(err);
            alert('Failed to fetch deleted transactions');
        }
        setLoading(false);
    };

    const handleRestore = async (payment) => {
        if (!window.confirm('Are you sure you want to restore this payment?')) return;

        setProcessingId(payment._id);
        try {
            await axios.post(`http://localhost:5001/api/deleted-payments/${payment._id}/restore`);
            alert('Payment Restored Successfully!');
            fetchDeletedPayments(); // Refresh list
        } catch (err) {
            console.error(err);
            alert('Restore Failed: ' + (err.response?.data?.message || err.message));
        }
        setProcessingId(null);
    };

    if (loading) return <div className="container">Loading...</div>;

    return (
        <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1>Deleted Transactions</h1>
                <button className="btn btn-secondary" onClick={() => navigate('/history')}>
                    Back to History
                </button>
            </div>

            {deletedPayments.length === 0 ? (
                <div className="card">No deleted transactions found.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {deletedPayments.map(payment => (
                        <div key={payment._id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{payment.supplier?.name || 'Unknown Supplier'}</h3>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    Deleted on: {new Date(payment.deletedAt).toLocaleString()}
                                </div>
                                <div style={{ marginTop: '0.5rem' }}>
                                    <strong>Amount: ${payment.amount.toLocaleString()}</strong>
                                    <span style={{ margin: '0 0.5rem' }}>•</span>
                                    <span>{payment.mode}</span>
                                    <span style={{ margin: '0 0.5rem' }}>•</span>
                                    <span>Original Date: {new Date(payment.date).toLocaleDateString()}</span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                                    Bills: {payment.billsAllocated.map(b => b.bill?.billNumber || 'Unknown').join(', ')}
                                </div>
                            </div>
                            <button
                                className="btn"
                                style={{ backgroundColor: '#2563eb', color: 'white', border: 'none' }}
                                onClick={() => handleRestore(payment)}
                                disabled={processingId === payment._id}
                            >
                                {processingId === payment._id ? 'Restoring...' : 'Restore'}
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DeletedTransactionsScreen;
