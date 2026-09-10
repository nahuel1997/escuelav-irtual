import { useState } from 'react';
import Icon from './Icon';

// Input de contraseña con un "ojito" para mostrar/ocultar el texto. Se usa
// en Login, Register y AdminLogin — cualquier campo de contraseña nuevo
// debería usar este componente en vez de un <input type="password"> suelto.
export default function PasswordInput({ id, value, onChange, required, minLength, autoComplete, dark }) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        style={{ paddingRight: 40, width: '100%' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        style={{
          position: 'absolute',
          right: 8,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          padding: 4,
          color: dark ? '#c3ccd6' : 'var(--color-text-muted)',
        }}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}
