import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PurchaseScreen from './pages/PurchaseScreen';
import PaymentScreen from './pages/PaymentScreen';

import PaymentHistoryScreen from './pages/PaymentHistoryScreen';
import SupplierStatementScreen from './pages/SupplierStatementScreen';
import DeletedTransactionsScreen from './pages/DeletedTransactionsScreen';
import { Link } from 'react-router-dom';

function App() {
  return (
    <Router>
      {/* Simple Nav added for easy access */}
      <div style={{ background: '#333', padding: '1rem', color: 'white', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Simple Shop</h2>
        <nav>
          <Link to="/" style={{ color: 'white', marginRight: '1rem', textDecoration: 'none' }}>Suppliers</Link>
          <Link to="/history" style={{ color: 'white', marginRight: '1rem', textDecoration: 'none' }}>History</Link>
          <Link to="/deleted-transactions" style={{ color: '#fca5a5', textDecoration: 'none' }}>Deleted Items</Link>
        </nav>
      </div>

      <Routes>
        <Route path="/" element={<PurchaseScreen />} />
        <Route path="/payment" element={<PaymentScreen />} />
        <Route path="/history" element={<PaymentHistoryScreen />} />
        <Route path="/statement/:id" element={<SupplierStatementScreen />} />
        <Route path="/deleted-transactions" element={<DeletedTransactionsScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
