import { CardPayment } from '@mercadopago/sdk-react';

// Card Payment Brick: a diferencia de armar cada campo (número, vencimiento, CVV) por
// separado con Secure Fields sueltos —que requiere calcularle el tamaño exacto a cada
// iframe a mano y es frágil ante cualquier cambio de layout—, el Brick es un widget
// único y completo que arma y mantiene Mercado Pago. Nosotros solo le decimos el monto
// y el email, y recibimos el token ya generado en onSubmit.
export default function FormularioTarjetaMP({ email, onToken, onCancelar, procesando, error }) {
  const handleSubmit = async (formData) => {
    // onToken (confirmarConToken en Planes.jsx) ya atrapa sus propios errores y los
    // muestra vía el prop `error` de acá abajo — no hace falta relanzarlos al Brick,
    // que mostraría un mensaje genérico de MP que podría confundir (el problema puede
    // ser nuestro backend, no la tarjeta en sí).
    await onToken(formData.token);
  };

  return (
    <div>
      {error && (
        <div style={{ background: 'var(--rv-danger-soft)', color: 'var(--rv-danger)', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <CardPayment
        initialization={{ amount: 29900, payer: { email: email || undefined } }}
        customization={{
          paymentMethods: { maxInstallments: 1 },
          visual: { hideFormTitle: true },
        }}
        locale="es-AR"
        onSubmit={handleSubmit}
        onError={(err) => console.error('[CardPayment Brick]', err)}
      />

      <button
        type="button" onClick={onCancelar} disabled={procesando}
        style={{ width: '100%', marginTop: 10, padding: '10px 20px', background: 'var(--rv-surface-alt)', border: '1px solid var(--rv-border)', borderRadius: 8, color: 'var(--rv-text)', fontSize: 14, cursor: 'pointer' }}
      >
        Cancelar
      </button>
    </div>
  );
}
