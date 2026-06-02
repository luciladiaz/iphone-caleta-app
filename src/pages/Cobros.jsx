import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function Cobros() {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      const snap = await getDocs(query(collection(db, 'ventas'), orderBy('fecha', 'desc')));
      setVentas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    cargar();
  }, []);

  const marcarCuota = async (ventaId, cobroIdx, cuotaIdx, pagada) => {
    const venta = ventas.find(v => v.id === ventaId);
    const cobros = [...(venta.cobros || [])];
    const cuotasPagadas = [...(cobros[cobroIdx].cuotasPagadas || [])];
    if (pagada) cuotasPagadas.splice(cuotasPagadas.indexOf(cuotaIdx), 1);
    else cuotasPagadas.push(cuotaIdx);
    cobros[cobroIdx] = { ...cobros[cobroIdx], cuotasPagadas };
    await updateDoc(doc(db, 'ventas', ventaId), { cobros });
    setVentas(vs => vs.map(v => v.id === ventaId ? { ...v, cobros } : v));
  };

  if (loading) return <div style={{ color: '#86868b', padding: 40 }}>Cargando...</div>;

  const ventasConCobros = ventas.filter(v => v.cobros && v.cobros.length > 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 24 }}>💳 Cobros</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ventasConCobros.map(v => (
          <div key={v.id} style={{ background: '#1c1c1e', border: '1px solid #2c2c2e', borderRadius: 14, padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{v.modelo} {v.gb}GB · {v.cliente || 'Sin cliente'}</div>
              <div style={{ color: '#86868b', fontSize: 12, marginTop: 2 }}>Vendedor: {v.vendedor || '-'}</div>
            </div>
            {v.cobros.map((cobro, ci) => (
              <div key={ci} style={{ background: '#2c2c2e', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cobro.tipo}</span>
                  {cobro.monto && <span style={{ color: '#c9a96e', fontWeight: 700 }}>{cobro.moneda} {cobro.monto}</span>}
                </div>
                {cobro.tipo === 'Cuotas personales' && cobro.cuotas && (
                  <div>
                    <div style={{ color: '#86868b', fontSize: 12, marginBottom: 8 }}>
                      {cobro.cuotas} cuotas de {cobro.moneda} {cobro.montoCuota}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {Array.from({ length: Number(cobro.cuotas) }).map((_, qi) => {
                        const pagada = (cobro.cuotasPagadas || []).includes(qi);
                        const fecha = cobro.fechaInicio ? new Date(new Date(cobro.fechaInicio).setMonth(new Date(cobro.fechaInicio).getMonth() + qi)).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }) : `Cuota ${qi + 1}`;
                        return (
                          <button key={qi} onClick={() => marcarCuota(v.id, ci, qi, pagada)} style={{
                            padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none',
                            background: pagada ? 'rgba(48,209,88,0.15)' : 'rgba(255,159,10,0.15)',
                            color: pagada ? '#30d158' : '#ff9f0a'
                          }}>
                            {pagada ? '✓' : ''} {fecha}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {cobro.tipo === 'iPhone como parte de pago' && (
                  <div style={{ color: '#c9a96e', fontSize: 13 }}>📱 iPhone recibido como parte de pago (ya agregado al stock)</div>
                )}
              </div>
            ))}
          </div>
        ))}
        {ventasConCobros.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: '#86868b' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
            <p>No hay cobros registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}
