process.env.NODE_ENV = 'test';

const {
  calcularPorcentaje,
  puedeMarcarComoVisto,
  calcularEstadoCurriculum,
  calcularEstadoUnidad,
} = require('../src/services/curriculum.service');

// Dos unidades de dos capítulos cada una, ya en el orden que devolvería
// courseChapter.model.listByCourse (unidad→capítulo).
const CAPITULOS = [
  { id: 1, unit_id: 10, orden: 0 },
  { id: 2, unit_id: 10, orden: 1 },
  { id: 3, unit_id: 20, orden: 0 },
  { id: 4, unit_id: 20, orden: 1 },
];

describe('curriculum.service — calcularPorcentaje', () => {
  test('calcula el porcentaje entero visto', () => {
    expect(calcularPorcentaje(80, 100)).toBe(80);
    expect(calcularPorcentaje(85, 100)).toBe(85);
    expect(calcularPorcentaje(33, 100)).toBe(33);
  });

  test('nunca pasa de 100 aunque se reporten más segundos que la duración', () => {
    expect(calcularPorcentaje(150, 100)).toBe(100);
  });

  test('devuelve 0 si todavía no hay duración conocida (evita división por cero)', () => {
    expect(calcularPorcentaje(50, 0)).toBe(0);
    expect(calcularPorcentaje(50, null)).toBe(0);
  });
});

describe('curriculum.service — puedeMarcarComoVisto', () => {
  test('con exigir80 en true, hace falta al menos 80%', () => {
    expect(puedeMarcarComoVisto(79, true)).toBe(false);
    expect(puedeMarcarComoVisto(80, true)).toBe(true);
    expect(puedeMarcarComoVisto(100, true)).toBe(true);
  });

  test('con exigir80 en false, se puede marcar como visto en cualquier momento', () => {
    expect(puedeMarcarComoVisto(0, false)).toBe(true);
    expect(puedeMarcarComoVisto(50, false)).toBe(true);
  });
});

describe('curriculum.service — modo libre', () => {
  test('todos los capítulos están siempre desbloqueados, sin importar el progreso', () => {
    const { capitulos, porcentaje_curso: porcentajeCurso } = calcularEstadoCurriculum(CAPITULOS, [], 'libre');
    expect(capitulos.every((c) => c.desbloqueado)).toBe(true);
    expect(porcentajeCurso).toBe(0);
  });
});

describe('curriculum.service — modo continuo', () => {
  test('solo el primer capítulo del curso arranca desbloqueado', () => {
    const { capitulos } = calcularEstadoCurriculum(CAPITULOS, [], 'continuo');
    expect(capitulos.map((c) => c.desbloqueado)).toEqual([true, false, false, false]);
  });

  test('completar un capítulo desbloquea SOLO el siguiente en la lista global, cruzando unidades', () => {
    const progreso = [
      { chapter_id: 1, completado: true, porcentaje_visto: 100, segundos_vistos_max: 100 },
      { chapter_id: 2, completado: true, porcentaje_visto: 100, segundos_vistos_max: 100 },
    ];
    const { capitulos } = calcularEstadoCurriculum(CAPITULOS, progreso, 'continuo');
    // Capítulo 3 (primero de la unidad 20) recién se desbloquea al haber
    // completado el 2 (último de la unidad 10) — no antes.
    expect(capitulos.find((c) => c.id === 3).desbloqueado).toBe(true);
    expect(capitulos.find((c) => c.id === 4).desbloqueado).toBe(false);
  });

  test('completar solo el primero NO desbloquea el tercero (no se puede saltear el segundo)', () => {
    const progreso = [{ chapter_id: 1, completado: true, porcentaje_visto: 100, segundos_vistos_max: 100 }];
    const { capitulos } = calcularEstadoCurriculum(CAPITULOS, progreso, 'continuo');
    expect(capitulos.find((c) => c.id === 2).desbloqueado).toBe(true);
    expect(capitulos.find((c) => c.id === 3).desbloqueado).toBe(false);
  });
});

describe('curriculum.service — modo por_unidad', () => {
  test('el primer capítulo de CADA unidad está desbloqueado de entrada, sin tocar nada', () => {
    const { capitulos } = calcularEstadoCurriculum(CAPITULOS, [], 'por_unidad');
    expect(capitulos.find((c) => c.id === 1).desbloqueado).toBe(true); // 1ro de unidad 10
    expect(capitulos.find((c) => c.id === 3).desbloqueado).toBe(true); // 1ro de unidad 20
    expect(capitulos.find((c) => c.id === 2).desbloqueado).toBe(false); // 2do de unidad 10
    expect(capitulos.find((c) => c.id === 4).desbloqueado).toBe(false); // 2do de unidad 20
  });

  test('completar el primer capítulo de una unidad desbloquea el segundo DE ESA MISMA unidad, sin afectar la otra', () => {
    const progreso = [{ chapter_id: 1, completado: true, porcentaje_visto: 100, segundos_vistos_max: 100 }];
    const { capitulos } = calcularEstadoCurriculum(CAPITULOS, progreso, 'por_unidad');
    expect(capitulos.find((c) => c.id === 2).desbloqueado).toBe(true);
    expect(capitulos.find((c) => c.id === 4).desbloqueado).toBe(false); // la unidad 20 sigue igual
  });
});

describe('curriculum.service — calcularEstadoUnidad', () => {
  test('recorta el resultado a los capítulos de una sola unidad y calcula su propio porcentaje', () => {
    const progreso = [{ chapter_id: 1, completado: true, porcentaje_visto: 100, segundos_vistos_max: 100 }];
    const { capitulos, porcentaje_unidad: porcentajeUnidad } = calcularEstadoUnidad(10, CAPITULOS, progreso, 'por_unidad');
    expect(capitulos.map((c) => c.id)).toEqual([1, 2]);
    expect(porcentajeUnidad).toBe(50);
  });
});
