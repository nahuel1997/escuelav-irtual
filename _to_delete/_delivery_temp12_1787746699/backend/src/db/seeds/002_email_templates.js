// Seed de las plantillas de mail (email_templates) y la configuración por
// defecto de los umbrales automáticos (app_settings).
//
// A diferencia de 001_demo_data.js, este seed es IDEMPOTENTE (usa
// onConflict().merge() por clave) y no borra nada antes de insertar: las
// plantillas y la configuración son datos "de producto", no datos de
// prueba descartables — correr `npm run seed` de nuevo no debería perder
// las ediciones que ya haya hecho el admin desde el backoffice... aunque
// en la práctica sí las pisa (merge trae de vuelta el texto original). Se
// documenta así en el README: este seed se corre una sola vez al instalar,
// no como parte de un reset de datos de prueba — si el admin ya editó una
// plantilla, correr `npm run seed` de nuevo la vuelve a la versión de
// fábrica.
//
// Cada `cuerpo_html` es el HTML COMPLETO del mail (documento entero, con
// <!DOCTYPE>, estilos inline y todo) — no un fragmento que se inserta
// dentro de un layout oculto en otro lado. Esto es a propósito: el editor
// de Plantillas (/admin-panel/mails) deja editar ese texto tal cual se
// manda, así que lo que el admin ve ahí es exactamente lo que le llega al
// destinatario, sin sorpresas. armarShell()/botonHtml() de acá abajo son
// solo un helper para no repetir el mismo layout 10 veces al escribir
// este seed — una vez insertado en la base, cada plantilla es texto
// plano independiente, editable como cualquier otro HTML.
//
// Estilos inline (no <style> externo/interno con selectores complejos) y
// tablas para el layout: es lo que de verdad se respeta en clientes de
// mail como Outlook de escritorio, que no soportan CSS moderno. Colores
// tomados de frontend/src/styles/global.css (--color-primary, --color-
// accent) para que el mail se sienta parte del mismo sitio.
const COLOR_PRIMARIO = '#1c3d5a';
const COLOR_ACENTO = '#e0972d';
const COLOR_FONDO = '#f5f7fa';
const COLOR_TEXTO = '#1a1f26';
const COLOR_TEXTO_MUTED = '#5b6470';
const COLOR_BORDE = '#e3e7ed';

function armarShell(tituloInterno, contenidoHtml) {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${tituloInterno}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLOR_FONDO}; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_FONDO}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:10px; overflow:hidden;">
            <tr>
              <td style="background-color:${COLOR_PRIMARIO}; padding:24px 32px;">
                <span style="font-family:Georgia, 'Times New Roman', serif; font-size:22px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">Escuela Online</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px; color:${COLOR_TEXTO}; font-size:15px; line-height:1.6;">
                ${contenidoHtml}
              </td>
            </tr>
            <tr>
              <td style="background-color:${COLOR_FONDO}; padding:20px 32px; border-top:1px solid ${COLOR_BORDE};">
                <p style="margin:0; font-size:12px; color:${COLOR_TEXTO_MUTED};">Escuela Online · Este es un mail automático, no hace falta responderlo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Botón "a prueba de Outlook": tabla + <a> con padding, no <button> ni
// solo CSS (Outlook de escritorio ignora border-radius/padding en <a>
// sueltos bastante seguido).
function botonHtml(texto, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:8px; background-color:${COLOR_ACENTO};"><a href="${url}" style="display:inline-block; padding:12px 26px; font-size:14px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:8px; font-family:Arial, Helvetica, sans-serif;">${texto}</a></td></tr></table>`;
}

