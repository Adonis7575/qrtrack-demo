import { useState } from 'react';
import { Zap, Loader, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import styles from './Login.module.css';

export default function Login({ onSignedIn }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.login(password);
      onSignedIn();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logo}>
          <Zap size={18} />
          <span>QR<strong>Track</strong></span>
        </div>

        <label className={styles.label} htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          className={styles.input}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />

        {error && (
          <p className={styles.error} role="alert">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={loading || !password}>
          {loading ? <Loader size={15} className={styles.spin} /> : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
