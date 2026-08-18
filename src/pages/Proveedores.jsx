import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IconTruck, IconGear, IconCheck, IconCheckCircle, IconWarning, IconBox } from '../components/Icons';

// Un equipo de stock se considera pagado si el propio equipo tiene `pagadoProveedor`
// seteado explícitamente (mecanismo nuevo, funciona vendido o no); si nunca se tocó
// desde acá, se respeta lo que ya estaba marcado en la venta (mecanismo viejo de
// "Pagos Proveedores", que solo aplica a equipos vendidos) para no perder pagos ya
// registrados antes de que existiera este detalle por proveedor.
function estaPagado(item, venta) {
  if (typeof item.pagadoProveedor === 'boolean') return item.pagadoProveedor;
  return venta?.pagadoProveedor === true;
}

export default function Proveedores() {
  const { negocioId } = useAuth();
  const base = ['negocios', negocioId];
  const [proveedores, setProveedores] = useState([]);
  const [stock, setStock] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null);

  const cargar = async () => {
    if (!negocioId) return;
    const [pSnap, stockSnap, ventasSnap] = await Promise.all([
      getDocs(collection(db, ...base, 'proveedores')),
      getDocs(collection(db, ...base, 'stock')),
      getDocs(collection(db, ...base, 'ventas')),
    ]);
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setStock(stockSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVentas(ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const togglePagado = async (item) => {
    const venta = ventas.find(v => v.equipoId === item.id);
    const nuevoPagado = !estaPagado(item, venta);
    await updateDoc(doc(db, ...base, 'stock', item.id), {
      pagadoProveedor: nuevoPagado,
      fechaPagoProveedor: nuevoPagado ? new Date().toISOString().split('T')[0] : null,
      montoPagadoProveedor: nuevoPagado ? Number(item.costoUsd) || 0 : null,
    });
    cargar();
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando...</div>;

  const detalle = proveedores.map(p => {
    const items = stock
      .filter(s => s.proveedor === p.nombre && Number(s.costoUsd) > 0)
      .map(item => ({ ...item, pagado: estaPagado(item, ventas.find(v => v.equipoId === item.id)) }))
      .sort((a, b) => Number(a.pagado) - Number(b.pagado));
    const totalDebido = items.reduce((s, i) => s + (Number(i.costoUsd) || 0), 0);
    const totalPagado = items.reduce((s, i) => s + (i.pagado ? Number(i.costoUsd) || 0 : 0), 0);
    return {
      ...p,
      items,
      totalDebido,
      totalPagado,
      pendiente: totalDebido - totalPagado,
      disponibles: items.filter(i => i.estado === 'disponible').length,
      vendidos: items.filter(i => i.estado === 'vendido').length,
      consignacion: items.filter(i => i.tipo === 'consignacion').length,
    };
  }).sort((a, b) => b.pendiente - a.pendiente);

  const totalPendienteGeneral = detalle.reduce((s, p) => s + p.pendiente, 0);

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}><IconTruck size={22} style={{ color: 'var(--rv-accent)' }} />Proveedores</h1>
      <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
        Cargá los proveedores desde <IconGear size={12} />Configuración. El costo que cargás al agregar un equipo al Stock se atribuye acá solo.
      </p>
      {totalPendienteGeneral > 0 && (
        <div style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', borderRadius: 10, padding: '10px 16px', marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <IconWarning size={14} style={{ color: 'var(--rv-danger)' }} />
          Debés en total <strong>USD {totalPendienteGeneral.toFixed(0)}</strong> entre todos los proveedores
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {detalle.map(p => (
          <div key={p.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><IconTruck size={16} style={{ color: 'var(--rv-accent)' }} />{p.nombre}</div>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 4 }}>
                  {p.items.length} equipo{p.items.length === 1 ? '' : 's'} · {p.disponibles} disponible{p.disponibles === 1 ? '' : 's'} · {p.vendidos} vendido{p.vendidos === 1 ? '' : 's'}
                  {p.consignacion > 0 && ` · ${p.consignacion} en consignación`}
                </div>
              </div>
              {p.items.length > 0 && (
                <button onClick={() => setAbierto(a => a === p.id ? null : p.id)} style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-text-mid)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {abierto === p.id ? 'Ocultar detalle' : 'Ver detalle'}
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16 }}>
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>TOTAL DEBIDO</div>
                <div style={{ fontWeight: 700 }}>USD {p.totalDebido.toFixed(0)}</div>
              </div>
              <div style={{ background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>PAGADO</div>
                <div style={{ fontWeight: 700, color: 'var(--rv-text-mid)' }}>USD {p.totalPagado.toFixed(0)}</div>
              </div>
              <div style={{ background: p.pendiente > 0 ? 'var(--rv-danger-soft)' : 'var(--rv-accent-soft)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '8px 12px' }}>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 10, marginBottom: 2 }}>PENDIENTE</div>
                <div style={{ fontWeight: 800, color: p.pendiente > 0 ? 'var(--rv-danger)' : 'var(--rv-accent)' }}>
                  {p.pendiente > 0 ? `USD ${p.pendiente.toFixed(0)}` : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconCheckCircle size={13} />Al día</span>}
                </div>
              </div>
            </div>

            {abierto === p.id && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--rv-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.items.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{item.modelo} {item.gb}GB {item.color}</span>
                      <span style={{ color: 'var(--rv-text-dim)', marginLeft: 8 }}>{item.estado === 'vendido' ? 'Vendido' : item.estado === 'asignado' ? 'Asignado' : 'Disponible'}{item.tipo === 'consignacion' ? ' · Consignación' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>USD {item.costoUsd}</span>
                      <button onClick={() => togglePagado(item)} style={{
                        background: item.pagado ? 'var(--rv-accent-soft)' : 'var(--rv-surface)', border: '1px solid var(--rv-border)',
                        color: item.pagado ? 'var(--rv-accent)' : 'var(--rv-text-mid)', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {item.pagado ? <><IconCheck size={11} />Pagado</> : 'Marcar pagado'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {proveedores.length === 0 && <div style={{ color: 'var(--rv-text-dim)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>No hay proveedores. Agregá desde <IconGear size={12} />Configuración.</div>}
        {proveedores.length > 0 && detalle.every(p => p.items.length === 0) && (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
            <IconBox size={36} style={{ marginBottom: 12 }} />
            <p>Todavía no cargaste equipos de stock con costo y proveedor asignado.</p>
          </div>
        )}
      </div>
    </div>
  );
}
