import { useEffect, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import CalculadoraPrecio from '../components/CalculadoraPrecio';
import ModalLimiteAlcanzado from '../components/ModalLimiteAlcanzado';
import { IconCalculator, IconLink, IconShare, IconEdit, IconTrash, IconCheck, IconX, IconBox, IconPin, IconArrowSwap } from '../components/Icons';
import { CATEGORIAS_STOCK, ETIQUETA_ID_POR_CATEGORIA, SUGERENCIAS_CAPACIDAD_POR_CATEGORIA, EMOJI_POR_CATEGORIA, formatCapacidad, cargarModelosPorCategoria } from '../lib/categoriasProducto';
import SelectorModelo from '../components/SelectorModelo';
import SelectorCliente from '../components/SelectorCliente';
import CampoPrecio from '../components/CampoPrecio';
import { convertirMoneda, faltaTipoCambio } from '../lib/moneda';
import { fechaLocalDesdeInput } from '../lib/fechas';
import { fechaMs, comparadorOrden } from '../lib/ordenStock';

const COLORES = ['Negro','Blanco','Azul','Natural','Desert','Desert Titanium','Natural Titanium','Naranja','Rosa','Verde','Morado','Rojo','Gris','Plata','Dorado'];
const TIPOS = ['compra','consignacion','parte_de_pago'];
const LABEL_TIPO = { compra: 'Compra directa', consignacion: 'Consignación', parte_de_pago: 'Parte de pago' };
const CLIENTE_ORIGEN_VACIO = { clienteId: '', clienteNombre: '', clienteNumero: null };
const ESTADOS = ['disponible','asignado','vendido'];
const estadoColor = { disponible: 'var(--rv-accent)', asignado: 'var(--rv-text-mid)', vendido: 'var(--rv-text-dim)', en_consignacion_cliente: 'var(--rv-text-mid)' };
const ESTADO_LABEL_STOCK = { en_consignacion_cliente: 'en consignación' };
const formatFecha = (f) => { if (!f) return 'Sin fecha'; const d = f.toDate ? f.toDate() : new Date(f); return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }); };
const ESTADO_VENTA_LABEL = { pendiente: 'Pendiente', entregado: 'Entregado', cancelado: 'Anulada' };

