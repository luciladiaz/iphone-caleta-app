import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0d0d0d',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{
        background: '#1c1c1e', border: '1px solid #2c2c2e',
        borderRadius: 16, padding: 40, width: '100%', maxWidth: 400
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <svg viewBox="0 0 24 24" style={{ width: 44, height: 44, fill: '#fff', margin: '0 auto 8px' }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0 }}>iPhone Caleta</h1>
          <p style={{ color: '#86868b', fontSize: 14, marginTop: 4 }}>Sistema de gestión</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ color: '#86868b', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>EMAIL</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              required placeholder="tu@email.com"
              style={{
                width: '100%', padding: '12px 14px', background: '#2c2c2e',
                border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff',
                fontSize: 15, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ color: '#86868b', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>CONTRASEÑA</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              required placeholder="••••••••"
              style={{
                width: '100%', padding: '12px 14px', background: '#2c2c2e',
                border: '1px solid #3a3a3c', borderRadius: 10, color: '#fff',
                fontSize: 15, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
              borderRadius: 8, padding: '10px 14px', color: '#ff3b30', fontSize: 13
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              background: '#c9a96e', color: '#000', border: 'none',
              borderRadius: 10, padding: '13px', fontSize: 15,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, marginTop: 8
            }}
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
