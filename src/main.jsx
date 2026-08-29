import React from 'react'
import ReactDOM from 'react-dom/client'
import { initMercadoPago } from '@mercadopago/sdk-react'
import App from './App.jsx'
import './index.css'

// Public Key: a diferencia del Access Token, esta SÍ está pensada para viajar en el
// bundle del frontend — es la que usa el SDK para tokenizar tarjetas en el navegador
// sin que el número de tarjeta pase nunca por nuestro servidor.
initMercadoPago('APP_USR-af288f66-58d1-4a4b-982b-cdaae5415a54', { locale: 'es-AR' });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

