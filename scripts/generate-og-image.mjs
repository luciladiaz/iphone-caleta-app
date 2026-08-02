import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'fs';

const W = 1200, H = 630;

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e3a5f"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#2563EB" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#2563EB" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- Badge -->
  <rect x="80" y="90" width="330" height="40" rx="20" fill="#2563EB" fill-opacity="0.15" stroke="#2563EB" stroke-opacity="0.5"/>
  <text x="100" y="116" font-family="Arial, sans-serif" font-size="18" font-weight="600" fill="#7DD3FC">Diseñado para el mercado argentino</text>

  <!-- Headline -->
  <text x="78" y="220" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">El sistema que necesita</text>
  <text x="78" y="290" font-family="Arial, sans-serif" font-size="58" font-weight="800" fill="#ffffff">todo <tspan fill="#7DD3FC">revendedor de iPhone</tspan></text>

  <!-- Subheadline -->
  <text x="80" y="350" font-family="Arial, sans-serif" font-size="26" fill="#94a3b8">Stock, ventas, cobros y ganancias en un solo lugar</text>

  <!-- Features pills -->
  <g font-family="Arial, sans-serif" font-size="18" fill="#ebebf5">
    <rect x="80" y="400" width="150" height="44" rx="22" fill="#1e293b" stroke="#2563EB" stroke-opacity="0.3"/>
    <text x="105" y="428">Multi-moneda</text>

    <rect x="245" y="400" width="130" height="44" rx="22" fill="#1e293b" stroke="#2563EB" stroke-opacity="0.3"/>
    <text x="270" y="428">Cuotas</text>

    <rect x="390" y="400" width="150" height="44" rx="22" fill="#1e293b" stroke="#2563EB" stroke-opacity="0.3"/>
    <text x="415" y="428">Catálogo WhatsApp</text>
  </g>

  <!-- CTA pill -->
  <rect x="80" y="470" width="290" height="56" rx="28" fill="#2563EB"/>
  <text x="115" y="506" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">Empezá gratis - 7 días</text>

  <!-- Footer brand -->
  <circle cx="105" cy="580" r="16" fill="#ffffff" fill-opacity="0.9"/>
  <text x="130" y="587" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">ReventApp</text>
  <text x="920" y="587" font-family="Arial, sans-serif" font-size="18" fill="#64748b">reventapp.com.ar</text>
</svg>
`;

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true, defaultFontFamily: 'Arial' },
});
const png = resvg.render().asPng();
writeFileSync(new URL('../public/og-image.png', import.meta.url), png);
console.log('OK: public/og-image.png regenerado', png.length, 'bytes');
