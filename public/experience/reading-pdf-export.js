import { buildReadingPdfDocument } from './reading-pdf-document.js';
import { buildReadingPdf, loadReadingPdfFonts } from './reading-pdf.js';

let fontPromise;
/** A real, selectable-text PDF download, never a print dialog or text rename. */
export async function downloadReadingPdf({ reading, input = null, includeBirthData = true, localOnlyCorrection = false } = {}) {
  const document = buildReadingPdfDocument({ reading, input, includeBirthData, localOnlyCorrection });
  fontPromise ||= loadReadingPdfFonts().catch((error) => { fontPromise = null; throw error; });
  const bytes = await buildReadingPdf({ document, fontBytes: await fontPromise });
  const filename = `SAI-${reading.mode}-reading.pdf`;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const href = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = href; link.download = filename; link.style.display = 'none';
  window.document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
  return { filename, bytes };
}
