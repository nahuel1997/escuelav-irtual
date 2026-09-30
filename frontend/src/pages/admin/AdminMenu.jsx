import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { armarMenu } from '../../config/menuAdmin';

// Admin → Menú del panel (portado de menu-config de DBA24): renombrar y
// reordenar secciones, mover ítems entre secciones, cambiarles el nombre y
// ocultarlos. "Menú del panel" no se puede ocultar.
export default function AdminMenu() {
  const [secciones, setSecciones] = useState(null);
  const [estado, setEstado] = useState('');

  useEffect(() => { api.get('/admin/menu').then((d) => setSecciones(armarMenu(d.menu))); }, []);

  function mover(lista, i, delta) {
    const j = i + delta;
    if (j < 0 || j >= lista.length) return lista;
    const copia = [...lista];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  }

  const setSeccion = (si, patch) => setSecciones((ss) => ss.map((s, i) => (i === si ? { ...s, ...patch } : s)));
  const setItem = (si, ii, patch) => setSeccion(si, { items: secciones[si].items.map((it, i) => (i === ii ? { ...it, ...patch } : it)) });

  function moverItemASeccion(si, ii, destino) {
    const item = secciones[si].items[ii];
    setSecciones((ss) => ss.map((s, i) => {
      if (i === si) return { ...s, items: s.items.filter((_, k) => k !== ii) };
      if (i === destino) return { ...s, items: [...s.items, item] };
      return s;
    }));
  }

  async function guardar() {
    setEstado('guardando');
    try {
      await api.put('/admin/menu', { secciones: secciones.filter((s) => s.items.length).map((s) => ({ nombre: s.nombre, items: s.items.map(({ ruta, titulo, visible }) => ({ ruta, titulo, visible })) })) });
      window.dispatchEvent(new Event('admin:menu-cambiado'));
      setEstado('ok');
      setTimeout(() => setEstado(''), 2500);
    } catch (e) {
      setEstado(e.message);
    }
  }

  async function restaurar() {
    if (!window.confirm('¿Volver al menú de fábrica? Se pierden los cambios.')) return;
    await api.delete('/admin/menu');
    setSecciones(armarMenu(null));
    window.dispatchEvent(new Event('admin:menu-cambiado'));
  }

  if (!secciones) return <p className="text-muted">Cargando…</p>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ margin: 0 }}>Menú del panel</h1>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Ordená, renombrá y ocultá las secciones del menú de la izquierda.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setSecciones([...secciones, { nombre: 'Nueva sección', items: [] }])}>+ Sección</button>
          <button className="btn btn-outline btn-sm" onClick={restaurar}>Volver al de fábrica</button>
          <button className="btn btn-primary btn-sm" onClick={guardar} disabled={estado === 'guardando'}>Guardar</button>
        </div>
      </div>
      {estado && estado !== 'guardando' && <div className={`alert ${estado === 'ok' ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 12 }}>{estado === 'ok' ? 'Menú guardado.' : estado}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16, marginTop: 16 }}>
        {secciones.map((s, si) => (
          <div key={si} className="card" style={{ margin: 0 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input value={s.nombre} onChange={(e) => setSeccion(si, { nombre: e.target.value })} style={{ fontWeight: 700, flex: 1 }} maxLength={40} aria-label="Nombre de la sección" />
              <button className="btn btn-outline btn-sm" onClick={() => setSecciones(mover(secciones, si, -1))} aria-label="Subir sección">↑</button>
              <button className="btn btn-outline btn-sm" onClick={() => setSecciones(mover(secciones, si, 1))} aria-label="Bajar sección">↓</button>
            </div>
            <table style={{ marginTop: 8 }}>
              <tbody>
                {s.items.map((it, ii) => (
                  <tr key={it.ruta} style={{ opacity: it.visible ? 1 : 0.5 }}>
                    <td><input value={it.titulo} onChange={(e) => setItem(si, ii, { titulo: e.target.value })} maxLength={50} style={{ width: '100%' }} aria-label={`Nombre de ${it.ruta}`} /></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <label title="Visible"><input type="checkbox" checked={it.visible} disabled={it.ruta === '/admin-panel/menu'} onChange={(e) => setItem(si, ii, { visible: e.target.checked })} /> ver</label>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSeccion(si, { items: mover(s.items, ii, -1) })} aria-label="Subir">↑</button>
                      <button className="btn btn-outline btn-sm" onClick={() => setSeccion(si, { items: mover(s.items, ii, 1) })} aria-label="Bajar">↓</button>
                      <select value="" onChange={(e) => e.target.value !== '' && moverItemASeccion(si, ii, Number(e.target.value))} aria-label="Mover a otra sección" style={{ width: 70 }}>
                        <option value="">Mover…</option>
                        {secciones.map((d, di) => di !== si && <option key={di} value={di}>{d.nombre}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
                {s.items.length === 0 && <tr><td className="text-muted">Sección vacía (no se guarda si queda así).</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
