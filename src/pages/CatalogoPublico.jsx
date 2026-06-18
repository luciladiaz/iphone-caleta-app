import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { PLANES } from '../config/planes';

export default function CatalogoPublico() {
  const { negocioId } = useParams();
  const [negocio, setNegocio] = useState(null);
  const [equipos, setEquipos] = useState([]);
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [catalogoHabilitado, setCatalogoHabilitado] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const base = ['negocios', negocioId];
        const [negSnap, stockSnap, cfgSnap] = await Promise.all([
          getDoc(doc(db, 'negocios', negocioId)),
          getDocs(collection(db, ...base, 'stock')),
          getDoc(doc(db, ...base, 'config', 'general')),
        ]);
        const negData = negSnap.data();
        setNegocio(negData);
        const plan = negData?.plan === 'agencia' ? 'promax' : (negData?.plan || 'basico');
        const planConfig = PLANES[plan];
        setCatalogoHabilitado(planConfig?.features?.catalogoPublico === true);
        setEquipos(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.estado === 'disponible'));
        setTipoCambio(cfgSnap.data()?.tipoCambio || 0);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    cargar();
  }, [negocioId]);

  const equiposFiltrados = equipos.filter(e =>
    `${e.modelo} ${e.color} ${e.gb}`.toLowerCase().includes(filtro.toLowerCase())
  );

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868b', fontFamily: "'Inter', sans-serif" }}>
      Cargando catálogo...
    </div>
  );

  if (!catalogoHabilitado) return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Inter', sans-serif", padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📵</div>
      <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 8 }}>Este catálogo no está disponible</div>
      <div style={{ color: '#86868b', fontSize: 14, maxWidth: 340 }}>
        El negocio no tiene habilitada la función de catálogo público en su plan actual.
      </div>
      <div style={{ marginTop: 32, color: '#86868b', fontSize: 12 }}>
        Gestionado con <span style={{ color: '#2563EB' }}>ReventApp</span>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0d0d0d', fontFamily: "'Inter', -apple-system, sans-serif", color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#1c1c1e', borderBottom: '1px solid #2c2c2e', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 14, position: 'sticky', top: 0, zIndex: 10 }}>
        {negocio?.logoUrl
          ? <img src={negocio.logoUrl} alt="logo" style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
          : <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: '#fff', flexShrink: 0 }}><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
        }
        <div>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{negocio?.nombre || 'Catálogo'}</div>
          <div style={{ color: '#86868b', fontSize: 12 }}>{equipos.length} equipos disponibles</div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <input
          placeholder="Buscar modelo, color..."
          value={filtro} onChange={e => setFiltro(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 12, color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box', marginBottom: 24 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {equiposFiltrados.map(eq => (
            <div key={eq.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, borderTop: '3px solid #c9a96e' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{eq.modelo}</div>
                <div style={{ color: '#86868b', fontSize: 13, marginTop: 2 }}>{eq.gb}GB · {eq.color}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#30d158' }}>🔋</span>
                  <span>Batería: <strong>{eq.bateria}%</strong></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✅</span>
                  <span style={{ color: '#30d158', fontWeight: 600 }}>Disponible</span>
                </div>
              </div>
              {eq.pvUsd && (
                <div style={{ background: '#2c2c2e', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ fontSize: 11, color: '#86868b', marginBottom: 4 }}>PRECIO</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#2563EB' }}>USD {eq.pvUsd}</div>
                  {tipoCambio > 0 && <div style={{ fontSize: 13, color: '#86868b', marginTop: 2 }}>${(eq.pvUsd * tipoCambio).toLocaleString('es-AR')} ARS</div>}
                </div>
              )}
              <a
                href={`https://wa.me/?text=Hola! Me interesa el ${eq.modelo} ${eq.gb}GB ${eq.color}. ¿Está disponible?`}
                target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#25D366', color: '#fff', borderRadius: 10, padding: '10px', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Consultar
              </a>
            </div>
          ))}
        </div>

        {equiposFiltrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
            <p>No hay equipos disponibles en este momento.</p>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 48, color: '#86868b', fontSize: 12 }}>
          Catálogo generado con <span style={{ color: '#2563EB' }}>ReventApp</span>
        </div>
      </div>
    </div>
  );
}

