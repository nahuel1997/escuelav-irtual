const vacioExperiencia = { puesto: '', empresa: '', periodo: '', descripcion: '' };
const vacioEducacion = { titulo: '', institucion: '', periodo: '' };
const vacioIdioma = { idioma: '', nivel: '' };

export { vacioExperiencia, vacioEducacion, vacioIdioma };

function actualizarLista(setter, lista, index, campo, valor) {
  const copia = [...lista];
  copia[index] = { ...copia[index], [campo]: valor };
  setter(copia);
}

// Campos compartidos del CV: Datos personales, Experiencia laboral,
// Educación, Habilidades e Idiomas. Lo usan tanto el Creador de CV
// (CvBuilder.jsx, que además genera el PDF / CV para IA) como la pantalla
// de "Mis datos de CV" (CvDatos.jsx, que solo edita y guarda). Extraído acá
// para no duplicar el formulario entre las dos pantallas — todo el estado
// vive en el componente padre, este componente solo renderiza los campos.
export default function CvDatosForm({
  datosPersonales, setDatosPersonales,
  experiencia, setExperiencia,
  educacion, setEducacion,
  habilidadesTexto, setHabilidadesTexto,
  idiomas, setIdiomas,
}) {
  return (
    <>
      <h3>Datos personales</h3>
      <div className="grid grid-2" style={{ gap: 12 }}>
        <div className="field">
          <label>Nombre completo</label>
          <input value={datosPersonales.nombreCompleto} onChange={(e) => setDatosPersonales({ ...datosPersonales, nombreCompleto: e.target.value })} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={datosPersonales.email} onChange={(e) => setDatosPersonales({ ...datosPersonales, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input value={datosPersonales.telefono} onChange={(e) => setDatosPersonales({ ...datosPersonales, telefono: e.target.value })} />
        </div>
        <div className="field">
          <label>Ubicación</label>
          <input value={datosPersonales.ubicacion} onChange={(e) => setDatosPersonales({ ...datosPersonales, ubicacion: e.target.value })} />
        </div>
        <div className="field">
          <label>LinkedIn (opcional)</label>
          <input value={datosPersonales.linkedin} onChange={(e) => setDatosPersonales({ ...datosPersonales, linkedin: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>Resumen profesional</label>
        <textarea rows={3} value={datosPersonales.resumenProfesional} onChange={(e) => setDatosPersonales({ ...datosPersonales, resumenProfesional: e.target.value })} />
      </div>

      <h3 style={{ marginTop: 24 }}>Experiencia laboral</h3>
      {experiencia.map((exp, i) => (
        <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
          <input placeholder="Puesto" value={exp.puesto} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'puesto', e.target.value)} />
          <input placeholder="Empresa" value={exp.empresa} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'empresa', e.target.value)} />
          <input placeholder="Período (ej: 2022 - 2024)" value={exp.periodo} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'periodo', e.target.value)} />
          <input placeholder="Descripción breve" value={exp.descripcion} onChange={(e) => actualizarLista(setExperiencia, experiencia, i, 'descripcion', e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setExperiencia([...experiencia, { ...vacioExperiencia }])}>
        + Agregar experiencia
      </button>

      <h3 style={{ marginTop: 24 }}>Educación</h3>
      {educacion.map((ed, i) => (
        <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
          <input placeholder="Título / carrera" value={ed.titulo} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'titulo', e.target.value)} />
          <input placeholder="Institución" value={ed.institucion} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'institucion', e.target.value)} />
          <input placeholder="Período" value={ed.periodo} onChange={(e) => actualizarLista(setEducacion, educacion, i, 'periodo', e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEducacion([...educacion, { ...vacioEducacion }])}>
        + Agregar educación
      </button>

      <h3 style={{ marginTop: 24 }}>Habilidades</h3>
      <div className="field">
        <label>Separadas por coma</label>
        <input placeholder="JavaScript, Trabajo en equipo, Excel avanzado" value={habilidadesTexto} onChange={(e) => setHabilidadesTexto(e.target.value)} />
      </div>

      <h3 style={{ marginTop: 24 }}>Idiomas</h3>
      {idiomas.map((idi, i) => (
        <div key={i} className="grid grid-2" style={{ gap: 12, marginBottom: 8 }}>
          <input placeholder="Idioma" value={idi.idioma} onChange={(e) => actualizarLista(setIdiomas, idiomas, i, 'idioma', e.target.value)} />
          <input placeholder="Nivel" value={idi.nivel} onChange={(e) => actualizarLista(setIdiomas, idiomas, i, 'nivel', e.target.value)} />
        </div>
      ))}
      <button type="button" className="btn btn-outline btn-sm" onClick={() => setIdiomas([...idiomas, { ...vacioIdioma }])}>
        + Agregar idioma
      </button>
    </>
  );
}
