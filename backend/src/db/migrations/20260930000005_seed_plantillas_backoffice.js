// Plantillas de mail de las funciones nuevas del backoffice. Van en una
// migración (y no solo en el seed 002) para que existan en cualquier base
// ya instalada sin tener que volver a correr el seed — que además pisaría
// las ediciones del admin. Solo inserta si la clave no existe todavía.
function shell(titulo, contenido) {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title></head>
<body style="margin:0; padding:0; background:#f5f7fa; font-family:Arial, Helvetica, sans-serif; color:#1a1f26;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa; padding:24px 0;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background:#ffffff; border:1px solid #e3e7ed; border-radius:10px; overflow:hidden;">
<tr><td>{{encabezado_mail}}</td></tr>
<tr><td style="padding:20px 28px 0; font-size:18px; font-weight:bold; color:#1c3d5a;">${titulo}</td></tr>
<tr><td style="padding:24px 28px; font-size:15px; line-height:1.55;">${contenido}</td></tr>
</table></td></tr></table></body></html>`;
}

const PLANTILLAS = [
  {
    clave: 'reporte_error_admin',
    nombre: 'Aviso al admin: nuevo reporte de error',
    asunto: 'Nuevo reporte de error #{{numero}}: {{titulo}}',
    cuerpo_html: shell('Nuevo reporte de error', `<p style="margin:0 0 12px;"><strong>{{nombre}}</strong> ({{rol}}) reportó un error:</p>
<p style="margin:0 0 8px;"><strong>{{titulo}}</strong></p>
<p style="margin:0 0 16px; white-space:pre-wrap;">{{descripcion}}</p>
<p style="margin:0; font-size:13px; color:#5b6470;">Lo ves completo, con las capturas, en Panel de admin → Errores → Errores alertados.</p>`),
    variables_disponibles: 'numero, nombre, rol, titulo, descripcion',
  },
  {
    clave: 'reenvio_pdf',
    nombre: 'Reenvío de un PDF por mail',
    asunto: 'Escuela Online — {{titulo}}',
    cuerpo_html: shell('{{titulo}}', `<p style="margin:0 0 12px;">Hola,</p>
<p style="margin:0 0 12px;">{{remitente}} te mandó el PDF adjunto desde Escuela Online.</p>
<p style="margin:0 0 12px; white-space:pre-wrap;">{{mensaje}}</p>
<p style="margin:0; font-size:12px; color:#5b6470;">Enviado por {{remitente}} ({{remitente_email}}).</p>`),
    variables_disponibles: 'titulo, mensaje, remitente, remitente_email',
  },
  {
    clave: 'ticket_respuesta',
    nombre: 'Ticket de soporte: nueva respuesta',
    asunto: 'Tu consulta {{numero}}: {{asunto_ticket}}',
    cuerpo_html: shell('Novedades de tu consulta', `<p style="margin:0 0 12px;">Hola {{nombre}},</p>
<p style="margin:0 0 12px;">Hay novedades en tu consulta <strong>{{numero}}</strong> ({{asunto_ticket}}):</p>
<p style="margin:0 0 16px; white-space:pre-wrap;">{{mensaje}}</p>
<p style="margin:0 0 12px;">Estado actual: <strong>{{estado}}</strong></p>
<p style="margin:0;"><a href="{{link}}" style="color:#1c3d5a;">Ver la consulta</a></p>`),
    variables_disponibles: 'nombre, numero, asunto_ticket, mensaje, estado, link',
  },
  {
    clave: 'ticket_nuevo_admin',
    nombre: 'Aviso al equipo: nuevo ticket de soporte',
    asunto: 'Nuevo ticket {{numero}}: {{asunto_ticket}}',
    cuerpo_html: shell('Nuevo ticket de soporte', `<p style="margin:0 0 12px;"><strong>{{nombre}}</strong> abrió el ticket <strong>{{numero}}</strong>:</p>
<p style="margin:0 0 8px;"><strong>{{asunto_ticket}}</strong></p>
<p style="margin:0; white-space:pre-wrap;">{{mensaje}}</p>`),
    variables_disponibles: 'nombre, numero, asunto_ticket, mensaje',
  },
  {
    clave: 'ticket_aprobacion',
    nombre: 'Ticket de soporte: pedido de aprobación',
    asunto: 'Necesitamos tu aprobación — consulta {{numero}}',
    cuerpo_html: shell('Necesitamos tu aprobación', `<p style="margin:0 0 12px;">Hola {{nombre}},</p>
<p style="margin:0 0 12px;">Sobre tu consulta <strong>{{numero}}</strong> ({{asunto_ticket}}), necesitamos que apruebes lo siguiente:</p>
<p style="margin:0 0 16px; white-space:pre-wrap; background:#f5f7fa; padding:12px; border-radius:8px;">{{detalle}}</p>
<p style="margin:0 0 20px;"><a href="{{link}}" style="display:inline-block; background:#1c3d5a; color:#ffffff; padding:12px 22px; border-radius:8px; text-decoration:none; font-weight:bold;">Aprobar o rechazar</a></p>
<p style="margin:0; font-size:12px; color:#5b6470;">El link vence el {{vence}}. No hace falta iniciar sesión.</p>`),
    variables_disponibles: 'nombre, numero, asunto_ticket, detalle, link, vence',
  },
];

exports.up = async function (knex) {
  for (const p of PLANTILLAS) {
    const existe = await knex('email_templates').where({ clave: p.clave }).first();
    if (!existe) await knex('email_templates').insert({ ...p, activo: true });
  }
};

exports.down = async function (knex) {
  await knex('email_templates').whereIn('clave', PLANTILLAS.map((p) => p.clave)).del();
};
