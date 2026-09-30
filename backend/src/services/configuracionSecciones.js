// Secciones de Admin → Configuración: cada una se guarda como un JSON en
// app_settings (clave `config.<seccion>`), con su valor por defecto y su
// validación — nunca se guarda el body crudo. Agregar una sección nueva es
// sumar una entrada acá.
const { AppError } = require('../middlewares/error.middleware');

const ROLES_MANTENIMIENTO = ['alumno', 'profesor', 'soporte'];

function texto(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function fechaIso(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const SECCIONES = {
  // Modo mantenimiento por rol (el admin nunca queda afuera).
  mantenimiento: {
    publica: true,
    porDefecto: { alumno: false, profesor: false, soporte: false, mensaje: 'Estamos haciendo mejoras. Volvé en un rato.', hasta: null },
    validar(b) {
      const v = { mensaje: texto(b.mensaje, 500) || 'Estamos haciendo mejoras. Volvé en un rato.', hasta: fechaIso(b.hasta) };
      ROLES_MANTENIMIENTO.forEach((r) => { v[r] = Boolean(b[r]); });
      return v;
    },
  },

  // Textos de las páginas de error del sitio (404 y "algo salió mal").
  paginas_error: {
    publica: true,
    porDefecto: {
      titulo404: 'No encontramos esta página',
      texto404: 'Puede que el link esté roto o que la página se haya movido.',
      titulo500: 'Algo salió mal',
      texto500: 'Tuvimos un problema inesperado mostrando esta página. No es algo que hayas hecho vos — podés intentar de nuevo o volver al inicio.',
    },
    validar(b) {
      return {
        titulo404: texto(b.titulo404, 120) || 'No encontramos esta página',
        texto404: texto(b.texto404, 600),
        titulo500: texto(b.titulo500, 120) || 'Algo salió mal',
        texto500: texto(b.texto500, 600),
      };
    },
  },

  // Modo oscuro por inversión de colores (mismo enfoque que DBA24) con
  // intensidad configurable; el usuario lo prende/apaga desde su menú.
  modo_oscuro: {
    publica: true,
    porDefecto: { habilitado: true, porDefectoActivo: false, intensidad: 90, contraste: 95 },
    validar(b) {
      const n = (v, min, max, d) => {
        const x = Number(v);
        return Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : d;
      };
      return {
        habilitado: Boolean(b.habilitado),
        porDefectoActivo: Boolean(b.porDefectoActivo),
        intensidad: n(b.intensidad, 50, 100, 90),
        contraste: n(b.contraste, 70, 120, 95),
      };
    },
  },

  // Feriados: días sin turnos ni recordatorios (se muestran en el calendario).
  feriados: {
    publica: true,
    porDefecto: { dias: [] },
    validar(b) {
      const dias = Array.isArray(b.dias) ? b.dias : [];
      const limpios = dias
        .map((d) => ({ fecha: texto(d.fecha, 10), nombre: texto(d.nombre, 80) }))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && d.nombre);
      if (limpios.length > 200) throw new AppError('Máximo 200 feriados', 400);
      const unicos = new Map(limpios.map((d) => [d.fecha, d]));
      return { dias: [...unicos.values()].sort((a, b2) => a.fecha.localeCompare(b2.fecha)) };
    },
  },

  // Encabezado de los mails: logo propio (distinto del logo del sitio) o texto.
  logo_mail: {
    publica: false,
    porDefecto: { logoUrl: '', texto: 'Escuela Online', colorFondo: '#1c3d5a' },
    validar(b) {
      const logoUrl = texto(b.logoUrl, 500);
      if (logoUrl && !/^(\/uploads\/|https:\/\/)/.test(logoUrl)) throw new AppError('El logo tiene que ser una imagen subida o una URL https', 400);
      return {
        logoUrl,
        texto: texto(b.texto, 80) || 'Escuela Online',
        colorFondo: /^#[0-9a-f]{6}$/i.test(b.colorFondo || '') ? b.colorFondo : '#1c3d5a',
      };
    },
  },
};

module.exports = { SECCIONES, ROLES_MANTENIMIENTO };