const inputStyle = { width: '100%', padding: '10px 12px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const labelStyle = { color: 'var(--rv-text-dim)', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'uppercase' };

export default function Stock() {
  const { perfil, negocioId, plan, limitesPlan } = useAuth();
  const esAdmin = perfil?.rol === 'admin';
  const base = ['negocios', negocioId];

  const [equipos, setEquipos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [puntosVenta, setPuntosVenta] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [equipoHistorial, setEquipoHistorial] = useState(null);
  const [categoriasProducto, setCategoriasProducto] = useState(CATEGORIAS_STOCK);
  const [modelosPorCategoria, setModelosPorCategoria] = useState({});
  const [tipoCambio, setTipoCambio] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroPuntoVenta, setFiltroPuntoVenta] = useState('todos');
  const [orden, setOrden] = useState('fecha_desc');
  const [showCalculadora, setShowCalculadora] = useState(false);
  const [modalCatalogo, setModalCatalogo] = useState(false);
  const [catalogoCategorias, setCatalogoCategorias] = useState([]);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTodo, setCopiadoTodo] = useState(false);
  const [modalLimite, setModalLimite] = useState(false);
  const [modalConsignar, setModalConsignar] = useState(null); // equipo elegido para dar en consignación
  const [formConsignar, setFormConsignar] = useState({ clienteId: '', clienteNombre: '', clienteNumero: null, precioMonto: '', precioMoneda: 'USD' });
  const [guardandoConsignar, setGuardandoConsignar] = useState(false);
  const FORM_VACIO = {
    categoria: categoriasProducto[0] || 'iPhone', modelo: '', color: '', gb: '', bateria: '', imei: '',
    tipo: 'compra', proveedor: '', costoMonto: '', costoMoneda: 'USD', pvMonto: '', pvMoneda: 'USD',
    estado: 'disponible', puntoVenta: '', asignadoA: '', notas: '', fechaManual: ''
  };
  const [form, setForm] = useState(FORM_VACIO);
  // Cliente que entregó el equipo cuando el tipo es "Parte de pago" cargado a mano. Va en
  // un estado aparte (no dentro de `form`) porque guardar() esparce `form` entero en el
  // documento del stock, y estos campos viven en `origen`, no sueltos en el equipo.
  const [clienteOrigen, setClienteOrigen] = useState(CLIENTE_ORIGEN_VACIO);

  const cargar = async () => {
    if (!negocioId) return;
    const [eSnap, ventasSnap, cliSnap, pSnap, pvSnap, vSnap, cfgSnap] = await Promise.all([
      getDocs(query(collection(db, ...base, 'stock'), orderBy('fechaIngreso', 'desc'))),
      getDocs(collection(db, ...base, 'ventas')),
      getDocs(collection(db, ...base, 'clientes')),
      getDocs(collection(db, ...base, 'proveedores')),
      getDocs(collection(db, ...base, 'puntosVenta')),
      getDocs(collection(db, ...base, 'vendedores')),
      getDoc(doc(db, ...base, 'config', 'general')),
    ]);
    setEquipos(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVentas(ventasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setClientes(cliSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setProveedores(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPuntosVenta(pvSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setVendedores(vSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    const cfg = cfgSnap.data() || {};
    const catsProducto = cfg.categoriasProducto?.length ? cfg.categoriasProducto : CATEGORIAS_STOCK;
    setCategoriasProducto(catsProducto);
    setModelosPorCategoria(await cargarModelosPorCategoria(negocioId, catsProducto, cfg.modelos));
    if (cfg.tipoCambio) setTipoCambio(cfg.tipoCambio);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [negocioId]);

  const abrirEditar = (eq) => {
    setEditandoId(eq.id);
    setForm({
      categoria: eq.categoria || 'iPhone', modelo: eq.modelo || '', color: eq.color || '', gb: eq.gb || '',
      bateria: eq.bateria || '', imei: eq.imei || '', tipo: eq.tipo || 'compra',
      proveedor: eq.proveedor || '',
      // Los equipos viejos solo tienen el valor ya convertido a USD (costoUsd/pvUsd); los
      // nuevos guardan también en qué moneda se cargó (costoMonto/costoMoneda), para poder
      // reabrir la edición mostrando el mismo monto que se tipeó, no una conversión.
      costoMonto: eq.costoMonto ?? eq.costoUsd ?? '', costoMoneda: eq.costoMoneda || 'USD',
      pvMonto: eq.pvMonto ?? eq.pvUsd ?? '', pvMoneda: eq.pvMoneda || 'USD',
      estado: eq.estado || 'disponible', puntoVenta: eq.puntoVenta || '',
      asignadoA: eq.asignadoA || '', notas: eq.notas || '', fechaManual: ''
    });
    setClienteOrigen(eq.origen?.tipo === 'parte_de_pago'
      ? { clienteId: eq.origen.clienteId || '', clienteNombre: eq.origen.clienteNombre || '', clienteNumero: eq.origen.clienteNumero || null }
      : CLIENTE_ORIGEN_VACIO);
    setModal(true);
  };

  const cerrarModal = () => {
    setModal(false);
    setEditandoId(null);
    setForm(FORM_VACIO);
    setClienteOrigen(CLIENTE_ORIGEN_VACIO);
  };

  const eliminarEquipo = async (id) => {
    const eq = equipos.find(e => e.id === id);
    // No hay forma de saber con certeza si ESTE equipo puntual tiene deuda pendiente con
    // el proveedor (la cuenta corriente de Proveedores.jsx lleva un saldo agregado, no
    // por equipo) -- pero si tiene un proveedor asociado y nunca se marcó como pagado,
    // avisamos antes de borrar para que no desaparezca la deuda sin que nadie se entere.
    const proveedorAsociado = eq?.origen?.proveedorNombre || eq?.proveedor;
    const advertenciaDeuda = proveedorAsociado && eq?.pagadoProveedor !== true
      ? `\n\nOjo: este equipo tiene a "${proveedorAsociado}" como proveedor y no está marcado como pagado. Si eliminás el equipo, esa deuda deja de verse en Proveedores.`
      : '';
    if (!window.confirm(`¿Eliminás este equipo del stock? Esta acción no se puede deshacer.${advertenciaDeuda}`)) return;
    try {
      await deleteDoc(doc(db, ...base, 'stock', id));
      cargar();
    } catch (err) {
      console.error(err);
      alert('No pudimos eliminar el equipo. Probá de nuevo.');
    }
  };

  // Mismo formato de `origen` que arman Ventas.jsx y Cobros.jsx para un equipo que entra
  // como parte de pago, así origenDe() lo muestra igual sin distinguir cómo se cargó. Sin
  // venta de origen porque acá se carga a mano (ventaOrigenId/Modelo quedan vacíos).
  const origenParteDePago = () => ({
    tipo: 'parte_de_pago',
    clienteId: clienteOrigen.clienteId || null,
    clienteNombre: clienteOrigen.clienteNombre || '',
    clienteNumero: clienteOrigen.clienteNumero || null,
    ventaOrigenId: null,
    ventaOrigenModelo: '',
  });

  const guardar = async (e) => {
    e.preventDefault();
    // SelectorModelo es un combobox propio, no un <select> nativo, así que el
    // "required" del HTML no lo cubre — se valida acá.
    if (!form.modelo.trim()) { alert('Elegí o escribí un modelo antes de guardar.'); return; }
    // Si el costo o el precio de venta se cargaron en pesos y no hay tipo de cambio en
    // Configuración, convertirMoneda() da 0 — guardar así perdería el valor sin avisar.
    if (faltaTipoCambio(form.costoMonto, form.costoMoneda, 'USD', tipoCambio) || faltaTipoCambio(form.pvMonto, form.pvMoneda, 'USD', tipoCambio)) {
      alert('Cargaste un precio en pesos pero no hay tipo de cambio configurado — se perdería el valor (quedaría en USD 0). Cargá el tipo de cambio en Configuración, o ingresá el precio directamente en USD.');
      return;
    }
    // Dos equipos ACTIVOS (no vendidos) con el mismo IMEI es casi siempre un error de
    // tipeo -- historialEquipo() agrupa por IMEI asumiendo que es único por aparato
    // físico, así que un típo que duplique un IMEI real fusiona el historial de dos
    // equipos distintos. Un mismo IMEI reingresando SÍ es válido (parte de pago de un
    // aparato que ya se vendió antes), por eso solo se chequea contra equipos no vendidos.
    if (form.imei.trim()) {
      const colision = equipos.find(e => e.id !== editandoId && e.imei && e.imei.trim() === form.imei.trim() && e.estado !== 'vendido');
      if (colision) {
        alert(`Ya hay otro equipo activo en stock con ese mismo ${ETIQUETA_ID_POR_CATEGORIA[form.categoria] || 'IMEI'} (${colision.modelo || 'sin modelo'}). Revisá que no sea un error de tipeo.`);
        return;
      }
    }
    setGuardando(true);
    try {
      // costoUsd/pvUsd son el valor canónico en USD que usa el resto de la app (Ventas,
      // reportes, dashboard); costoMonto/costoMoneda quedan como respaldo de lo que se
      // tipeó realmente, para poder reabrir la edición sin perder si se cargó en pesos.
      const costoUsd = convertirMoneda(form.costoMonto, form.costoMoneda, 'USD', tipoCambio);
      const pvUsd = convertirMoneda(form.pvMonto, form.pvMoneda, 'USD', tipoCambio);
      if (editandoId) {
        const { fechaManual, ...datos } = form;
        datos.costoUsd = costoUsd;
        datos.pvUsd = pvUsd;
        if (fechaManual) datos.fechaIngreso = fechaLocalDesdeInput(fechaManual);
        if (form.tipo !== 'parte_de_pago') {
          datos.origen = form.proveedor ? { tipo: form.tipo, proveedorNombre: form.proveedor } : null;
        } else {
          // Un equipo recibido como parte de pago desde Ventas/Cobros ya trae su origen
          // (cliente + venta): se le actualiza solo el cliente si se eligió otro, sin perder
          // ventaOrigenId/ventaOrigenModelo. Si se cargó a mano (sin venta de origen), el
          // origen se arma o se limpia según el cliente elegido.
          datos.proveedor = '';
          const actual = equipos.find(e => e.id === editandoId);
          if (clienteOrigen.clienteId) {
            datos.origen = { ...(actual?.origen || {}), ...origenParteDePago() };
          } else if (!actual?.origen?.ventaOrigenId) {
            datos.origen = null;
          }
        }
        await updateDoc(doc(db, ...base, 'stock', editandoId), datos);
      } else {
        const fechaIngreso = form.fechaManual ? fechaLocalDesdeInput(form.fechaManual) : serverTimestamp();
        const esParteDePago = form.tipo === 'parte_de_pago';
        const origen = esParteDePago
          ? (clienteOrigen.clienteId ? origenParteDePago() : null)
          : (form.proveedor ? { tipo: form.tipo, proveedorNombre: form.proveedor } : null);
        await addDoc(collection(db, ...base, 'stock'), { ...form, proveedor: esParteDePago ? '' : form.proveedor, costoUsd, pvUsd, fechaIngreso, origen });
      }
      cerrarModal();
      cargar();
    } catch (err) {
      console.error(err);
      alert('No pudimos guardar el equipo. Probá de nuevo.');
    } finally { setGuardando(false); }
  };

  // Le da un equipo disponible a un cliente en consignación (mayorista): el equipo deja
  // de estar disponible pero NO se considera vendido todavía -- recién genera lo que ese
  // cliente debe cuando se marca como vendido desde Cobros (mismo criterio que la
  // consignación de un proveedor en Proveedores.jsx, pero del lado de venta).
  const abrirConsignar = (eq) => {
    setModalConsignar(eq);
    setFormConsignar({ clienteId: '', clienteNombre: '', clienteNumero: null, precioMonto: '', precioMoneda: 'USD' });
  };

  const confirmarConsignar = async () => {
    if (!modalConsignar || !formConsignar.clienteId || !(Number(formConsignar.precioMonto) > 0)) return;
    setGuardandoConsignar(true);
    try {
      await updateDoc(doc(db, ...base, 'stock', modalConsignar.id), {
        estado: 'en_consignacion_cliente',
        consignacionCliente: {
          clienteId: formConsignar.clienteId,
          clienteNombre: formConsignar.clienteNombre,
          clienteNumero: formConsignar.clienteNumero,
          precioMonto: Number(formConsignar.precioMonto),
          precioMoneda: formConsignar.precioMoneda,
          fechaEntrega: serverTimestamp(),
        },
      });
      setModalConsignar(null);
      cargar();
    } catch (err) {
      console.error(err);
      alert('No pudimos registrar la consignación. Probá de nuevo.');
    } finally { setGuardandoConsignar(false); }
  };

  // Arma la línea de "de dónde salió" un equipo, con fallback a los campos
  // sueltos legado (proveedor/tipo) para equipos cargados antes de que
  // existiera el objeto `origen` unificado.
  const origenDe = (eq) => {
    if (eq.consignacionCliente) {
      const c = eq.consignacionCliente;
      const precioTxt = `${c.precioMoneda === 'ARS' ? '$' : 'USD'} ${c.precioMonto}`;
      if (eq.estado === 'vendido') {
        return `Vendido en consignación por ${c.clienteNombre}${c.clienteNumero ? ` (Cliente #${c.clienteNumero})` : ''} — ${eq.pagadoConsignacion ? `ya te pagó ${precioTxt}` : `te debe ${precioTxt} (ver Cobros)`}`;
      }
      return `En consignación con ${c.clienteNombre}${c.clienteNumero ? ` (Cliente #${c.clienteNumero})` : ''} — te debe ${precioTxt} cuando lo venda`;
    }
    if (eq.origen?.tipo === 'parte_de_pago') {
      const cliente = eq.origen.clienteNombre ? `${eq.origen.clienteNombre}${eq.origen.clienteNumero ? ` (Cliente #${eq.origen.clienteNumero})` : ''}` : 'un cliente';
      return `Entregado por ${cliente}${eq.origen.ventaOrigenModelo ? ` — parte de pago de ${eq.origen.ventaOrigenModelo}` : ' — parte de pago'}`;
    }
    if (eq.origen?.proveedorNombre) {
      return `${eq.origen.tipo === 'consignacion' ? 'Consignación' : 'Proveedor'}: ${eq.origen.proveedorNombre}`;
    }
    if (eq.proveedor) return `${eq.tipo === 'consignacion' ? 'Consignación' : 'Proveedor'}: ${eq.proveedor}`;
    if (eq.tipo === 'parte_de_pago') return 'Recibido como parte de pago (origen no registrado)';
    return null;
  };

  // Arma la ruta completa de un equipo físico: junta todos los registros de
  // Stock que compartan el mismo IMEI/N° de serie (porque un mismo aparato puede
  // volver a entrar más de una vez — se vende, un día lo traen de parte de pago
  // de otra compra, y vuelve a entrar como un alta nueva) y, para cada uno, su
  // alta (de dónde salió) y su baja (a quién se le vendió, si corresponde).
  const historialEquipo = (eq) => {
    const mismoImei = eq.imei ? equipos.filter(e => e.imei && e.imei === eq.imei) : [eq];
    const eventos = [];
    mismoImei.forEach(item => {
      eventos.push({ tipo: 'alta', fecha: item.fechaIngreso, item });
      if (item.estado === 'vendido') {
        const venta = ventas.find(v => v.equipoId === item.id);
        if (venta) eventos.push({ tipo: 'venta', fecha: venta.fecha, venta, item });
      }
    });
    return eventos.sort((a, b) => fechaMs(a.fecha) - fechaMs(b.fecha));
  };

  const generarFichaWA = (eq) => {
    const precioARS = eq.pvUsd && tipoCambio ? `$${(eq.pvUsd * tipoCambio).toLocaleString('es-AR')} ARS` : '';
    const emoji = EMOJI_POR_CATEGORIA[eq.categoria] || '📱';
    const specs = [eq.gb ? formatCapacidad(eq.gb) : '', eq.color].filter(Boolean).join(' ');
    // Antes cada línea (batería, USD, ARS) se armaba con un "\n" pegado en el template,
    // así que si al equipo le faltaba ese dato (ej: sin precio cargado) el salto de línea
    // quedaba igual y se veía un hueco en blanco -- reportado por un cliente. Armando cada
    // línea aparte y filtrando las vacías antes de unirlas, un dato faltante simplemente no
    // deja rastro, en vez de un renglón en blanco.
    const lineas = [
      `${emoji} *${eq.modelo}${specs ? ' ' + specs : ''}*`,
      eq.bateria ? `🔋 Batería: ${eq.bateria}%` : '',
      '✅ Libre de operador',
      eq.pvUsd ? `💵 USD ${eq.pvUsd}` : '',
      precioARS ? `💵 ${precioARS}` : '',
      '📩 Consultá disponibilidad por este medio',
    ].filter(Boolean);
    return lineas.join('\n');
  };

  const copiarFicha = (eq) => {
    navigator.clipboard.writeText(generarFichaWA(eq));
    setCopiado(eq.id);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Mismo filtro de categorías que ya usa el link del catálogo (catalogoCategorias vacío
  // = todas) -- así "copiar todo como texto" siempre muestra exactamente lo mismo que el
  // link que se está por compartir en el mismo modal, nunca stock de más ni de menos.
  // También en el mismo orden elegido arriba (pedido de cliente), no en el orden crudo
  // de Firestore.
  const copiarStockCompleto = () => {
    const disponibles = equipos.filter(e => e.estado === 'disponible');
    const filtrados = (catalogoCategorias.length > 0
      ? disponibles.filter(e => catalogoCategorias.includes(e.categoria))
      : disponibles
    ).sort(comparadorOrden(orden));
    const texto = filtrados.map(generarFichaWA).join('\n\n');
    navigator.clipboard.writeText(texto);
    setCopiadoTodo(true);
    setTimeout(() => setCopiadoTodo(false), 2000);
  };

  const stockDisponible = equipos.filter(e => e.estado === 'disponible');
  const stockAsignado = equipos.filter(e => e.estado === 'asignado');
  const totalValorUSD = stockDisponible.reduce((acc, e) => acc + Number(e.pvUsd || 0), 0);
  const equiposFiltrados = equipos
    .filter(e => e.estado !== 'vendido')
    .filter(e => filtroCategoria === 'todas' || e.categoria === filtroCategoria)
    .filter(e => {
      if (filtroPuntoVenta === 'todos') return true;
      if (filtroPuntoVenta === '__sin__') return !e.puntoVenta;
      return e.puntoVenta === filtroPuntoVenta;
    })
    .filter(e =>
      `${e.categoria} ${e.modelo} ${e.color} ${e.gb} ${e.imei} ${e.puntoVenta} ${e.asignadoA} ${e.proveedor || ''} ${e.origen?.proveedorNombre || ''} ${e.origen?.clienteNombre || ''} ${e.consignacionCliente?.clienteNombre || ''}`.toLowerCase().includes(filtro.toLowerCase())
    )
    // Pedido de un cliente: ordenar por fecha de adquisición o por modelo -- sumados acá
    // precio y batería, los otros dos criterios más comunes para stock de celulares.
    // Comparador compartido con CatalogoPublico.jsx (ver src/lib/ordenStock.js) -- otro
    // pedido de cliente: que el catálogo (link y texto) se vea en el mismo orden elegido
    // acá, no en uno propio o sin ordenar.
    .sort(comparadorOrden(orden));
  const categoriasConStock = categoriasProducto.filter(cat => equipos.some(e => e.categoria === cat && e.estado !== 'vendido'));
  const puntosVentaConStock = puntosVenta.map(p => p.nombre).filter(nombre => equipos.some(e => e.puntoVenta === nombre && e.estado !== 'vendido'));
  const hayEquiposSinPuntoVenta = equipos.some(e => !e.puntoVenta && e.estado !== 'vendido');
  const catalogoEsParcial = catalogoCategorias.length > 0 && catalogoCategorias.length < categoriasConStock.length;
  // El link lleva el orden elegido en la URL (mismo patrón que "cat" para categorías) --
  // así el catálogo público se ve en el mismo orden sin necesitar guardar nada en la
  // base ni tocar el backend para saber "qué orden eligió el vendedor".
  const paramsCatalogo = new URLSearchParams();
  if (catalogoEsParcial) paramsCatalogo.set('cat', catalogoCategorias.join(','));
  if (orden !== 'fecha_desc') paramsCatalogo.set('orden', orden);
  const queryCatalogo = paramsCatalogo.toString();
  const urlCatalogo = `${window.location.origin}/catalogo/${negocioId}${queryCatalogo ? `?${queryCatalogo}` : ''}`;
  const toggleCatalogoCategoria = (cat) => {
    setCatalogoCategorias(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };
  const abrirModalCatalogo = () => { setCatalogoCategorias([]); setModalCatalogo(true); };
  const maxStock = limitesPlan?.maxStock ?? Infinity;
  const limiteAlcanzado = maxStock !== Infinity && equipos.length >= maxStock;

  const handleAgregarEquipo = () => {
    if (limiteAlcanzado) { setModalLimite(true); return; }
    setModal(true);
  };

  if (loading) return <div style={{ color: 'var(--rv-text-dim)', padding: 40 }}>Cargando stock...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Stock</h1>
          <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, margin: '4px 0 0' }}>
            {stockDisponible.length} disponibles{stockAsignado.length > 0 ? ` · ${stockAsignado.length} asignados` : ''}
            {esAdmin && totalValorUSD > 0 && (
              <span style={{ color: 'var(--rv-accent)', marginLeft: 8 }}>
                · USD {totalValorUSD.toFixed(0)} en stock{tipoCambio > 0 && ` (≈ $${(totalValorUSD * tipoCambio).toLocaleString('es-AR')} ARS)`}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setShowCalculadora(true)} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-accent)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><IconCalculator size={15} />Calculadora</button>
          <button onClick={abrirModalCatalogo} style={{ background: 'var(--rv-surface-alt)', color: 'var(--rv-text)', border: '1px solid var(--rv-border)', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><IconLink size={15} />Catálogo</button>
          {esAdmin && <button onClick={handleAgregarEquipo} style={{ background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Agregar equipo</button>}
        </div>
      </div>

      {categoriasConStock.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <button onClick={() => setFiltroCategoria('todas')} style={{ background: filtroCategoria === 'todas' ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroCategoria === 'todas' ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Todas las categorías</button>
          {categoriasConStock.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ background: filtroCategoria === cat ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroCategoria === cat ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{cat}</button>
          ))}
        </div>
      )}

      {(puntosVentaConStock.length > 1 || (puntosVentaConStock.length === 1 && hayEquiposSinPuntoVenta)) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <IconPin size={13} style={{ color: 'var(--rv-text-dim)' }} />
          <button onClick={() => setFiltroPuntoVenta('todos')} style={{ background: filtroPuntoVenta === 'todos' ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroPuntoVenta === 'todos' ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Todos los puntos de venta</button>
          {puntosVentaConStock.map(pv => (
            <button key={pv} onClick={() => setFiltroPuntoVenta(pv)} style={{ background: filtroPuntoVenta === pv ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroPuntoVenta === pv ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{pv}</button>
          ))}
          {hayEquiposSinPuntoVenta && (
            <button onClick={() => setFiltroPuntoVenta('__sin__')} style={{ background: filtroPuntoVenta === '__sin__' ? 'var(--rv-accent)' : 'var(--rv-surface-alt)', color: filtroPuntoVenta === '__sin__' ? '#fff' : 'var(--rv-text-dim)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sin punto de venta</button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input placeholder="Buscar por modelo, color, IMEI/serie, vendedor, proveedor o cliente..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ ...inputStyle, maxWidth: 420 }} />
        <select value={orden} onChange={e => setOrden(e.target.value)} style={{ ...inputStyle, width: 'auto', maxWidth: 220 }}>
          <option value="fecha_desc">Más nuevo primero</option>
          <option value="fecha_asc">Más viejo primero</option>
          <option value="modelo_asc">Modelo A-Z</option>
          <option value="modelo_desc">Modelo Z-A</option>
          <option value="precio_asc">Precio: menor a mayor</option>
          <option value="precio_desc">Precio: mayor a menor</option>
          <option value="bateria_desc">Batería: mayor a menor</option>
          <option value="bateria_asc">Batería: menor a mayor</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {equiposFiltrados.map(eq => (
          <div key={eq.id} style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 14, padding: 20, borderTop: `3px solid ${estadoColor[eq.estado] || 'var(--rv-accent)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--rv-text-dim)', letterSpacing: 0.4, textTransform: 'uppercase' }}>{eq.categoria || 'iPhone'}</span>
                <button onClick={() => setEquipoHistorial(eq)} style={{ display: 'block', background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, fontSize: 15, color: 'var(--rv-text)', cursor: 'pointer', textAlign: 'left', textDecoration: 'underline', textDecorationColor: 'var(--rv-border)', textUnderlineOffset: 3 }}>
                  {eq.modelo}
                </button>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', border: '1px solid var(--rv-border)', color: estadoColor[eq.estado] }}>{ESTADO_LABEL_STOCK[eq.estado] || eq.estado}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: 'var(--rv-text-mid)', marginBottom: 12 }}>
              {eq.gb && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{formatCapacidad(eq.gb)}</span>}
              {eq.color && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.color}</span>}
              {eq.bateria && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>Batería {eq.bateria}%</span>}
              {eq.imei && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{ETIQUETA_ID_POR_CATEGORIA[eq.categoria] || 'IMEI'} {eq.imei}</span>}
              {eq.puntoVenta && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.puntoVenta}</span>}
              {eq.asignadoA && <span><span style={{ color: 'var(--rv-accent)', fontWeight: 700, marginRight: 6 }}>✓</span>{eq.asignadoA}</span>}
              {esAdmin && eq.costoUsd > 0 && (
                <span style={{ color: 'var(--rv-text-dim)', marginTop: 4 }}>
                  Costo: USD {eq.costoUsd}{tipoCambio > 0 && ` · $${(eq.costoUsd * tipoCambio).toLocaleString('es-AR')} ARS`}
                </span>
              )}
              {eq.pvUsd > 0 && (
                <span style={{ color: 'var(--rv-accent)', fontWeight: 600 }}>
                  Venta: USD {eq.pvUsd}{tipoCambio > 0 && ` · $${(eq.pvUsd * tipoCambio).toLocaleString('es-AR')} ARS`}
                </span>
              )}
              {eq.fechaIngreso && <span style={{ color: 'var(--rv-text-dim)' }}>{eq.fechaIngreso.toDate ? eq.fechaIngreso.toDate().toLocaleDateString('es-AR') : new Date(eq.fechaIngreso).toLocaleDateString('es-AR')}</span>}
              {origenDe(eq) && (
                <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--rv-border)', color: 'var(--rv-text-dim)', fontSize: 11, lineHeight: 1.4 }}>
                  {origenDe(eq)}
                </div>
              )}
            </div>
            {eq.estado === 'disponible' && (
              <button onClick={() => copiarFicha(eq)} style={{ width: '100%', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: copiado === eq.id ? 'var(--rv-text)' : 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 }}>
                {copiado === eq.id ? <><IconCheck size={13} />Ficha copiada</> : <><IconShare size={13} />Compartir ficha WhatsApp</>}
              </button>
            )}
            {esAdmin && eq.estado === 'disponible' && (
              <button onClick={() => abrirConsignar(eq)} style={{ width: '100%', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 8 }}>
                <IconArrowSwap size={13} />Dar en consignación a un cliente
              </button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirEditar(eq)} style={{ flex: 1, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: 'var(--rv-accent)', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><IconEdit size={13} />Editar</button>
              {esAdmin && <button onClick={() => eliminarEquipo(eq.id)} style={{ background: 'var(--rv-danger-soft)', border: '1px solid rgba(212,61,61,0.3)', color: 'var(--rv-danger)', borderRadius: 8, padding: '8px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}><IconTrash size={14} /></button>}
            </div>
          </div>
        ))}
      </div>

      {equiposFiltrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--rv-text-dim)' }}>
          <IconBox size={36} style={{ marginBottom: 12 }} />
          <p>{filtro ? 'No hay equipos que coincidan con la búsqueda' : 'No hay equipos en stock'}</p>
        </div>
      )}

      {/* Modal agregar */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}>{editandoId ? <><IconEdit size={16} />Editar equipo</> : 'Agregar equipo'}</h2>
              <button onClick={cerrarModal} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><label style={labelStyle}>Categoría</label><select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value, modelo: ''})} style={inputStyle}>{categoriasProducto.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                <SelectorModelo
                  categorias={[form.categoria]}
                  modelosPorCategoria={modelosPorCategoria}
                  value={form.modelo}
                  onSeleccionar={m => setForm({ ...form, modelo: m })}
                  label="Modelo"
                  permitirVacio={false}
                />
                <div><label style={labelStyle}>Color</label><select value={form.color} onChange={e => setForm({...form, color: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{COLORES.map(c => <option key={c}>{c}</option>)}</select></div>
                <div>
                  <label style={labelStyle}>Capacidad / specs</label>
                  <input list="sugerencias-capacidad" value={form.gb} onChange={e => setForm({...form, gb: e.target.value})} placeholder={form.categoria === 'Mac' ? '16GB RAM / 512GB SSD' : form.categoria === 'Drone' ? 'Opcional' : '128'} style={inputStyle} />
                  <datalist id="sugerencias-capacidad">{(SUGERENCIAS_CAPACIDAD_POR_CATEGORIA[form.categoria] || []).map(g => <option key={g} value={g} />)}</datalist>
                </div>
                <div><label style={labelStyle}>Batería %</label><input type="number" min="0" max="100" value={form.bateria} onChange={e => setForm({...form, bateria: e.target.value})} placeholder="91" style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>{ETIQUETA_ID_POR_CATEGORIA[form.categoria] || 'IMEI'}</label><input value={form.imei} onChange={e => setForm({...form, imei: e.target.value})} placeholder={form.categoria === 'Mac' || form.categoria === 'Drone' ? 'Número de serie' : '123456789012345'} style={inputStyle} /></div>
                <div><label style={labelStyle}>Tipo de adquisición</label><select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} style={inputStyle}>{TIPOS.map(t => <option key={t} value={t}>{LABEL_TIPO[t]}</option>)}</select></div>
                {form.tipo === 'parte_de_pago' ? (
                  <SelectorCliente
                    negocioId={negocioId}
                    clientes={clientes}
                    clienteId={clienteOrigen.clienteId}
                    label="Cliente que lo entregó"
                    onSeleccionar={c => setClienteOrigen(c ? { clienteId: c.id, clienteNombre: c.nombre || '', clienteNumero: c.numero || null } : CLIENTE_ORIGEN_VACIO)}
                    onClienteCreado={c => setClientes(cs => [...cs, c])}
                  />
                ) : (
                  <div><label style={labelStyle}>Proveedor</label><select value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} style={inputStyle}><option value="">Elegir...</option>{proveedores.map(p => <option key={p.id}>{p.nombre}</option>)}</select></div>
                )}
                {/* Costo oculto para no-admin: es el mismo dato que ya está oculto en la
                    tarjeta (línea ~300) -- el modal de editar no debía ser una puerta
                    trasera para ver/cambiar el costo real de compra. */}
                {esAdmin && (
                  <CampoPrecio
                    label="Costo"
                    monto={form.costoMonto} moneda={form.costoMoneda}
                    onChange={({ monto, moneda }) => setForm({ ...form, costoMonto: monto, costoMoneda: moneda })}
                    tipoCambio={tipoCambio} placeholder="400"
                  />
                )}
                <CampoPrecio
                  label="Precio de venta"
                  monto={form.pvMonto} moneda={form.pvMoneda}
                  onChange={({ monto, moneda }) => setForm({ ...form, pvMonto: monto, pvMoneda: moneda })}
                  tipoCambio={tipoCambio} placeholder="500"
                />
                <div><label style={labelStyle}>Punto de venta</label><select value={form.puntoVenta} onChange={e => setForm({...form, puntoVenta: e.target.value})} style={inputStyle}><option value="">Ninguno</option>{puntosVenta.map(p => <option key={p.id}>{p.nombre}</option>)}</select></div>
                <div><label style={labelStyle}>Asignado a</label><select value={form.asignadoA} onChange={e => setForm({...form, asignadoA: e.target.value})} style={inputStyle}><option value="">Ninguno</option>{vendedores.map(v => <option key={v.id}>{v.nombre}</option>)}</select></div>
                {/* "Vendido" queda solo para admin: un vendedor marcándolo a mano acá se
                    salta por completo el flujo real de Ventas.jsx (que sí descuenta stock
                    de forma atómica y deja un registro de venta) -- el equipo desaparecería
                    del stock sin ninguna venta real detrás. */}
                <div><label style={labelStyle}>Estado</label><select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} style={inputStyle}>{ESTADOS.filter(s => esAdmin || s !== 'vendido').map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Fecha de ingreso</label><input type="date" value={form.fechaManual} onChange={e => setForm({...form, fechaManual: e.target.value})} style={inputStyle} /></div>
                <div style={{ gridColumn: '1/-1' }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" onClick={cerrarModal} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" disabled={guardando} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{guardando ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Agregar equipo'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal catálogo */}
      {modalCatalogo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><IconLink size={16} />Tu catálogo público</h2>
              <button onClick={() => setModalCatalogo(false)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 16 }}>Compartí este link con tus clientes. Solo muestra los equipos disponibles, sin precios de costo.</p>

            {categoriasConStock.length > 1 && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Qué categorías incluir</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {categoriasConStock.map(cat => {
                    const activa = catalogoCategorias.includes(cat);
                    return (
                      <button key={cat} type="button" onClick={() => toggleCatalogoCategoria(cat)} style={{
                        background: activa ? 'var(--rv-accent)' : 'var(--rv-surface-alt)',
                        color: activa ? '#fff' : 'var(--rv-text-mid)',
                        border: '1px solid var(--rv-border)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>{cat}</button>
                    );
                  })}
                </div>
                <p style={{ color: 'var(--rv-text-dim)', fontSize: 11, marginTop: 6, marginBottom: 0 }}>
                  {catalogoEsParcial ? `Este link solo muestra: ${catalogoCategorias.join(', ')}` : 'Sin nada seleccionado, el link muestra todas las categorías.'}
                </p>
              </div>
            )}

            <div style={{ background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: 'var(--rv-accent)', wordBreak: 'break-all', marginBottom: 16 }}>{urlCatalogo}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { navigator.clipboard.writeText(urlCatalogo); }} style={{ flex: 1, background: 'var(--rv-accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Copiar link</button>
              <a href={`https://wa.me/?text=Mirá mi catálogo: ${urlCatalogo}`} target="_blank" rel="noreferrer" style={{ flex: 1, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Compartir por WhatsApp</a>
            </div>
            {/* Alternativa al link: el texto completo de todo el stock (misma ficha que ya
                se arma equipo por equipo con "Compartir ficha WhatsApp", unida de una sola
                vez) -- pedido explícito de un cliente que prefiere pegar el catálogo como
                texto plano en vez de mandar un link. */}
            <button type="button" onClick={copiarStockCompleto} style={{ width: '100%', marginTop: 10, background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', color: copiadoTodo ? 'var(--rv-text)' : 'var(--rv-accent)', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
              {copiadoTodo ? <><IconCheck size={13} />Stock copiado como texto</> : <><IconShare size={13} />Copiar todo el stock como texto</>}
            </button>
          </div>
        </div>
      )}

      {showCalculadora && <CalculadoraPrecio tipoCambio={tipoCambio} onClose={() => setShowCalculadora(false)} />}
      {modalLimite && (
        <ModalLimiteAlcanzado
          tipo="stock" planActual={plan}
          cantidadActual={equipos.length}
          onCerrar={() => setModalLimite(false)}
        />
      )}

      {/* Modal dar en consignación a un cliente */}
      {modalConsignar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 9 }}><IconArrowSwap size={16} />Dar en consignación</h2>
              <button onClick={() => setModalConsignar(null)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>
            <p style={{ color: 'var(--rv-text-dim)', fontSize: 13, marginBottom: 16 }}>
              {modalConsignar.modelo}{modalConsignar.gb ? ` ${formatCapacidad(modalConsignar.gb)}` : ''} {modalConsignar.color} deja de estar disponible, pero todavía no se considera vendido. Cuando el cliente lo venda, marcalo desde <strong>Cobros</strong> y ahí se genera lo que te debe.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SelectorCliente
                negocioId={negocioId}
                clientes={clientes}
                clienteId={formConsignar.clienteId}
                label="Cliente"
                onSeleccionar={c => setFormConsignar(f => ({ ...f, clienteId: c?.id || '', clienteNombre: c?.nombre || '', clienteNumero: c?.numero || null }))}
                onClienteCreado={c => setClientes(cs => [...cs, c])}
              />
              <CampoPrecio
                label="Cuánto te tiene que pagar cuando lo venda"
                monto={formConsignar.precioMonto} moneda={formConsignar.precioMoneda}
                onChange={({ monto, moneda }) => setFormConsignar(f => ({ ...f, precioMonto: monto, precioMoneda: moneda }))}
                tipoCambio={tipoCambio} placeholder="450"
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={() => setModalConsignar(null)} style={{ padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
              <button type="button" disabled={guardandoConsignar || !formConsignar.clienteId || !(Number(formConsignar.precioMonto) > 0)} onClick={confirmarConsignar} style={{ padding: '10px 24px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: guardandoConsignar || !formConsignar.clienteId || !(Number(formConsignar.precioMonto) > 0) ? 0.6 : 1 }}>
                {guardandoConsignar ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial de equipo */}
      {equipoHistorial && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
          <div style={{ background: 'var(--rv-surface)', border: '1px solid var(--rv-border)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 620, margin: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{equipoHistorial.modelo}{equipoHistorial.gb ? ` · ${formatCapacidad(equipoHistorial.gb)}` : ''} {equipoHistorial.color}</h2>
                <div style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{equipoHistorial.categoria || 'iPhone'}</span>
                  {equipoHistorial.imei && <span>{ETIQUETA_ID_POR_CATEGORIA[equipoHistorial.categoria] || 'IMEI'} {equipoHistorial.imei}</span>}
                </div>
              </div>
              <button onClick={() => setEquipoHistorial(null)} style={{ background: 'none', border: 'none', color: 'var(--rv-text-dim)', cursor: 'pointer', display: 'flex' }}><IconX size={18} /></button>
            </div>

            {!equipoHistorial.imei && (
              <p style={{ color: 'var(--rv-text-dim)', fontSize: 12, marginTop: 16, background: 'var(--rv-surface-alt)', borderRadius: 8, padding: '10px 14px' }}>
                Este equipo no tiene IMEI/N° de serie cargado, así que solo se puede mostrar su propio registro — si más adelante vuelve como parte de pago, no se va a poder enlazar automáticamente con este.
              </p>
            )}

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {historialEquipo(equipoHistorial).map((ev, i, arr) => {
                const esVenta = ev.tipo === 'venta';
                const color = esVenta ? 'var(--rv-text-mid)' : 'var(--rv-accent)';
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, borderLeft: i === arr.length - 1 ? 'none' : '2px solid var(--rv-border)', marginLeft: 11, paddingLeft: 20, position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: -12, top: 0, width: 24, height: 24, borderRadius: '50%',
                      background: 'var(--rv-surface)', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {esVenta ? <IconShare size={11} style={{ color }} /> : <IconBox size={11} style={{ color }} />}
                    </div>
                    <div style={{ flex: 1, paddingTop: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase' }}>{esVenta ? 'Venta' : 'Alta en stock'}</span>
                        <span style={{ fontSize: 11, color: 'var(--rv-text-dim)' }}>{formatFecha(ev.fecha)}</span>
                        {ev.item.id !== equipoHistorial.id && <span style={{ fontSize: 10, color: 'var(--rv-text-dim)', fontStyle: 'italic' }}>(otro ingreso a stock, mismo equipo)</span>}
                      </div>
                      {!esVenta ? (
                        <div style={{ fontSize: 13, color: 'var(--rv-text-mid)' }}>
                          {origenDe(ev.item) || 'Sin origen registrado'}
                          {ev.item.costoUsd ? ` · Costo USD ${ev.item.costoUsd}` : ''}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--rv-text-mid)' }}>
                          Vendido a {ev.venta.cliente || 'cliente sin nombre'} · USD {ev.venta.pvUsd || ev.item.pvUsd || 0} · {ESTADO_VENTA_LABEL[ev.venta.estado] || ev.venta.estado}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

