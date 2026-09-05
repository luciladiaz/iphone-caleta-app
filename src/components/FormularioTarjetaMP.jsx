import { useEffect, useRef, useState } from 'react';

const PUBLIC_KEY = 'APP_USR-af288f66-58d1-4a4b-982b-cdaae5415a54';
const SDK_URL = 'https://sdk.mercadopago.com/js/v2';
const SECURITY_URL = 'https://www.mercadopago.com/v2/security.js';

function cargarSdkMercadoPago() {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();
    const existente = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existente) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', () => reject(new Error('no se pudo cargar el sdk')));
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('no se pudo cargar el sdk'));
    document.head.appendChild(script);
  });
}

// Genera window.MP_DEVICE_SESSION_ID (fingerprint del dispositivo) que MP usa en su
// motor antifraude para distinguir un comprador legítimo de un patrón de riesgo. Sin
// esto, MP evalúa cada suscripción "a ciegas" respecto del dispositivo -- confirmado
// contra la documentación oficial de MP (github.com/mercadopago/sdk-js discussion #145)
// como recomendación explícita para mejorar la tasa de aprobación. No falla si no carga:
// el pago sigue funcionando, solo sin esa señal extra de seguridad.
function cargarSecurityMP() {
  return new Promise((resolve) => {
    if (window.MP_DEVICE_SESSION_ID) return resolve();
    const existente = document.querySelector(`script[src="${SECURITY_URL}"]`);
    if (existente) {
      existente.addEventListener('load', () => resolve());
      existente.addEventListener('error', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = SECURITY_URL;
    script.setAttribute('view', 'checkout');
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

// El alto TOTAL de la caja (ALTURA_CAJA) es el mismo número para los 3 campos de
// tarjeta y para los inputs normales, con boxSizing:border-box en los dos casos --
// así no dependen de que padding + alto de contenido "sumen" el mismo total por
// coincidencia (eso fue lo que venía fallando: se veían de tamaños distintos). El
// alto del iframe de tarjeta en sí (ALTURA_IFRAME, más chico que la caja) se centra
// adentro con flex; se fuerza por JS más abajo porque MP lo arranca en 0.
const ALTURA_CAJA = 44;
const ALTURA_IFRAME = 22;

const contenedorCampo = {
  height: ALTURA_CAJA,
  boxSizing: 'border-box',
  border: '1px solid var(--rv-border)',
  borderRadius: 8,
  padding: '0 14px',
  background: 'var(--rv-surface-alt)',
  display: 'flex',
  alignItems: 'center',
};

const inputEstilo = {
  width: '100%',
  height: ALTURA_CAJA,
  boxSizing: 'border-box',
  padding: '0 14px',
  border: '1px solid var(--rv-border)',
  borderRadius: 8,
  background: 'var(--rv-surface-alt)',
  color: 'var(--rv-text)',
  fontSize: 14,
};

// mp.cardForm(...) — no el Card Payment Brick (pensado para pagos únicos vía
// /v1/payments) ni los Secure Fields montados a mano (layout roto en producción,
// dos veces) — es el mecanismo que la documentación de Suscripciones de Mercado
// Pago indica específicamente para generar el token que después se usa con
// /preapproval + card_token_id. El Brick generaba un token en contexto de pago
// único, y MP lo rechazaba en /preapproval con "CC_VAL_433 Credit card validation
// has failed". Los iframes de tarjeta NO se insertan dentro de nuestros divs --
// MP los crea aparte y los superpone del tamaño que le digamos por style.
const IDS_CAMPOS_TARJETA = ['form-checkout__cardNumber', 'form-checkout__expirationDate', 'form-checkout__securityCode'];

export default function FormularioTarjetaMP({ email, onToken, onCancelar, procesando, error }) {
  const cardFormRef = useRef(null);
  const observersRef = useRef([]);
  const tokenMetaRef = useRef(null);
  const [listo, setListo] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;

    cargarSecurityMP();
    cargarSdkMercadoPago()
      .then(() => {
        if (!activo) return;
        const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'es-AR' });

        // Confirmado leyendo el código fuente real del SDK (fields.create recibe
        // {..., style: r.style} tal cual el style que mandamos por campo): "style" SÍ es
        // una opción válida por campo en cardForm -- lo que se sacó antes por error.
        // Confirmado también con devtools en producción: sin un height explícito acá, el
        // iframe que MP inserta (fuera de nuestro div, superpuesto) queda con altura 0
        // pase lo que pase con el CSS de nuestro contenedor -- el ancho lo pone MP por
        // default (280px/120px) pero el alto hay que decírselo nosotros sí o sí.
        const colorTexto = getComputedStyle(document.documentElement).getPropertyValue('--rv-text').trim() || '#111111';
        const estiloCampoTarjeta = { style: { height: `${ALTURA_IFRAME}px`, color: colorTexto, fontSize: '14px' } };

        cardFormRef.current = mp.cardForm({
          amount: '29900',
          iframe: true,
          form: {
            id: 'form-checkout-mp',
            cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta', ...estiloCampoTarjeta },
            expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/YY', ...estiloCampoTarjeta },
            securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV', ...estiloCampoTarjeta },
            cardholderName: { id: 'form-checkout__cardholderName', placeholder: 'Nombre igual que en la tarjeta' },
            issuer: { id: 'form-checkout__issuer', placeholder: 'Banco emisor' },
            installments: { id: 'form-checkout__installments', placeholder: 'Cuotas' },
            identificationType: { id: 'form-checkout__identificationType', placeholder: 'Tipo de documento' },
            identificationNumber: { id: 'form-checkout__identificationNumber', placeholder: 'Número de documento' },
            cardholderEmail: { id: 'form-checkout__cardholderEmail', placeholder: 'Email' },
          },
          callbacks: {
            onFormMounted: (err) => {
              if (!activo) return;
              if (err) { setErrorCarga('No pudimos cargar el formulario de pago. Recargá la página.'); return; }
              setListo(true);

              // Confirmado con devtools en producción: MP crea los 3 iframes de tarjeta
              // (secure-fields.mercadopago.com, carga en 200 OK, sin errores) pero arrancan
              // en height:0 -- la animación que deberían disparar para crecer a su altura
              // real ("transition: height 2s ease" en su propio código) nunca se completa.
              // En vez de depender de esa señal interna de MP, se fuerza la altura acá,
              // y con un MutationObserver por si MP la vuelve a pisar después.
              IDS_CAMPOS_TARJETA.forEach((id) => {
                const contenedor = document.getElementById(id);
                if (!contenedor) return;
                const alturaObjetivo = `${ALTURA_IFRAME}px`;
                const forzarAltura = () => {
                  const iframe = contenedor.querySelector('iframe');
                  if (iframe && iframe.style.height !== alturaObjetivo) {
                    iframe.style.setProperty('height', alturaObjetivo, 'important');
                    iframe.style.setProperty('width', '100%', 'important');
                  }
                };
                forzarAltura();
                const observer = new MutationObserver(forzarAltura);
                observer.observe(contenedor, { attributes: true, attributeFilter: ['style'], subtree: true, childList: true });
                observersRef.current.push(observer);
              });
            },
            // Se dispara apenas MP genera el token, ANTES del submit -- da visibilidad
            // sobre metadata del token (security_code_length, luhn_validation, etc, nunca
            // el número completo ni el CVV) que hoy no teníamos. Si un pago vuelve a
            // rechazarse por "token generado sin validación de CVV", esto permite ver el
            // dato real en vez de especular.
            onCardTokenReceived: (err, data) => {
              tokenMetaRef.current = data || null;
              if (err) console.error('[MP cardForm] Error generando token:', err);
              else console.log('[MP cardForm] Token generado:', JSON.stringify(data));
            },
            onSubmit: (event) => {
              event.preventDefault();
              if (!activo) return;
              setEnviando(true);
              const { token } = cardFormRef.current.getCardFormData();
              Promise.resolve(onToken(token, window.MP_DEVICE_SESSION_ID, tokenMetaRef.current)).finally(() => { if (activo) setEnviando(false); });
            },
          },
        });
      })
      .catch(() => { if (activo) setErrorCarga('No pudimos cargar el formulario de pago. Recargá la página.'); });

    return () => {
      activo = false;
      observersRef.current.forEach((o) => o.disconnect());
      observersRef.current = [];
      try { cardFormRef.current?.unmount?.(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {(error || errorCarga) && (
        <div style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {error || errorCarga}
        </div>
      )}

      {!listo && !errorCarga && (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--rv-text-dim)', fontSize: 13 }}>
          Cargando formulario de pago...
        </div>
      )}

      {/* NUNCA ocultar este form mientras carga -- ni con display:none ni con
          visibility:hidden. Confirmado con las devtools en producción: mp.cardForm no
          inserta los iframes de tarjeta adentro de nuestros divs -- los crea aparte
          (en secure-fields.mercadopago.com) y los superpone del ancho/alto que mide de
          nuestros contenedores en el momento del montaje. Con visibility:hidden el ancho
          lo calculaba bien (280px/120px/120px) pero el alto daba 0 -- los 3 campos de
          tarjeta quedaban con altura cero, invisibles e inutilizables, aunque después
          "listo" pasara a true. El form tiene que estar visible desde el primer render. */}
      <form id="form-checkout-mp" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div id="form-checkout__cardNumber" style={contenedorCampo} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div id="form-checkout__expirationDate" style={{ ...contenedorCampo, flex: 1 }} />
          <div id="form-checkout__securityCode" style={{ ...contenedorCampo, flex: 1 }} />
        </div>
        <input id="form-checkout__cardholderName" type="text" placeholder="Nombre igual que en la tarjeta" style={inputEstilo} />
        <div style={{ display: 'flex', gap: 10 }}>
          <select id="form-checkout__identificationType" style={{ ...inputEstilo, flex: 1 }} />
          <input id="form-checkout__identificationNumber" type="text" placeholder="Número de documento" style={{ ...inputEstilo, flex: 1 }} />
        </div>
        <input id="form-checkout__cardholderEmail" type="email" placeholder="Email" defaultValue={email || ''} style={inputEstilo} />
        {/* issuer/installments: mp.cardForm los necesita montados para resolver el token,
            pero no le importan a /preapproval (solo manda card_token_id) — se ocultan
            porque no tiene sentido mostrarle "cuotas" a alguien pagando una suscripción. */}
        <select id="form-checkout__issuer" style={{ display: 'none' }} />
        <select id="form-checkout__installments" style={{ display: 'none' }} />

        <button type="submit" disabled={procesando || enviando}
          style={{ width: '100%', marginTop: 4, padding: '12px 20px', background: 'var(--rv-accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          {procesando || enviando ? 'Procesando...' : 'Confirmar pago'}
        </button>
      </form>

      <button
        type="button" onClick={onCancelar} disabled={procesando || enviando}
        style={{ width: '100%', marginTop: 10, padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}
      >
        Cancelar
      </button>
    </div>
  );
}
