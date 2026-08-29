import { useEffect, useRef, useState } from 'react';

const PUBLIC_KEY = 'APP_USR-af288f66-58d1-4a4b-982b-cdaae5415a54';
const SDK_URL = 'https://sdk.mercadopago.com/js/v2';

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

const contenedorCampo = {
  border: '1px solid var(--rv-border)',
  borderRadius: 8,
  padding: '12px 14px',
  background: 'var(--rv-surface-alt)',
};

const inputEstilo = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--rv-border)',
  borderRadius: 8,
  background: 'var(--rv-surface-alt)',
  color: 'var(--rv-text)',
  fontSize: 14,
  boxSizing: 'border-box',
};

// mp.cardForm(...) — no el Card Payment Brick (pensado para pagos únicos vía
// /v1/payments) ni los Secure Fields montados a mano (layout roto en producción,
// dos veces) — es el mecanismo que la documentación de Suscripciones de Mercado
// Pago indica específicamente para generar el token que después se usa con
// /preapproval + card_token_id. El Brick generaba un token en contexto de pago
// único, y MP lo rechazaba en /preapproval con "CC_VAL_433 Credit card validation
// has failed". Acá MP maneja el montaje y el tamaño de los iframes internamente,
// nosotros solo le damos contenedores con id fijo.
export default function FormularioTarjetaMP({ email, onToken, onCancelar, procesando, error }) {
  const cardFormRef = useRef(null);
  const [listo, setListo] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;

    cargarSdkMercadoPago()
      .then(() => {
        if (!activo) return;
        const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'es-AR' });
        const colorTexto = getComputedStyle(document.documentElement).getPropertyValue('--rv-text').trim() || '#111111';
        const estiloIframe = { style: { color: colorTexto, fontSize: '14px' } };

        cardFormRef.current = mp.cardForm({
          amount: '29900',
          iframe: true,
          form: {
            id: 'form-checkout-mp',
            cardNumber: { id: 'form-checkout__cardNumber', placeholder: 'Número de tarjeta', ...estiloIframe },
            expirationDate: { id: 'form-checkout__expirationDate', placeholder: 'MM/YY', ...estiloIframe },
            securityCode: { id: 'form-checkout__securityCode', placeholder: 'CVV', ...estiloIframe },
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
            },
            onSubmit: (event) => {
              event.preventDefault();
              if (!activo) return;
              setEnviando(true);
              const { token } = cardFormRef.current.getCardFormData();
              Promise.resolve(onToken(token)).finally(() => { if (activo) setEnviando(false); });
            },
          },
        });
      })
      .catch(() => { if (activo) setErrorCarga('No pudimos cargar el formulario de pago. Recargá la página.'); });

    return () => {
      activo = false;
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

      <form id="form-checkout-mp" style={{ display: listo ? 'flex' : 'none', flexDirection: 'column', gap: 10 }}>
        <div id="form-checkout__cardNumber" style={{ ...contenedorCampo, height: 20 }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div id="form-checkout__expirationDate" style={{ ...contenedorCampo, height: 20, flex: 1 }} />
          <div id="form-checkout__securityCode" style={{ ...contenedorCampo, height: 20, flex: 1 }} />
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
