import jsPDF from 'jspdf';

// Convierte un <canvas> (el recibo ya renderizado con html2canvas) a un Blob de PDF de
// una sola página del mismo tamaño que el canvas — el recibo en su tamaño real, como un
// ticket, no una hoja A4 con márgenes de por medio.
export function canvasAPdfBlob(canvas) {
  const pdf = new jsPDF({
    orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
}
