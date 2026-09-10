import { useState } from 'react';
import PlantillasTab from './mails/PlantillasTab';
import ConfiguracionTab from './mails/ConfiguracionTab';
import ListasTab from './mails/ListasTab';
import RegistroTab from './mails/RegistroTab';

const TABS = [
  { id: 'plantillas', label: 'Plantillas' },
  { id: 'configuracion', label: 'Configuración' },
  { id: 'listas', label: 'Listas' },
  { id: 'registro', label: 'Registro de envíos' },
];

// Backoffice de mails: todos los mails automáticos de la plataforma
// (validación de cuenta, bienvenida, carrito abandonado, confirmación de
// compra, te extrañamos, felicitaciones por completar un curso, turnos de
// calendario, recordatorio de turno) y el mail de ofertas/avisos a listas
// armables. Cada tipo de mail vive en la tabla email_templates y se
// dispara desde el código donde corresponde (ver mail.service.js en el
// backend) — acá solo se edita el texto, se configuran los umbrales, se
// arman las listas y se revisa qué se mandó.
export default function AdminMails() {
  const [tab, setTab] = useState('plantillas');

  return (
    <div>
      <h1>Mails</h1>
      <p className="text-muted">
        Validación de cuenta, bienvenida, carrito abandonado, confirmación de compra, "te extrañamos",
        felicitaciones por completar un curso, turnos de calendario (creado / aprobado / recordatorio) y
        ofertas o avisos a listas. Todo lo que se manda automáticamente se puede editar y probar desde acá.
      </p>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        {tab === 'plantillas' && <PlantillasTab />}
        {tab === 'configuracion' && <ConfiguracionTab />}
        {tab === 'listas' && <ListasTab />}
        {tab === 'registro' && <RegistroTab />}
      </div>
    </div>
  );
}
