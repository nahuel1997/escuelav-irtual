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
  // Los "general.*" de acá abajo son el diseño/marca actual del sitio
  // (logo, colores, tipografías, favicon) copiados tal cual de esos
  // valores por defecto del frontend, para que quede como punto de
  // partida real de la seed en vez de arrancar en blanco — antes de este
  // cambio site_content no tenía NINGUNA fila "general.*", así que un
  // reseed (FORCE_SEED=true) no tocaba esto (el frontend seguía usando su
  // default hardcodeado), pero tampoco quedaba respaldado como dato.
  await knex('site_content').insert([
    { clave: 'general.logo', tipo: 'imagen', valor: 'data:image/png;base64,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' },
    { clave: 'general.logo_oscuro', tipo: 'imagen', valor: 'data:image/png;base64,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' },
    { clave: 'general.logo.alt', tipo: 'texto', valor: 'AIVIENTO' },
    { clave: 'general.favicon', tipo: 'imagen', valor: 'https://aiviento.com/wp-content/uploads/2026/07/cropped-Favicon-web-32x32.png' },
    { clave: 'general.tipografia.titulos', tipo: 'seleccion', valor: 'syne' },
    { clave: 'general.tipografia.texto', tipo: 'seleccion', valor: 'inter' },
    { clave: 'general.color_primario', tipo: 'color', valor: '#000000' },
    { clave: 'general.color_acento', tipo: 'color', valor: '#a5e84f' },
    { clave: 'general.color_fondo_oscuro', tipo: 'color', valor: '#000000' },
    { clave: 'general.color_texto_oscuro', tipo: 'color', valor: '#ffffff' },
    { clave: 'general.seo.sufijo', tipo: 'texto', valor: 'Escuela Online' },
    { clave: 'general.seo.descripcion_default', tipo: 'texto', valor: 'Plataforma de cursos online con classroom, tareas, logros y creador de CV.' },
    { clave: 'general.zona_horaria', tipo: 'seleccion', valor: 'America/Argentina/Buenos_Aires' },
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
