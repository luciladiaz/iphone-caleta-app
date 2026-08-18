import { useState } from 'react';

// Colores fijos por serie (ingreso siempre accent, egreso siempre danger — nunca
// se intercambian). Validado con el validador de paletas: ambos pares (claro y
// oscuro) pasan separación CVD y piso de contraste.
const COLOR_INGRESO = 'var(--rv-accent)';
const COLOR_EGRESO = 'var(--rv-danger)';

function formatMonto(n, moneda) {
  const signo = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let txt;
  if (abs >= 1000000) txt = (abs / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  else if (abs >= 1000) txt = (abs / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  else txt = Math.round(abs).toLocaleString('es-AR');
  return moneda === 'USD' ? `${signo}USD ${txt}` : `${signo}$${txt}`;
}

function formatFechaCorta(fechaStr) {
  return new Date(fechaStr + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

// Gráfico de barras agrupadas ingreso/egreso por día para UNA moneda (nunca se
// mezclan ARS y USD en el mismo eje). `datos` = [{ fecha:'YYYY-MM-DD', ingreso, egreso }].
export default function GraficoIngresosEgresos({ datos, moneda }) {
  const [hover, setHover] = useState(null);
  const [verTabla, setVerTabla] = useState(false);

  const totalIngresos = datos.reduce((s, d) => s + d.ingreso, 0);
  const totalEgresos = datos.reduce((s, d) => s + d.egreso, 0);

  const Legend = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--rv-text-mid)' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: COLOR_INGRESO, display: 'inline-block' }} />
          Ingresos <span style={{ color: 'var(--rv-text-dim)' }}>({formatMonto(totalIngresos, moneda)})</span>
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--rv-text-mid)' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: COLOR_EGRESO, display: 'inline-block' }} />
          Egresos <span style={{ color: 'var(--rv-text-dim)' }}>({formatMonto(totalEgresos, moneda)})</span>
        </span>
      </div>
      <button type="button" onClick={() => setVerTabla(v => !v)} style={{ background: 'none', border: '1px solid var(--rv-border)', color: 'var(--rv-text-dim)', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>
        {verTabla ? 'Ver gráfico' : 'Ver tabla'}
      </button>
    </div>
  );

  if (!datos || datos.length === 0 || (totalIngresos === 0 && totalEgresos === 0)) {
    return (
      <div>
        <Legend />
        <div style={{ color: 'var(--rv-text-dim)', fontSize: 13, padding: '30px 0', textAlign: 'center' }}>Sin movimientos en este período.</div>
      </div>
    );
  }

  if (verTabla) {
    return (
      <div>
        <Legend />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--rv-text-dim)' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Fecha</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Ingresos</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Egresos</th>
              </tr>
            </thead>
            <tbody>
              {datos.map(d => (
                <tr key={d.fecha} style={{ borderTop: '1px solid var(--rv-border)' }}>
                  <td style={{ padding: '6px 8px' }}>{formatFechaCorta(d.fecha)}</td>
                  <td style={{ padding: '6px 8px', color: COLOR_INGRESO, fontWeight: 600 }}>{d.ingreso > 0 ? formatMonto(d.ingreso, moneda) : '—'}</td>
                  <td style={{ padding: '6px 8px', color: COLOR_EGRESO, fontWeight: 600 }}>{d.egreso > 0 ? formatMonto(d.egreso, moneda) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const W = 720, H = 220, padL = 46, padB = 26, padT = 10, padR = 8;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(1, ...datos.map(d => Math.max(d.ingreso, d.egreso)));
  const colW = plotW / datos.length;
  const barW = Math.min(16, colW * 0.34);
  const gap = 2;
  const yBase = padT + plotH;
  const labelEvery = Math.max(1, Math.ceil(datos.length / 7));

  const gridLines = Array.from({ length: 5 }, (_, i) => {
    const v = (max / 4) * i;
    return { y: padT + plotH - (v / max) * plotH, v };
  });

  const hoverBar = hover ? datos[hover.i] : null;
  const hoverValor = hoverBar ? (hover.tipo === 'ingreso' ? hoverBar.ingreso : hoverBar.egreso) : 0;
  const hoverH = (hoverValor / max) * plotH;
  const hoverCx = hover ? padL + colW * hover.i + colW / 2 : 0;
  const hoverTopPct = hover ? ((yBase - hoverH) / H) * 100 : 0;
  const hoverLeftPct = hover ? (hoverCx / W) * 100 : 0;

  return (
    <div>
      <Legend />
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {gridLines.map((g, i) => (
            <g key={i}>
              <line x1={padL} y1={g.y} x2={W - padR} y2={g.y} stroke="var(--rv-border)" strokeWidth="1" />
              <text x={padL - 6} y={g.y + 3} textAnchor="end" fontSize="9" fill="var(--rv-text-dim)">{formatMonto(g.v, moneda)}</text>
            </g>
          ))}
          {datos.map((d, i) => {
            const cx = padL + colW * i + colW / 2;
            const hI = (d.ingreso / max) * plotH;
            const hE = (d.egreso / max) * plotH;
            const activo = hover && hover.i === i;
            return (
              <g key={d.fecha}>
                {d.ingreso > 0 && (
                  <rect x={cx - gap / 2 - barW} y={yBase - hI} width={barW} height={Math.max(hI, 1.5)} rx="3" fill={COLOR_INGRESO}
                    opacity={activo && hover.tipo === 'ingreso' ? 1 : 0.85}
                    onMouseEnter={() => setHover({ i, tipo: 'ingreso' })} onMouseLeave={() => setHover(null)} />
                )}
                {d.egreso > 0 && (
                  <rect x={cx + gap / 2} y={yBase - hE} width={barW} height={Math.max(hE, 1.5)} rx="3" fill={COLOR_EGRESO}
                    opacity={activo && hover.tipo === 'egreso' ? 1 : 0.85}
                    onMouseEnter={() => setHover({ i, tipo: 'egreso' })} onMouseLeave={() => setHover(null)} />
                )}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--rv-text-dim)">{formatFechaCorta(d.fecha)}</text>
                )}
              </g>
            );
          })}
        </svg>
        {hover && (
          <div style={{
            position: 'absolute', left: `${hoverLeftPct}%`, top: `${hoverTopPct}%`,
            transform: 'translate(-50%, -110%)', background: 'var(--rv-surface)', border: '1px solid var(--rv-border)',
            borderRadius: 8, padding: '6px 10px', fontSize: 11, whiteSpace: 'nowrap', pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)', zIndex: 5,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--rv-text)' }}>{formatFechaCorta(datos[hover.i].fecha)}</div>
            <div style={{ color: hover.tipo === 'ingreso' ? COLOR_INGRESO : COLOR_EGRESO, fontWeight: 600 }}>
              {hover.tipo === 'ingreso' ? 'Ingresos' : 'Egresos'}: {formatMonto(hoverValor, moneda)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
