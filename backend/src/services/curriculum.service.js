// =============================================================================
// curriculum.service.js — Toda la lógica de "qué capítulo está desbloqueado
// para este alumno" vive acá, aislada del controller y de la base, para
// poder testearla con Jest pasándole arrays a mano (mismo criterio que
// storage.service.js/payments.service.js: una sola función de la que
// depende todo, fácil de revisar y de testear sin tocar la DB real).
//
// Los tres modos de avance que puede elegir el profesor/admin por curso:
//
//   'libre'      → está todo desbloqueado, el alumno mira en el orden que
//                  quiera.
//   'por_unidad' → el primer capítulo de CADA unidad está siempre
//                  desbloqueado (se puede arrancar cualquier unidad), pero
//                  dentro de una unidad el capítulo N+1 recién se
//                  desbloquea al completar el capítulo N.
//   'continuo'   → estrictamente lineal: solo está desbloqueado el
//                  capítulo siguiente al último completado, en TODO el
//                  curso (unidad tras unidad, sin poder saltar).
//
// En los tres modos, "completar" un capítulo depende de exigir_80_porciento
// (columna del curso): si está en true, hace falta haber visto el 80% del
// video; si está en false, el alumno puede marcarlo como visto en
// cualquier momento.
// =============================================================================

const MODOS_VALIDOS = ['libre', 'por_unidad', 'continuo'];

// A partir del segundo máximo visto y la duración total, calcula el
// porcentaje (0-100, entero). Si todavía no sabemos la duración (el
// reproductor no la reportó), devolvemos 0 en vez de dividir por cero.
function calcularPorcentaje(segundosVistosMax, duracionSegundos) {
  if (!duracionSegundos || duracionSegundos <= 0) return 0;
  const pct = Math.floor((segundosVistosMax / duracionSegundos) * 100);
  return Math.max(0, Math.min(100, pct));
}

// ¿Puede el alumno marcar este capítulo como visto ahora mismo, según el
// progreso guardado y si el curso exige el 80%? Es la validación que se
// usa TANTO en el frontend (para habilitar el botón) COMO en el backend
// (para no confiar ciegamente en lo que mande el cliente).
function puedeMarcarComoVisto(porcentajeVisto, exigir80) {
  if (!exigir80) return true;
  return (porcentajeVisto || 0) >= 80;
}

// Aplana unidades+capítulos ya ordenados (el modelo los devuelve en orden
// unidad→capítulo) en una sola lista, cada capítulo con su progreso
// (completado/porcentaje) pegado, y calcula desbloqueado + anterior/
// siguiente según el modo de avance del curso.
//
// `chapters`: filas de course_chapters con al menos {id, unit_id, orden,
//   unidad_orden} ya ordenadas (ver courseChapter.model.listByCourse).
// `progressList`: filas de chapter_progress del alumno para ESTE curso
//   (ver chapterProgress.model.listByUserAndCourse).
function calcularEstadoCurriculum(chapters, progressList, modoAvance) {
  const modo = MODOS_VALIDOS.includes(modoAvance) ? modoAvance : 'libre';
  const progresoPorCapitulo = new Map(progressList.map((p) => [p.chapter_id, p]));

  const conProgreso = chapters.map((cap) => {
    const progreso = progresoPorCapitulo.get(cap.id);
    return {
      ...cap,
      completado: Boolean(progreso?.completado),
      porcentaje_visto: progreso?.porcentaje_visto || 0,
      segundos_vistos_max: progreso?.segundos_vistos_max || 0,
    };
  });

  const resultado = conProgreso.map((cap, index) => {
    let desbloqueado;

    if (modo === 'libre') {
      desbloqueado = true;
    } else if (modo === 'continuo') {
      const anterior = conProgreso[index - 1];
      desbloqueado = index === 0 || Boolean(anterior?.completado);
    } else {
      // por_unidad: primer capítulo de la unidad siempre abierto; el resto
      // depende de que el capítulo anterior DE LA MISMA UNIDAD esté
      // completado.
      const esPrimeroDeUnidad = index === 0 || conProgreso[index - 1].unit_id !== cap.unit_id;
      if (esPrimeroDeUnidad) {
        desbloqueado = true;
      } else {
        desbloqueado = Boolean(conProgreso[index - 1].completado);
      }
    }

    return {
      ...cap,
      desbloqueado,
      anterior_id: conProgreso[index - 1]?.id ?? null,
      siguiente_id: conProgreso[index + 1]?.id ?? null,
    };
  });

  const total = resultado.length;
  const completados = resultado.filter((c) => c.completado).length;
  const porcentajeCurso = total > 0 ? Math.round((completados / total) * 100) : 0;

  return { capitulos: resultado, total, completados, porcentaje_curso: porcentajeCurso };
}

// Mismo cálculo pero recortado a los capítulos de una sola unidad (para la
// página de detalle de la unidad) — reutiliza calcularEstadoCurriculum con
// TODO el curso (el desbloqueo de 'por_unidad'/'continuo' depende del
// curso entero) y después filtra.
function calcularEstadoUnidad(unitId, chapters, progressList, modoAvance) {
  const { capitulos } = calcularEstadoCurriculum(chapters, progressList, modoAvance);
  const deLaUnidad = capitulos.filter((c) => c.unit_id === unitId);
  const total = deLaUnidad.length;
  const completados = deLaUnidad.filter((c) => c.completado).length;
  const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;
  return { capitulos: deLaUnidad, total, completados, porcentaje_unidad: porcentaje };
}

module.exports = {
  MODOS_VALIDOS,
  calcularPorcentaje,
  puedeMarcarComoVisto,
  calcularEstadoCurriculum,
  calcularEstadoUnidad,
};
