import { useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { api, onUnauthorized } from './utils/api';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Generate from './pages/Generate.jsx';
import QRDetail from './pages/QRDetail.jsx';
import Login from './pages/Login.jsx';

export default function App() {
  // null = still checking
  const [session, setSession] = useState(null);
  const [bootError, setBootError] = useState('');

  const check = useCallback(() => {
    setBootError('');
    api.me().then(setSession).catch((err) => setBootError(err.message));
  }, []);

  useEffect(check, [check]);
  useEffect(() => onUnauthorized(() => {
    setSession((s) => (s ? { ...s, authenticated: false } : s));
  }), []);

  if (bootError) {
    return (
      <div className="boot">
        <p>{bootError}</p>
        <button onClick={check}>Try again</button>
      </div>
    );
  }

  if (!session) return <div className="boot" aria-busy="true" />;

  if (!session.authenticated) {
    return <Login onSignedIn={() => setSession({ ...session, authenticated: true })} />;
  }

  const signOut = session.authRequired
    ? async () => {
        await api.logout().catch(() => {});
        setSession({ ...session, authenticated: false });
      }
    : null;

  return (
    <Routes>
      <Route element={<Layout onSignOut={signOut} />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/generate" element={<Generate />} />
        <Route path="/qr/:id" element={<QRDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