exports.seed = async function (knex) {
  const plantillas = [
    {
      clave: 'verificacion_cuenta',
      nombre: 'Validación de cuenta (código de 6 dígitos)',
      asunto: 'Tu código para activar tu cuenta en Escuela Online',
      cuerpo_html: armarShell('Código de validación', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 16px;">Gracias por registrarte en Escuela Online. Tu código de validación es:</p>
<p style="margin:24px 0; font-size:34px; font-weight:bold; letter-spacing:8px; color:${COLOR_PRIMARIO}; text-align:center;">{{codigo}}</p>
<p style="margin:0 0 8px;">Ingresalo en la pantalla de validación para activar tu cuenta. Este código vence en <strong>15 minutos</strong>.</p>
<p style="margin:16px 0 0; font-size:13px; color:${COLOR_TEXTO_MUTED};">Si vos no creaste esta cuenta, ignorá este mail.</p>`),
      variables_disponibles: 'nombre, codigo',
    },
    {
      clave: 'bienvenida',
      nombre: 'Bienvenida (al validar la cuenta)',
      asunto: '¡Bienvenido/a a Escuela Online, {{nombre}}!',
      cuerpo_html: armarShell('Bienvenido/a', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 16px;">Tu cuenta ya está validada. ¡Bienvenido/a a Escuela Online!</p>
<p style="margin:0;">Desde tu panel podés explorar la tienda de cursos, inscribirte, y pedir turnos con los profesores cuando lo necesites. Cualquier duda, escribinos desde la sección de contacto.</p>`),
      variables_disponibles: 'nombre',
    },
    {
      clave: 'carrito_abandonado',
      nombre: 'Carrito abandonado',
      asunto: 'Dejaste cursos en tu carrito, {{nombre}}',
      cuerpo_html: armarShell('Tu carrito te espera', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 16px;">Notamos que agregaste estos cursos a tu carrito pero todavía no completaste la compra:</p>
<div style="margin:0 0 8px;">{{cursos}}</div>
${botonHtml('Volver a mi carrito', '{{link_carrito}}')}
<p style="margin:0; font-size:13px; color:${COLOR_TEXTO_MUTED};">Si tuviste algún problema para pagar, contactanos y te ayudamos.</p>`),
      variables_disponibles: 'nombre, cursos, link_carrito',
    },
    {
      clave: 'confirmacion_compra',
      nombre: 'Confirmación de compra',
      asunto: '¡Compra confirmada! Ya podés empezar a cursar',
      cuerpo_html: armarShell('Compra confirmada', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 16px;">Confirmamos tu compra:</p>
<div style="margin:0 0 12px;">{{cursos}}</div>
<p style="margin:0 0 8px; font-size:17px;"><strong>Total: {{total}}</strong></p>
${botonHtml('Ir a mis cursos', '{{link_mis_cursos}}')}
<p style="margin:0;">¡Que disfrutes la cursada!</p>`),
      variables_disponibles: 'nombre, cursos, total, link_mis_cursos',
    },
    {
      clave: 'te_extranamos',
      nombre: 'Te extrañamos (inactividad)',
      asunto: 'Te extrañamos por Escuela Online',
      cuerpo_html: armarShell('Te extrañamos', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 8px;">Hace {{dias_inactivo}} días que no te vemos por la plataforma. Tus cursos siguen esperándote.</p>
${botonHtml('Volver a ingresar', '{{link_ingresar}}')}`),
      variables_disponibles: 'nombre, dias_inactivo, link_ingresar',
    },
    {
      clave: 'felicitaciones_curso',
      nombre: 'Felicitaciones por completar un curso',
      asunto: '¡Felicitaciones, completaste {{curso}}!',
      cuerpo_html: armarShell('Felicitaciones', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<p style="margin:0 0 8px;">¡Felicitaciones! Tu profesor marcó como completado el curso <strong>{{curso}}</strong>.</p>
<p style="margin:0 0 8px;">Ya tenés un logro nuevo esperándote.</p>
${botonHtml('Ver mis logros', '{{link_logros}}')}`),
      variables_disponibles: 'nombre, curso, link_logros',
    },
    {
      clave: 'cita_creada',
      nombre: 'Se solicitó un turno',
      asunto: 'Nuevo turno solicitado: {{motivo}}',
      cuerpo_html: armarShell('Nuevo turno solicitado', `<p style="margin:0 0 16px;">Hola {{nombre_destinatario}},</p>
<p style="margin:0 0 16px;">{{nombre_otro_parte}} solicitó un turno.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 8px; border-collapse:collapse;">
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Motivo</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{motivo}}</strong></td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Fecha</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{fecha}}</strong></td></tr>
  <tr><td style="padding:6px 0; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Hora</td><td style="padding:6px 0; text-align:right;"><strong>{{hora}}</strong></td></tr>
</table>
${botonHtml('Ver en el calendario', '{{link_calendario}}')}`),
      variables_disponibles: 'nombre_destinatario, nombre_otro_parte, motivo, fecha, hora, link_calendario',
    },
    {
      clave: 'cita_aprobada',
      nombre: 'Turno aprobado',
      asunto: 'Turno confirmado: {{motivo}}',
      cuerpo_html: armarShell('Turno confirmado', `<p style="margin:0 0 16px;">Hola {{nombre_destinatario}},</p>
<p style="margin:0 0 16px;">El turno con {{nombre_otro_parte}} quedó confirmado.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 8px; border-collapse:collapse;">
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Motivo</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{motivo}}</strong></td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Fecha</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{fecha}}</strong></td></tr>
  <tr><td style="padding:6px 0; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Hora</td><td style="padding:6px 0; text-align:right;"><strong>{{hora}}</strong></td></tr>
</table>
${botonHtml('Ver en el calendario', '{{link_calendario}}')}`),
      variables_disponibles: 'nombre_destinatario, nombre_otro_parte, motivo, fecha, hora, link_calendario',
    },
    {
      clave: 'recordatorio_cita',
      nombre: 'Recordatorio de turno (30 minutos antes)',
      asunto: 'Tu turno empieza en 30 minutos',
      cuerpo_html: armarShell('Recordatorio de turno', `<p style="margin:0 0 16px;">Hola {{nombre_destinatario}},</p>
<p style="margin:0 0 16px;">⏰ Te recordamos que tenés un turno con {{nombre_otro_parte}} en 30 minutos.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 8px; border-collapse:collapse;">
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Motivo</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{motivo}}</strong></td></tr>
  <tr><td style="padding:6px 0; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Hora</td><td style="padding:6px 0; text-align:right;"><strong>{{hora}}</strong></td></tr>
</table>
${botonHtml('Ver en el calendario', '{{link_calendario}}')}`),
      variables_disponibles: 'nombre_destinatario, nombre_otro_parte, motivo, hora, link_calendario',
    },
    {
      clave: 'oferta_aviso',
      nombre: 'Oferta / aviso general (a listas)',
      asunto: '{{titulo}}',
      cuerpo_html: armarShell('{{titulo}}', `<p style="margin:0 0 16px;">Hola {{nombre}},</p>
<div style="margin:0 0 8px;">{{mensaje}}</div>
${botonHtml('Ir a la tienda de cursos', '{{link_tienda}}')}
<hr style="border:none; border-top:1px solid ${COLOR_BORDE}; margin:24px 0 12px;">
<p style="margin:0; font-size:12px; color:${COLOR_TEXTO_MUTED};">Recibiste este mail porque tu cuenta está en una lista de avisos de Escuela Online.</p>`),
      variables_disponibles: 'nombre, titulo, mensaje, link_tienda',
    },
    {
      clave: 'clase_en_vivo_programada',
      nombre: 'Clase en vivo agendada',
      asunto: 'Nueva clase en vivo: {{titulo}}',
      cuerpo_html: armarShell('Nueva clase en vivo', `<p style="margin:0 0 16px;">Hola {{nombre_destinatario}},</p>
<p style="margin:0 0 16px;">Se agendó una nueva clase en vivo para <strong>{{curso}}</strong>:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 8px; border-collapse:collapse;">
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Clase</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{titulo}}</strong></td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Fecha</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{fecha}}</strong></td></tr>
  <tr><td style="padding:6px 0; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Hora</td><td style="padding:6px 0; text-align:right;"><strong>{{hora}}</strong></td></tr>
</table>
${botonHtml('Ver mis clases en vivo', '{{link_clases}}')}
<p style="margin:16px 0 0; font-size:13px; color:${COLOR_TEXTO_MUTED};">Vas a poder entrar a la sala desde esa misma pantalla apenas empiece.</p>`),
      variables_disponibles: 'nombre_destinatario, titulo, curso, fecha, hora, link_clases',
    },
    {
      clave: 'clase_en_vivo_cancelada',
      nombre: 'Clase en vivo cancelada',
      asunto: 'Se canceló la clase en vivo: {{titulo}}',
      cuerpo_html: armarShell('Clase cancelada', `<p style="margin:0 0 16px;">Hola {{nombre_destinatario}},</p>
<p style="margin:0 0 16px;">Se canceló la siguiente clase en vivo de <strong>{{curso}}</strong>:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; margin:0 0 8px; border-collapse:collapse;">
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Clase</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{titulo}}</strong></td></tr>
  <tr><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Fecha</td><td style="padding:6px 0; border-bottom:1px solid ${COLOR_BORDE}; text-align:right;"><strong>{{fecha}}</strong></td></tr>
  <tr><td style="padding:6px 0; color:${COLOR_TEXTO_MUTED}; font-size:13px;">Hora</td><td style="padding:6px 0; text-align:right;"><strong>{{hora}}</strong></td></tr>
</table>
${botonHtml('Ver mis clases en vivo', '{{link_clases}}')}`),
      variables_disponibles: 'nombre_destinatario, titulo, curso, fecha, hora, link_clases',
    },
  ];

  for (const p of plantillas) {
    await knex('email_templates')
      .insert(p)
      .onConflict('clave')
      .merge(['nombre', 'asunto', 'cuerpo_html', 'variables_disponibles']);
  }

  const settings = [
    { clave: 'dias_inactividad_te_extranamos', valor: '30', descripcion: 'Días sin loguearse para disparar el mail de "te extrañamos"' },
    { clave: 'horas_carrito_abandonado', valor: '24', descripcion: 'Horas sin actividad en el carrito para considerarlo abandonado' },
    { clave: 'minutos_recordatorio_cita', valor: '30', descripcion: 'Minutos de anticipación del recordatorio de turno' },
    {
      clave: 'mail_modo_prueba_destinatario',
      valor: '',
      descripcion: 'Modo prueba: si tiene un email cargado, TODO mail (de negocio o de prueba) se redirige a esa dirección en vez del destinatario real. Vacío = apagado, cada mail va a su destinatario real.',
    },
    // No es un setting de mails, pero vive en la misma tabla app_settings
    // (backoffice genérico, ver ConfiguracionTab.jsx) — igual que
    // horas_carrito_abandonado de arriba, que tampoco es "de mails" en
    // sentido estricto. PayPal no liquida en pesos argentinos: el total en
    // ARS del carrito se convierte a USD con esta tasa antes de crear la
    // orden (ver payments.service.js). Hay que actualizarla a mano cada
    // tanto — no se llama a ninguna API de cotización en vivo, a propósito,
    // para no depender de un servicio externo más.
    {
      clave: 'paypal_tasa_cambio_usd',
      valor: '1000',
      descripcion: 'Pesos argentinos por dólar, usado solo para convertir el total a USD cuando el alumno paga con PayPal (Mercado Pago cobra en ARS directo, esto no le aplica). Actualizala a mano cuando la cotización se mueva mucho.',
    },
  ];

  for (const s of settings) {
    await knex('app_settings').insert(s).onConflict('clave').ignore(); // no pisa un valor que el admin ya haya cambiado
  }
};
