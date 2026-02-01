import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const PurchaseScreen = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await axios.get('http://localhost:5001/api/suppliers');
            setSuppliers(res.data);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    const handlePayClick = (supplier) => {
        navigate('/payment', { state: { supplier } });
    };

    if (loading) return <div className="container" style={{ textAlign: 'center' }}>Loading...</div>;

    const totalLiability = suppliers.reduce((acc, s) => acc + s.totalCredit, 0);

    return (
        <div className="container">
            <header className="header">
                <div>
                    <h1>Simple Shop</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Supplier Management</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h3>Total Liability: <span className="status-credit">${totalLiability.toLocaleString()}</span></h3>
                    <button className="btn btn-secondary" onClick={() => navigate('/history')} style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                        View Payment History
                    </button>
                </div>
            </header>

            <div className="grid">
                {suppliers.map((supplier) => {
                    // Filter unpaid bills for display
                    const unpaidBills = supplier.bills.filter(b => b.status !== 'Paid');

                    return (
                        <div key={supplier._id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <div>
                                    <h2>{supplier.name}</h2>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{supplier.phone}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Due Amount</div>
                                    <div className={supplier.totalCredit > 0 ? 'status-credit' : 'status-paid'} style={{ fontWeight: 'bold' }}>
                                        ${supplier.totalCredit.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '1rem' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Recent Unpaid Bills:</p>
                                {unpaidBills.slice(0, 3).map(bill => (
                                    <div key={bill._id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                                        <span>{bill.billNumber}</span>
                                        <span style={{ color: bill.status === 'Credit' ? 'var(--error)' : 'orange' }}>
                                            ${(bill.amount - (bill.paidAmount || 0)).toLocaleString()}
                                        </span>
                                    </div>
                                ))}
                                {unpaidBills.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--success)' }}>All bills paid.</p>}
                                {unpaidBills.length > 3 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>+ {unpaidBills.length - 3} more</div>}
                            </div>

                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => handlePayClick(supplier)}>
                                View & Pay
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PurchaseScreen;
