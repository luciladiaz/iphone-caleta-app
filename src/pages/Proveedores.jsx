import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';

export default function Proveedores() {
  const { negocioId } = useAuth();
  const base = ['negocios', negocioId];
  const [proveedores, setProveedores] = useState([]);
  const [detalle, setDetalle] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!negocioId) return;
    const cargar = async () => {
      const [pSnap, stockSnap] = await Promise.all([
        getDocs(collection(db, ...base, 'proveedores')),
        getDocs(collection(db, ...base, 'stock')),
      ]);
      const provs = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const stock = stockSnap.docs.map(d => d.data());
      const det = {};
      provs.forEach(p => {
        det[p.id] = {
          total: stock.filter(s => s.proveedor === p.nombre).length,
          disponibles: stock.filter(s => s.proveedor === p.nombre && s.estado === 'disponible').length,
          vendidos: stock.filter(s => s.proveedor === p.nombre && s.estado === 'vendido').length,
          consignacion: stock.filter(s => s.proveedor === p.nombre && s.tipo === 'consignacion').length,
        };
      });
      setProveedores(provs);
      setDetalle(det);
      setLoading(false);
    };
    cargar();
  }, [negocioId]);

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>🏭 Proveedores</h1>
      <p style={{ color: '#86868b', fontSize: 13, marginBottom: 28 }}>Cargá los proveedores desde ⚙️ Configuración</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {proveedores.map(p => {
          const d = detalle[p.id] || {};
          return (
            <div key={p.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>🏭 {p.nombre}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868b' }}>Equipos totales</span><span style={{ fontWeight: 700 }}>{d.total || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868b' }}>Disponibles</span><span style={{ color: '#30d158', fontWeight: 700 }}>{d.disponibles || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868b' }}>Vendidos</span><span style={{ fontWeight: 700 }}>{d.vendidos || 0}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#86868b' }}>En consignación</span><span style={{ color: '#ff9f0a', fontWeight: 700 }}>{d.consignacion || 0}</span></div>
              </div>
            </div>
          );
        })}
        {proveedores.length === 0 && <div style={{ color: '#86868b', fontSize: 14 }}>No hay proveedores. Agregá desde ⚙️ Configuración.</div>}
      </div>
    </div>
  );
}
