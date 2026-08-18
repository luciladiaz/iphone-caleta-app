// Set de íconos lineales, mismo estilo que el sidebar (Layout.jsx): stroke
// currentColor, sin relleno, trazo 1.75. Reemplazan a los emoji sueltos que
// había en las páginas, para que toda la app use un único lenguaje visual.

const SA = { fill: 'none', stroke: 'currentColor', strokeWidth: '1.75', strokeLinecap: 'round', strokeLinejoin: 'round' };

function Svg({ size = 18, style, children }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} style={{ flexShrink: 0, ...style }} {...SA}>{children}</svg>;
}

export const IconTag = (p) => <Svg {...p}><path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24H4a1 1 0 00-1 1v5.59a2 2 0 00.59 1.41l9.58 9.59a2 2 0 002.83 0l4.59-4.59a2 2 0 000-2.83z" /><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" /></Svg>;
export const IconBox = (p) => <Svg {...p}><path d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></Svg>;
export const IconHash = (p) => <Svg {...p}><path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" /></Svg>;
export const IconCoin = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9 9.5c0-1.1 1.3-2 3-2s3 .9 3 2-1.3 1.5-3 1.5-3 .4-3 1.5 1.3 2 3 2 3-.9 3-2" /></Svg>;
export const IconBattery = (p) => <Svg {...p}><rect x="2" y="7" width="17" height="10" rx="2" /><path d="M22 10v4" /><path d="M6 10.5v3" stroke="currentColor" /></Svg>;
export const IconCard = (p) => <Svg {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></Svg>;
export const IconCalculator = (p) => <Svg {...p}><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01" /></Svg>;
export const IconLink = (p) => <Svg {...p}><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></Svg>;
export const IconShare = (p) => <Svg {...p}><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" /><path d="M16 6l-4-4-4 4M12 2v14" /></Svg>;
export const IconEdit = (p) => <Svg {...p}><path d="M11 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-5" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" /></Svg>;
export const IconTrash = (p) => <Svg {...p}><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6h14z" /><path d="M10 11v6M14 11v6" /></Svg>;
export const IconCheck = (p) => <Svg {...p}><path d="M20 6L9 17l-5-5" /></Svg>;
export const IconCheckCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Svg>;
export const IconX = (p) => <Svg {...p}><path d="M18 6L6 18M6 6l12 12" /></Svg>;
export const IconXCircle = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5l5 5M14.5 9.5l-5 5" /></Svg>;
export const IconCalendar = (p) => <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></Svg>;
export const IconUser = (p) => <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5" /></Svg>;
export const IconPin = (p) => <Svg {...p}><path d="M12 21s7-6.5 7-11.5A7 7 0 105 9.5C5 14.5 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.3" /></Svg>;
export const IconWarning = (p) => <Svg {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5h.01" /></Svg>;
export const IconCart = (p) => <Svg {...p}><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none" /><circle cx="18" cy="20" r="1.4" fill="currentColor" stroke="none" /><path d="M2.5 3h2.5l2.3 12.2a2 2 0 002 1.8h8.1a2 2 0 002-1.7L21 8H6" /></Svg>;
export const IconHandshake = (p) => <Svg {...p}><path d="M2 12l4-4 4 3 3-3 3 3h4l2-2" /><path d="M6 12l4 5 3-2 3 2 4-5" /></Svg>;
export const IconChart = (p) => <Svg {...p}><path d="M3 21V9M9 21V3M15 21v-7M21 21V6" /></Svg>;
export const IconTrendUp = (p) => <Svg {...p}><polyline points="3 17 9 11 13 15 21 7" /><polyline points="15 7 21 7 21 13" /></Svg>;
export const IconTrendDown = (p) => <Svg {...p}><polyline points="3 7 9 13 13 9 21 17" /><polyline points="15 17 21 17 21 11" /></Svg>;
export const IconWallet = (p) => <Svg {...p}><path d="M3 7a2 2 0 012-2h13a1 1 0 011 1v3" /><path d="M3 7v10a2 2 0 002 2h15a1 1 0 001-1v-6a1 1 0 00-1-1h-4a2 2 0 000 4h4" /></Svg>;
export const IconTruck = (p) => <Svg {...p}><rect x="1" y="7" width="14" height="10" rx="1" /><path d="M15 10h4l3 3v4h-7z" /><circle cx="6" cy="19" r="1.6" /><circle cx="17.5" cy="19" r="1.6" /></Svg>;
export const IconGear = (p) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V20a2 2 0 11-4 0v-.2a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H4a2 2 0 110-4h.2a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H10a1.7 1.7 0 001-1.6V4a2 2 0 114 0v.2a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V10a1.7 1.7 0 001.6 1H20a2 2 0 110 4h-.2a1.7 1.7 0 00-1.6 1z" /></Svg>;
export const IconBell = (p) => <Svg {...p}><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></Svg>;
export const IconPackage = (p) => <Svg {...p}><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" /></Svg>;
export const IconPhone = (p) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></Svg>;
export const IconMail = (p) => <Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 6 10-6" /></Svg>;
export const IconClock = (p) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></Svg>;
export const IconSearch = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></Svg>;
export const IconPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IconLock = (p) => <Svg {...p}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></Svg>;
export const IconReceipt = (p) => <Svg {...p}><path d="M6 2h12v19l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></Svg>;
export const IconSignature = (p) => <Svg {...p}><path d="M3 17c2-6 4-9 6-9s2 4 4 4 3-4 5-4 2.5 3 3 5" /><path d="M3 21h18" /></Svg>;
export const IconFile = (p) => <Svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></Svg>;
export const IconArrowSwap = (p) => <Svg {...p}><path d="M7 4v13m0 0l-3-3m3 3l3-3M17 20V7m0 0l3 3m-3-3l-3 3" /></Svg>;
export const IconMenu = (p) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const IconDownload = (p) => <Svg {...p}><path d="M12 3v12m0 0l-4-4m4 4l4-4" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></Svg>;
export const IconSave = (p) => <Svg {...p}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></Svg>;
export const IconWrench = (p) => <Svg {...p}><path d="M14.7 6.3a4 4 0 00-5.6 4.6L3 17l4 4 6.1-6.1a4 4 0 004.6-5.6l-2.8 2.8-2.4-.6-.6-2.4z" /></Svg>;
export const IconCamera = (p) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="14" r="4" /></Svg>;
export const IconSun = (p) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>;
export const IconMoon = (p) => <Svg {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Svg>;
export const IconRefresh = (p) => <Svg {...p}><path d="M21 12a9 9 0 01-15.3 6.4L3 15.5M3 12a9 9 0 0115.3-6.4L21 8.5" /><path d="M3 4v5h5M21 20v-5h-5" /></Svg>;
