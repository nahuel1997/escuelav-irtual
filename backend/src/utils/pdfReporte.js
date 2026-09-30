// Generador simple de reportes PDF con pdfkit (sin navegador: ~decenas de
// ms por PDF, mismo criterio que la migración a pdfkit de DBA24). Arma un
// documento con encabezado, secciones, pares clave/valor y tablas, y
// devuelve un Buffer. Lo usan Estado de la app, Tráfico, Versiones,
// Reportes y las observaciones del Tester.
const PDFDocument = require('pdfkit');

const COLOR_PRIMARIO = '#1c3d5a';
const COLOR_MUTED = '#5b6470';
const COLOR_BORDE = '#d9dee5';

function texto(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}

/**
 * bloques: [
 *   { tipo: 'titulo', texto },
 *   { tipo: 'parrafo', texto },
 *   { tipo: 'pares', filas: [[clave, valor], ...] },
 *   { tipo: 'tabla', columnas: [{ titulo, ancho }], filas: [[...], ...] },
 *   { tipo: 'lista', items: [...] },
 * ]
 */
function generarPdf({ titulo, subtitulo, bloques = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true, info: { Title: titulo } });
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const anchoUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fillColor(COLOR_PRIMARIO).font('Helvetica-Bold').fontSize(18).text(titulo);
    doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(10)
      .text(`${subtitulo ? `${subtitulo} · ` : ''}Generado el ${new Date().toLocaleString('es-AR')}`);
    doc.moveDown(1);

    function asegurarLugar(alto) {
      if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    }

    for (const b of bloques) {
      if (b.tipo === 'titulo') {
        asegurarLugar(40);
        doc.moveDown(0.6).fillColor(COLOR_PRIMARIO).font('Helvetica-Bold').fontSize(13).text(b.texto);
        doc.moveDown(0.3);
      } else if (b.tipo === 'parrafo') {
        doc.fillColor('#1a1f26').font('Helvetica').fontSize(10).text(texto(b.texto), { width: anchoUtil });
        doc.moveDown(0.4);
      } else if (b.tipo === 'lista') {
        doc.fillColor('#1a1f26').font('Helvetica').fontSize(10);
        (b.items || []).forEach((it) => doc.text(`•  ${texto(it)}`, { width: anchoUtil, indent: 6 }));
        doc.moveDown(0.4);
      } else if (b.tipo === 'pares') {
        for (const [k, v] of b.filas || []) {
          asegurarLugar(16);
          const y = doc.y;
          doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(10).text(texto(k), doc.page.margins.left, y, { width: anchoUtil * 0.4 });
          doc.fillColor('#1a1f26').font('Helvetica-Bold').text(texto(v), doc.page.margins.left + anchoUtil * 0.4, y, { width: anchoUtil * 0.6 });
          doc.moveDown(0.15);
        }
        doc.moveDown(0.4);
      } else if (b.tipo === 'tabla') {
        const cols = b.columnas || [];
        const totalAncho = cols.reduce((s, c) => s + (c.ancho || 1), 0);
        const anchos = cols.map((c) => ((c.ancho || 1) / totalAncho) * anchoUtil);
        const dibujarFila = (celdas, negrita) => {
          doc.font(negrita ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
          const alto = Math.max(...celdas.map((c, i) => doc.heightOfString(texto(c), { width: anchos[i] - 6 }))) + 6;
          asegurarLugar(alto);
          const y = doc.y;
          let x = doc.page.margins.left;
          celdas.forEach((c, i) => {
            doc.fillColor(negrita ? COLOR_PRIMARIO : '#1a1f26').text(texto(c), x + 3, y + 3, { width: anchos[i] - 6 });
            x += anchos[i];
          });
          doc.moveTo(doc.page.margins.left, y + alto).lineTo(doc.page.margins.left + anchoUtil, y + alto).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();
          doc.y = y + alto;
        };
        dibujarFila(cols.map((c) => c.titulo), true);
        (b.filas || []).forEach((f) => dibujarFila(f, false));
        if (!(b.filas || []).length) {
          doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(9).text('Sin datos.', doc.page.margins.left + 3, doc.y + 4);
        }
        doc.x = doc.page.margins.left;
        doc.moveDown(0.8);
      }
    }

    // Numeración de páginas.
    const rango = doc.bufferedPageRange();
    for (let i = rango.start; i < rango.start + rango.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor(COLOR_MUTED).font('Helvetica').fontSize(8)
        .text(`Página ${i + 1} de ${rango.count}`, doc.page.margins.left, doc.page.height - 32, { width: anchoUtil, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

function enviarPdf(res, buffer, nombre) {
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${nombre}"`);
  res.send(buffer);
}

module.exports = { generarPdf, enviarPdf };
