const bcrypt = require('bcryptjs');

// Seed de datos de ejemplo para poder probar la app apenas se clona.
// Correr con: npm run seed
//
// ATENCIÓN — este seed es DESTRUCTIVO a propósito: borra usuarios, cursos,
// turnos, logros y TODO el contenido del sitio (colores, fuentes, logo,
// textos editados desde /admin-panel/contenido) y los reemplaza por los 3
// usuarios demo y un puñado de textos por defecto. Tiene sentido correrlo
// una sola vez, en una instalación nueva y vacía — no como parte de un
// "npm install de nuevo" en una app que ya se usó y ya se personalizó.
//
// Por eso, si ya hay usuarios cargados, el seed se cancela solo (no borra
// nada) salvo que se lo fuerce explícitamente con FORCE_SEED=true. Esto
// pasó una vez sin este guard: se corrió `npm run seed` sobre una base ya
// personalizada (colores, textos, cuentas reales) y se perdió todo sin
// aviso — de ahí este chequeo.
exports.seed = async function (knex) {
  const yaHayDatos = await knex('users').first();
  if (yaHayDatos && process.env.FORCE_SEED !== 'true') {
    console.log('');
    console.log('⚠️  Seed de datos de ejemplo CANCELADO: ya hay usuarios cargados en la base.');
    console.log('   Este seed borra TODO (usuarios, cursos, turnos, logros y el contenido');
    console.log('   del sitio: colores, fuentes, logo, textos) y lo reemplaza por los 3');
    console.log('   usuarios demo — solo tiene sentido en una instalación nueva y vacía.');
    console.log('   Si de verdad querés reiniciar todo a los datos demo (se pierde lo');
    console.log('   personalizado, sin vuelta atrás), corré en PowerShell:');
    console.log('     $env:FORCE_SEED="true"; npm run seed');
    console.log('');
    return;
  }

  // Limpiamos en orden inverso a las FK.
  await knex('site_content').del();
  await knex('calendar_events').del();
  await knex('user_achievements').del();
  await knex('submissions').del();
  await knex('assignments').del();
  await knex('enrollments').del();
  await knex('chapter_progress').del();
  await knex('chapter_comments').del();
  await knex('chapter_files').del();
  await knex('course_chapters').del();
  await knex('course_units').del();
  await knex('courses').del();
  await knex('achievements').del();
  await knex('users').del();

  const passwordHash = await bcrypt.hash('123456', 10);

  const [adminId] = await knex('users').insert({
    nombre: 'Admin',
    apellido: 'Escuela',
    email: 'admin@escuela.demo',
    password_hash: passwordHash,
    rol: 'admin',
  });

  const [profesorId] = await knex('users').insert({
    nombre: 'Laura',
    apellido: 'Gómez',
    email: 'profesora@escuela.demo',
    password_hash: passwordHash,
    rol: 'profesor',
  });

  const [alumnoId] = await knex('users').insert({
    nombre: 'Juan',
    apellido: 'Pérez',
    email: 'alumno@escuela.demo',
    password_hash: passwordHash,
    rol: 'alumno',
  });

  // Catálogo enfocado 100% en IA aplicada a oficinas: uso de asistentes de
  // IA en el trabajo diario, automatización de tareas repetitivas (con un
  // capítulo que ya presenta la idea de "orquestar" varios agentes, en
  // línea con el sandbox de agentes de la plataforma) y, como tercer
  // curso, cómo se conecta una herramienta de IA a un LMS y se usa desde
  // adentro (LTI, passback de notas) — mismo tema que la integración LTI
  // real del backend, para que el contenido teórico y la funcionalidad
  // técnica de la plataforma se refuercen entre sí.
  const idOf = (row) => (row && typeof row === 'object' ? row.id : row);

  const cursosInsertados = await knex('courses')
    .insert([
      {
        titulo: 'IA para la oficina: herramientas y fundamentos',
        descripcion: 'Usá ChatGPT, Copilot y Gemini en tu trabajo diario: redacción, emails, resúmenes de reuniones y análisis de datos con prompts efectivos.',
        precio: 15000,
        categoria: 'Inteligencia Artificial',
        imagen_url: '',
        profesor_id: profesorId,
      },
      {
        titulo: 'Automatización de procesos de oficina con IA',
        descripcion: 'Identificá qué tareas repetitivas de tu oficina se pueden automatizar y dá tus primeros pasos orquestando varios agentes de IA para que trabajen juntos.',
        precio: 22000,
        categoria: 'Inteligencia Artificial',
        imagen_url: '',
        profesor_id: profesorId,
      },
      {
        titulo: 'Conectando la IA a tu LMS: integraciones y uso práctico',
        descripcion: 'Cómo se integra una herramienta de IA a un LMS (Moodle, Canvas, Google Classroom) con el estándar LTI, y cómo se usa después en el día a día.',
        precio: 18000,
        categoria: 'Inteligencia Artificial',
        imagen_url: '',
        profesor_id: profesorId,
      },
    ])
    .returning('id');

  const [cursoHerramientasId, cursoAutomatizacionId, cursoLmsId] = cursosInsertados.map(idOf);

  // --- Temario: curso 1, "IA para la oficina: herramientas y fundamentos" ---
  const [unidadHerramientas1] = (await knex('course_units').insert({
    course_id: cursoHerramientasId,
    titulo: 'Unidad 1: Primeros pasos con asistentes de IA en la oficina',
    introduccion: 'Arrancamos por lo básico: qué es un asistente de IA, en qué se parecen y en qué difieren ChatGPT, Copilot y Gemini, y cómo escribir pedidos (prompts) que realmente te ahorren tiempo.',
    contenido: 'Qué es un asistente de IA y para qué sirve en tu trabajo diario\nChatGPT, Copilot y Gemini: comparación y cuándo usar cada uno\nCómo escribir prompts efectivos para tareas de oficina',
    orden: 1,
  }).returning('id')).map(idOf);

  const [unidadHerramientas2] = (await knex('course_units').insert({
    course_id: cursoHerramientasId,
    titulo: 'Unidad 2: IA aplicada a tareas administrativas',
    introduccion: 'Con las bases claras, vamos a las tareas de todos los días: escribir y corregir documentos, resumir reuniones y trabajar con planillas usando IA como asistente.',
    contenido: 'Redacción y corrección de emails y documentos con IA\nResúmenes de reuniones y actas automáticas\nAnálisis de planillas y datos con IA (Excel/Sheets + IA)',
    orden: 2,
  }).returning('id')).map(idOf);

  await knex('course_chapters').insert([
    { unit_id: unidadHerramientas1, titulo: 'Capítulo 1: Qué es un asistente de IA y para qué sirve en tu trabajo diario', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadHerramientas1, titulo: 'Capítulo 2: ChatGPT, Copilot y Gemini: comparación y cuándo usar cada uno', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
    { unit_id: unidadHerramientas1, titulo: 'Capítulo 3: Cómo escribir prompts efectivos para tareas de oficina', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 3 },
    { unit_id: unidadHerramientas2, titulo: 'Capítulo 1: Redacción y corrección de emails y documentos con IA', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadHerramientas2, titulo: 'Capítulo 2: Resúmenes de reuniones y actas automáticas', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
    { unit_id: unidadHerramientas2, titulo: 'Capítulo 3: Análisis de planillas y datos con IA (Excel/Sheets + IA)', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 3 },
  ]);

  // --- Temario: curso 2, "Automatización de procesos de oficina con IA" ---
  const [unidadAutomatizacion1] = (await knex('course_units').insert({
    course_id: cursoAutomatizacionId,
    titulo: 'Unidad 1: De tareas repetitivas a flujos automatizados',
    introduccion: 'No toda tarea repetitiva conviene automatizarla de la misma forma. Vemos cómo identificar candidatas, una primera introducción a "orquestar" varios agentes de IA trabajando en conjunto (lo vas a poder practicar en el sandbox de agentes de la plataforma) y por qué la supervisión humana sigue siendo clave.',
    contenido: 'Identificar qué tareas de tu oficina se pueden automatizar\nIntroducción a la orquestación de agentes de IA\nBuenas prácticas: supervisión humana y control de errores en automatizaciones',
    orden: 1,
  }).returning('id')).map(idOf);

  const [unidadAutomatizacion2] = (await knex('course_units').insert({
    course_id: cursoAutomatizacionId,
    titulo: 'Unidad 2: Casos prácticos',
    introduccion: 'Dos ejemplos concretos de automatización de oficina de punta a punta, para llevarte una plantilla mental que puedas adaptar a tu propio trabajo.',
    contenido: 'Automatizar la clasificación de correos y tickets de soporte\nGeneración automática de reportes periódicos',
    orden: 2,
  }).returning('id')).map(idOf);

  await knex('course_chapters').insert([
    { unit_id: unidadAutomatizacion1, titulo: 'Capítulo 1: Identificar qué tareas de tu oficina se pueden automatizar', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadAutomatizacion1, titulo: 'Capítulo 2: Introducción a la orquestación de agentes de IA', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
    { unit_id: unidadAutomatizacion1, titulo: 'Capítulo 3: Buenas prácticas: supervisión humana y control de errores', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 3 },
    { unit_id: unidadAutomatizacion2, titulo: 'Capítulo 1: Automatizar la clasificación de correos y tickets de soporte', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadAutomatizacion2, titulo: 'Capítulo 2: Generación automática de reportes periódicos', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
  ]);

  // --- Temario: curso 3, "Conectando la IA a tu LMS: integraciones y uso práctico" ---
  const [unidadLms1] = (await knex('course_units').insert({
    course_id: cursoLmsId,
    titulo: 'Unidad 1: Qué es un LMS y cómo se conecta una herramienta externa',
    introduccion: 'Antes de conectar nada, hay que entender qué es un LMS (Moodle, Canvas, Google Classroom) y cómo funciona el estándar que usan hoy la mayoría de las integraciones externas: LTI.',
    contenido: 'LMS 101: Moodle, Canvas, Google Classroom y para qué sirve conectarlos\nEl estándar LTI: cómo una herramienta externa se integra a un LMS\nSeguridad y datos: qué información se comparte al conectar una integración',
    orden: 1,
  }).returning('id')).map(idOf);

  const [unidadLms2] = (await knex('course_units').insert({
    course_id: cursoLmsId,
    titulo: 'Unidad 2: Usar IA dentro del LMS en el día a día',
    introduccion: 'Con la teoría clara, vemos el flujo real: cómo se lanza la herramienta desde adentro del LMS, cómo vuelven las notas automáticamente y qué hacer cuando algo de la integración falla.',
    contenido: 'Configurar y lanzar una herramienta de IA desde el LMS\nSeguimiento de notas y progreso: passback automático de calificaciones\nErrores comunes al integrar IA en un LMS y cómo resolverlos',
    orden: 2,
  }).returning('id')).map(idOf);

  await knex('course_chapters').insert([
    { unit_id: unidadLms1, titulo: 'Capítulo 1: LMS 101: Moodle, Canvas, Google Classroom y para qué sirve conectarlos', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadLms1, titulo: 'Capítulo 2: El estándar LTI: cómo una herramienta externa se integra a un LMS', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
    { unit_id: unidadLms1, titulo: 'Capítulo 3: Seguridad y datos: qué información se comparte al conectar una integración', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 3 },
    { unit_id: unidadLms2, titulo: 'Capítulo 1: Configurar y lanzar una herramienta de IA desde el LMS', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 1 },
    { unit_id: unidadLms2, titulo: 'Capítulo 2: Seguimiento de notas y progreso: passback automático de calificaciones', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 2 },
    { unit_id: unidadLms2, titulo: 'Capítulo 3: Errores comunes al integrar IA en un LMS y cómo resolverlos', video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', orden: 3 },
  ]);

  const primerCursoId = cursoHerramientasId;

  await knex('enrollments').insert({
    user_id: alumnoId,
    course_id: primerCursoId,
    payment_status: 'pagado',
    payment_method: 'simulado',
    transaction_id: 'SIM-DEMO-0001',
  });

  await knex('assignments').insert({
    course_id: primerCursoId,
    profesor_id: profesorId,
    titulo: 'Ejercicio: escribí 5 prompts para tareas de tu oficina',
    descripcion: 'Elegí 5 tareas administrativas que hagas seguido (emails, resúmenes, planillas, etc.) y escribí el prompt exacto que le darías a un asistente de IA para cada una.',
    fecha_entrega: knex.fn.now(),
  });

  await knex('achievements').insert([
    { codigo: 'primer_curso', titulo: 'Primeros pasos', descripcion: 'Te inscribiste a tu primer curso', icono: '🚀' },
    { codigo: 'primera_entrega', titulo: 'Manos a la obra', descripcion: 'Entregaste tu primera tarea', icono: '📝' },
    { codigo: 'curso_completado', titulo: 'Curso completado', descripcion: 'Completaste un curso entero', icono: '🎓' },
  ]);

  // Un par de turnos de calendario de ejemplo: uno pendiente (para probar
  // el flujo de aceptar/rechazar) y uno ya aceptado (para ver cómo se
  // evita la superposición de horarios si se pide otro que se cruce).
  const mañana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pasadoMañana = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await knex('calendar_events').insert([
    {
      alumno_id: alumnoId,
      profesor_id: profesorId,
      course_id: primerCursoId,
      motivo: 'Dudas sobre el ejercicio de la calculadora',
      starts_at: new Date(mañana.setHours(15, 0, 0, 0)),
      ends_at: new Date(mañana.setHours(15, 30, 0, 0)),
      estado: 'pendiente',
    },
    {
      alumno_id: alumnoId,
      profesor_id: profesorId,
      course_id: primerCursoId,
      motivo: 'Repaso general antes del final',
      starts_at: new Date(pasadoMañana.setHours(10, 0, 0, 0)),
      ends_at: new Date(pasadoMañana.setHours(10, 45, 0, 0)),
      estado: 'aceptada',
    },
  ]);

  // Contenido inicial editable del sitio (el admin lo puede pisar desde
  // /admin-panel/contenido). Si una clave no está acá, el frontend usa su
  // propio valor por defecto (ver frontend/src/config/content.js).
  //
  // A propósito, acá abajo NO van filas "general.*" (logo, colores,
  // tipografías, favicon, SEO, zona horaria): un intento anterior de dejar
  // esas filas precargadas con una marca de ejemplo (AIVIENTO) nunca llegó
  // a aplicarse en la base real, así que la base real hoy no tiene NINGUNA
  // fila "general.*" — el sitio muestra el diseño por defecto del frontend
  // (ver frontend/src/config/content.js). Si esta seed insertara esas filas
  // igual, un reseed pisaría ese diseño con la marca de ejemplo sin que el
  // admin lo haya pedido. Si en algún momento se quiere dejar un
  // logo/colores de arranque reales en el seed, hay que cargarlos desde
  // /admin-panel/contenido primero y después reflejar esos valores acá.
  await knex('site_content').insert([
    { clave: 'home.hero.badge', tipo: 'texto', valor: 'Educación online' },
    { clave: 'home.hero.titulo', tipo: 'texto', valor: 'Aprendé a tu ritmo, con seguimiento real de tus profesores' },
    { clave: 'home.hero.subtitulo', tipo: 'texto', valor: 'Cursos, classroom con entrega de tareas, logros y un creador de CV que arma tu currículum con lo que vas aprendiendo en la plataforma.' },
    { clave: 'home.hero.imagen', tipo: 'imagen', valor: '' },
    { clave: 'contacto.email', tipo: 'texto', valor: 'contacto@escuelaonline.demo' },
    { clave: 'contacto.telefono', tipo: 'texto', valor: '+54 11 5555 0000' },
    { clave: 'contacto.ubicacion', tipo: 'texto', valor: 'Buenos Aires, Argentina' },
  ]);

  console.log('Seed cargado. Usuarios demo:');
  console.log('  admin:     admin@escuela.demo / 123456');
  console.log('  profesor:  profesora@escuela.demo / 123456');
  console.log('  alumno:    alumno@escuela.demo / 123456');
};
