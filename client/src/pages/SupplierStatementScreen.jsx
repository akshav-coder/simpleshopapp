import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const SupplierStatementScreen = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);

    useEffect(() => {
        const fetchStatement = async () => {
            try {
                const res = await axios.get(`http://localhost:5001/api/suppliers/${id}/statement`);
                setData(res.data);
            } catch (err) {
                console.error(err);
                alert('Error loading statement');
            }
        };
        fetchStatement();
    }, [id]);

    const handlePrint = () => {
        window.print();
    };

    if (!data) return <div className="container">Loading Statement...</div>;

    const { supplier, ledger } = data;

    // Running Balance Calculation
    let balance = 0;
    const ledgerWithBalance = ledger.map(item => {
        if (item.type === 'Bill') balance += item.amount; // Liability increases
        if (item.type === 'Payment') balance -= item.amount; // Liability decreases
        return { ...item, balance };
    });

    return (
        <div className="container" style={{ background: 'white', minHeight: '100vh' }}>
            <div className="no-print" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    &larr; Back
                </button>
                <button className="btn" onClick={handlePrint}>
                    Download/Print PDF
                </button>
            </div>

            <div style={{ border: '1px solid #ddd', padding: '2rem' }}>
                <header style={{ borderBottom: '2px solid #333', paddingBottom: '1rem', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Statement of Account</h1>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <strong>To:</strong><br />
                            {supplier.name}<br />
                            {supplier.email} | {supplier.phone}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <strong>Date:</strong> {new Date().toLocaleDateString()}
                        </div>
                    </div>
                </header>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #ddd' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Date</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Description</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ref #</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Debit (Paid)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Credit (Billed)</th>
                            <th style={{ padding: '0.75rem', textAlign: 'right' }}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ledgerWithBalance.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '0.75rem' }}>{new Date(row.date).toLocaleDateString()}</td>
                                <td style={{ padding: '0.75rem' }}>{row.type === 'Bill' ? 'Invoice' : 'Payment Received'}</td>
                                <td style={{ padding: '0.75rem' }}>{row.ref}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--success)' }}>
                                    {row.type === 'Payment' ? `$${row.amount.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--error)' }}>
                                    {row.type === 'Bill' ? `$${row.amount.toLocaleString()}` : '-'}
                                </td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold' }}>
                                    ${row.balance.toLocaleString()}
                                    {row.balance > 0 ? ' Cr' : ' Dr'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: '2rem', textAlign: 'right', fontSize: '1.2rem' }}>
                    <strong>Closing Balance: ${balance.toLocaleString()}</strong>
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none; }
                    body { background: white; }
                    .container { padding: 0; max-width: 100%; border: none; }
                }
             `}</style>
        </div>
    );
};

export default SupplierStatementScreen;
