import { useNavigate } from 'react-router-dom';
import { PLANES } from '../config/planes';
import { IconBox, IconWallet, IconUser } from './Icons';

const CONFIG = {
  stock: {
    Icono: IconBox,
    titulo: 'Límite de stock alcanzado',
    planRequerido: 'pro',
  },
  ventas: {
    Icono: IconWallet,
    titulo: 'Límite de ventas alcanzado',
    planRequerido: 'pro',
  },
  usuarios: {
    Icono: IconUser,
    titulo: 'Límite de usuarios alcanzado',
    planRequerido: 'promax',
  },
};

export default function ModalLimiteAlcanzado({ tipo, planActual, cantidadActual, onCerrar }) {
  const navigate = useNavigate();
  const cfg = CONFIG[tipo] || CONFIG.stock;
  const planActualNombre = PLANES[planActual]?.nombre || planActual;
  const planRequerido = cfg.planRequerido;
  const planRequeridoNombre = PLANES[planRequerido]?.nombre || planRequerido;
  const planRequeridoPrecio = PLANES[planRequerido]?.precio
    ? `$${PLANES[planRequerido].precio.toLocaleString('es-AR')}`
    : '';
  const limite = PLANES[planActual]?.[tipo === 'stock' ? 'maxStock' : tipo === 'ventas' ? 'maxVentasMes' : 'maxUsuarios'];

  const descripcion = tipo === 'stock'
    ? `Tu plan ${planActualNombre} permite hasta ${limite} equipos en stock. Tenés ${cantidadActual} equipos cargados.`
    : tipo === 'ventas'
    ? `Tu plan ${planActualNombre} permite hasta ${limite} ventas por mes. Ya registraste ${cantidadActual} ventas este mes.`
    : `Tu plan ${planActualNombre} permite hasta ${limite} usuario${limite !== 1 ? 's' : ''}.`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16,
        padding: 32, width: '100%', maxWidth: 420, textAlign: 'center',
      }}>
        <cfg.Icono size={36} style={{ marginBottom: 16, color: 'var(--rv-accent)' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>{cfg.titulo}</h2>
        <p style={{ color: 'var(--rv-text-dim)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>{descripcion}</p>
        <button
          onClick={() => { onCerrar(); navigate(`/planes?upgrade=${planRequerido}`); }}
          style={{
            width: '100%', background: 'var(--rv-accent)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
          }}
        >
          Actualizar a {planRequeridoNombre}{planRequeridoPrecio ? ` → ${planRequeridoPrecio}/mes` : ''}
        </button>
        <button
          onClick={onCerrar}
          style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', fontSize: 14, cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

