import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PurchaseScreen from './pages/PurchaseScreen';
import PaymentScreen from './pages/PaymentScreen';

import PaymentHistoryScreen from './pages/PaymentHistoryScreen';
import SupplierStatementScreen from './pages/SupplierStatementScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PurchaseScreen />} />
        <Route path="/payment" element={<PaymentScreen />} />
        <Route path="/history" element={<PaymentHistoryScreen />} />
        <Route path="/statement/:id" element={<SupplierStatementScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
