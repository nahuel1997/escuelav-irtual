# Escuela Online

Plataforma tipo escuela/LMS: sitio público (home + contacto), login de
usuarios con validación de cuenta por mail, panel de alumno/profesor,
tienda de cursos con carrito de compras (con pagos reales vía Mercado
Pago/PayPal, además del simulado de siempre), classroom (tareas y
entregas, más un temario por curso — unidades y capítulos en video con
progreso, comentarios y desbloqueo configurable), calendario de turnos
alumno-profesor con recordatorio automático, clases en vivo agendadas por
el admin (video con Jitsi Meet + chat en vivo, aviso por mail), logros,
términos y condiciones, un creador de CV en PDF, un motor de mails
transaccionales y de campaña administrable desde el backoffice, y un chat
de soporte en vivo (WebSockets) con su propio panel de agentes.

Monorepo con dos proyectos independientes:

```
escuela-app/
├─ backend/     API REST (Node.js + Express)
└─ frontend/    SPA (React + Vite)
```

## Stack

- **Backend:** Node.js + Express, [knex](https://knexjs.org/) como query
  builder (con migraciones versionadas), JWT para sesión, bcrypt para
  contraseñas, multer para subida de archivos, pdfkit para el CV,
  [nodemailer](https://nodemailer.com/) para el envío de mails,
  [node-cron](https://www.npmjs.com/package/node-cron) para los jobs
  programados (carrito abandonado, inactividad, recordatorio de turno) y
  [Socket.io](https://socket.io/) para el chat de soporte en vivo.
- **Base de datos:** arranca en **SQLite** (cero instalación, un archivo en
  `backend/data/`). Está armada para migrar a **PostgreSQL** solo cambiando
  variables de entorno — ver más abajo.
- **Frontend:** React (Vite) + React Router, sin librería de UI externa
  (CSS propio, tipografías Syne/Inter).
- **Pagos:** además del checkout **simulado** de siempre (default, no cobra
  nada real), se puede conectar **Mercado Pago** y/o **PayPal** de verdad
  completando 5 variables en `.env` — sin tocar código. Ver "Pagos reales"
  más abajo.
- **Mails:** motor propio aislado en `backend/src/services/mail.service.js`
  (mismo criterio que pagos/storage). Arranca en **modo prueba** (Ethereal:
  no manda nada a casillas reales, cada envío queda en el Registro del
  backoffice con un link para verlo) y pasa a un proveedor real con solo
  completar `SMTP_HOST` y compañía en `backend/.env` — ver más abajo.
- **Chat de soporte en vivo:** WebSockets con Socket.io, aislado en
  `backend/src/realtime/chatSocket.js` — es la única parte de la app que
  no es REST puro (todo lo demás se lee/escribe con fetch normal). Un
  widget flotante en el sitio público habla en tiempo real con un panel
  propio (`/soporte`) para agentes de soporte — ver más abajo.
- **Clases en vivo:** el admin agenda una clase (curso, profesor/es,
  fecha/hora), se avisa por mail a los alumnos inscriptos y a los
  profesores asignados, y en el horario el profesor la inicia desde su
  propia pestaña — video con [Jitsi Meet](https://meet.jit.si/) embebido
  (External API, gratis y sin cuenta) más un chat en vivo propio sobre la
  misma instancia de Socket.io del chat de soporte
  (`backend/src/realtime/liveClassSocket.js`) — ver más abajo.
- **Storage de archivos:** hoy en disco local (`backend/uploads/`), pero
  aislado en `backend/src/services/storage.service.js` con el mismo
  criterio que los pagos — migrar a S3 (o el que sea) el día de mañana es
  tocar ese archivo y nada más.
- **Seguridad:** helmet + CORS restringido a `FRONTEND_URL`, contraseñas
  con bcrypt, rate limiting en login/registro/validación de cuenta
  (`express-rate-limit`), el server no arranca en producción si quedó el
  `JWT_SECRET` por defecto, y el login no distingue "no existe la cuenta"
  de "contraseña incorrecta" (mismo mensaje genérico) para no permitir
  enumerar emails registrados.

## Instalación

Abrí PowerShell en `escuela-app/backend` y `escuela-app/frontend` (dos
terminales, una por proyecto) y corré:

```powershell
# --- Backend ---
cd "C:\Users\Dba24\Desktop\escuela-app\backend"
npm install
Copy-Item .env.example .env
npm run migrate
npm run seed
npm run dev
```

```powershell
# --- Frontend (en otra terminal) ---
cd "C:\Users\Dba24\Desktop\escuela-app\frontend"
npm install
Copy-Item .env.example .env
npm run dev
```

- Backend disponible en `http://localhost:3000`
- Frontend disponible en `http://localhost:3500`

> Si venís de una versión anterior del proyecto (ya tenías `node_modules`
> instalado), alcanza con `npm install` de nuevo en `backend` **y en
> `frontend`** (para sumar `nodemailer`/`node-cron`/`socket.io` de un lado
> y `socket.io-client` del otro) y `npm run migrate` en el backend para
> sumar las tablas nuevas (carrito, mails, chat) — **no corras `npm run
> seed` en una app que ya usaste**, ver la advertencia de abajo.

**⚠️ `npm run seed` es destructivo — pensado solo para la instalación
inicial, no para actualizar una app que ya tiene datos reales.** Borra
usuarios, cursos, turnos, logros y **todo** el contenido del sitio (los
colores, fuentes, logo y textos que hayas cargado desde
`/admin-panel/contenido`) y los reemplaza por los 3 usuarios demo y un
puñado de textos por defecto — sin aviso ni backup. El seed de plantillas
de mail (`002_email_templates.js`) tampoco es 100% seguro de re-correr: si
ya editaste una plantilla desde el backoffice, un `npm run seed` la vuelve
a la versión de fábrica. Desde esta versión, `001_demo_data.js` se cancela
solo si ya hay usuarios cargados (hace falta `FORCE_SEED=true` para
forzarlo) — pero **la única forma real de no perder nada es no correrlo**
salvo en una base vacía recién creada. Si necesitás las tablas nuevas de
una funcionalidad que se agregó después, alcanza con `npm run migrate`.

### Usuarios de prueba (cargados por `npm run seed`)

| Rol       | Email                    | Contraseña |
|-----------|--------------------------|------------|
| Admin     | admin@escuela.demo       | 123456     |
| Profesor  | profesora@escuela.demo   | 123456     |
| Alumno    | alumno@escuela.demo      | 123456     |

El registro público (`/registrarme`) solo crea cuentas de **alumno**. Las
cuentas de profesor, de admin y de soporte las crea un administrador desde
`/admin-panel/profesores` / `/admin-panel/soporte` (o, para el primer
admin, se cargan por seed / directo en la base — no hay registro público
para ninguno de estos roles).

El seed también carga el catálogo demo de 3 cursos, enfocado 100% en IA
aplicada a oficinas ("IA para la oficina: herramientas y fundamentos",
"Automatización de procesos de oficina con IA" y "Conectando la IA a tu
LMS: integraciones y uso práctico"), cada uno con su temario real
(unidades + capítulos, no solo el título) — pensado para que el segundo y
el tercero introduzcan, con contenido, las dos features de la plataforma
que más se le parecen (el sandbox de agentes y la integración LTI, ver
ambas secciones más abajo).

El seed también carga el diseño/marca de base (`general.*` en
`site_content` — logo, logo para fondos oscuros, tipografías, colores,
favicon, sufijo/descripción SEO, zona horaria): son los mismos valores que
ya traía el frontend como default hardcodeado
(`frontend/src/config/content.js`), copiados a la base para que una
instalación nueva arranque con el branding actual del proyecto en vez de
en blanco. Si lo cambiás desde `/admin-panel/contenido`, esos nuevos
valores pisan la fila en `site_content` — el default del seed solo se ve
en un `npm run seed` sobre una base vacía (o forzado con
`FORCE_SEED=true`, que sí lo pisa todo, ver la advertencia de arriba).

## Variables de entorno

**backend/.env** (ver `backend/.env.example`):

```
PORT=3000
NODE_ENV=development
DB_CLIENT=sqlite            # sqlite | postgres
SQLITE_FILE=./data/escuela.sqlite3
DATABASE_URL=postgresql://usuario:password@localhost:5432/escuela_db
JWT_SECRET=cambiar-este-secreto-en-produccion
JWT_EXPIRES_IN=7d
# Además de habilitar CORS para la API REST, esta URL es la que se le pasa
# a Socket.io como origen permitido para el chat de soporte en vivo — no
# hace falta una variable aparte para eso.
FRONTEND_URL=http://localhost:3500

# --- Mails ---
# Si SMTP_HOST queda vacío, el server arranca en modo prueba (Ethereal):
# no manda nada a casillas reales, y cada mail queda visible con un link
# de vista previa en /admin-panel/mails → Registro. Para mandar mails de
# verdad, completá estos 5 campos con los datos de tu proveedor (Gmail,
# SendGrid, un SMTP propio, etc.). Este proyecto ya tiene esto completo en
# su backend/.env real (Hostinger, cuenta test@aiviento.com) — el ejemplo
# de abajo queda vacío a propósito porque .env no se versiona:
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM_NAME=Escuela Online
MAIL_FROM_EMAIL=no-responder@escuela-online.demo
# Los jobs programados (carrito abandonado, inactividad, recordatorio de
# turno) corren cada vez que arranca el server con "npm run dev"/"npm
# start". Poné esto en "false" si necesitás levantar el server sin que
# disparen (por ejemplo, en un script puntual):
JOBS_HABILITADOS=true

# --- Pagos reales (ver "Pagos reales" más abajo) ---
# Sin nada de esto, el checkout sigue 100% simulado (comportamiento de
# siempre). Se puede habilitar Mercado Pago, PayPal, los dos, o ninguno.
MP_ACCESS_TOKEN=
MP_PUBLIC_KEY=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=sandbox         # sandbox (no cobra nada real) | live

# --- Clases en vivo (ver "Clases en vivo" más abajo) ---
# Dominio del servidor de Jitsi Meet embebido en la sala de cada clase.
# meet.jit.si es el servidor público y gratuito de Jitsi — no requiere
# cuenta ni configuración para arrancar. Cambiar esto (a un Jitsi propio,
# self-hosted) no requiere tocar código, ni backend ni frontend.
JITSI_DOMAIN=meet.jit.si
```

**Importante:** si `NODE_ENV=production` y `JWT_SECRET` quedó en el valor
por defecto del repo, el server **no arranca** (`process.exit(1)`, ver
`config/env.js`) — con ese secreto conocido cualquiera puede firmar tokens
válidos como cualquier usuario, admin incluido, así que no es algo que se
pueda dejar pasar con un warning. En desarrollo (`NODE_ENV=development` o
`test`) no aplica, para no trabar el día a día. Los jobs programados y el
envío de mails tampoco corren durante `npm test` (ver "Sistema de mails").

**frontend/.env** (ver `frontend/.env.example`):

```
VITE_API_URL=http://localhost:3000/api
```

### Migrar de SQLite a PostgreSQL

1. Instalar Postgres (local o Docker) y crear la base:
   ```powershell
   docker run --name pg-escuela -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=escuela_db -p 5432:5432 -d postgres
   ```
2. En `backend/.env`, cambiar `DB_CLIENT=postgres` y completar
   `DATABASE_URL`.
3. Instalar el driver de Postgres: `npm install pg`.
4. Correr `npm run migrate` y `npm run seed` de nuevo. El resto del código
   (controllers, models) no necesita ningún cambio: todos hablan con knex,
   no con el driver de la base directamente.

## Estructura del backend

```
backend/src/
├─ app.js                  # punto de entrada, súper comentado
├─ config/                 # env.js, db.js
├─ db/                     # knexfile.js, migrations/, seeds/
├─ controllers/            # lógica de cada endpoint
├─ routes/                 # definición de rutas por dominio
├─ middlewares/             # auth (JWT + roles), errores, upload (multer)
├─ models/                 # acceso a datos (una capa fina sobre knex)
├─ services/                # payments.service.js (habla con Mercado Pago/PayPal), checkout.service.js (orquesta una orden real, ver "Pagos reales"), cv.service.js, storage.service.js, mail.service.js
├─ jobs/                    # tareas programadas (node-cron): carrito abandonado, inactividad, recordatorio de turno
├─ realtime/                # chatSocket.js (chat de soporte) + liveClassSocket.js (chat de clases en vivo) — Socket.io, misma instancia `io`
└─ utils/                   # roles.js, contentTipos.js, migrationStatus.js
```

## Funcionalidades y endpoints principales

| Área          | Endpoints                                                      |
|---------------|------------------------------------------------------------------|
| Auth          | `POST /api/auth/register`, `/login` (ambos con rate limit por IP — 20/hora y 10/15min respectivamente), `GET /api/auth/me`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification` (rate limit 8/15min) |
| Perfil        | `GET/PUT /api/users/profile`                                    |
| Tienda        | `GET /api/courses` (solo estado "subido"), `GET /api/courses/:id`, `GET /api/courses/categories` (lista fija de categorías), `GET /api/courses/teaching` (profesor: los suyos, cualquier estado), `POST /api/courses` (profesor) |
| Inscripción   | `POST /api/courses/:id/enroll` (compra directa; `metodo_pago` opcional en el body — sin él, pago simulado de siempre; con un método real, devuelve `{redirect, redirectUrl}` en vez de inscribir — rechaza si el curso no está "subido") — `GET /api/courses/mine` (excluye "fuera_sistema") |
| Carrito       | `GET /api/cart`, `POST /api/cart/items`, `DELETE /api/cart/items/:courseId`, `POST /api/cart/checkout` (alumno; mismo `metodo_pago` opcional que enroll, arma UNA orden con todos los cursos pagables) |
| **Pagos**     | `GET /api/payments/metodos` (público, qué pasarelas reales están configuradas), `POST /api/payments/webhook/mercadopago` \| `/webhook/paypal` (públicas, ver "Pagos reales"), `GET /api/payments/retorno` (público, redirect del navegador del alumno), `GET /api/payments/ordenes/:id` (dueño de la orden) |
| Classroom     | `GET/POST /api/classroom/courses/:courseId/assignments`, `POST /api/classroom/assignments/:id/submissions` (archivo), `GET .../submissions`, `PUT /api/classroom/submissions/:id/grade` |
| Temario (curriculum) | `PUT /api/classroom/courses/:id/settings` (modo de avance), `GET .../curriculum`, `POST/GET/PUT/DELETE /api/classroom/units[/:unitId]`, `POST/GET/PUT/DELETE /api/classroom/units/:unitId/chapters` \| `/chapters/:id`, `POST .../chapters/:id/progress` \| `/complete`, `POST/DELETE .../chapters/:id/files` \| `/chapter-files/:id`, `GET/POST/DELETE .../chapters/:id/comments` \| `/comments/:id`, `PUT .../comments/:id/visibility` (ocultar/mostrar sin borrar) — ver detalle abajo |
| Logros        | `GET /api/achievements`, `GET /api/achievements/mine`           |
| Contacto      | `POST /api/contact`                                              |
| Creador de CV | `GET /api/cv/perfil` (perfil guardado del usuario, o `null` si nunca generó uno), `PUT /api/cv/perfil` (guarda el perfil a mano, sin generar nada — lo usa la pantalla "Mis datos de CV", `/cv/datos`), `POST /api/cv/generate` → devuelve un PDF y, si hay sesión, guarda automáticamente los datos cargados como el perfil del usuario (no hace falta un botón de "Guardar" aparte) |
| CV para IA | `GET /api/cv/generadores-ia` (catálogo de destinos activos: ChatGPT/Claude/Gemini), `POST /api/cv/generar-ia` → devuelve el HTML completo del CV armado con la plantilla del destino, nivel sugerido y recomendaciones (mismo autoguardado de perfil que `/generate` si hay sesión) |
| Sandbox de agentes (alumno/profesor) | `GET /api/agentes/proveedores` (catálogo de proveedores de IA), `GET/POST /api/agentes/flujos`, `PUT/DELETE /api/agentes/flujos/:id`, `POST /api/agentes/ejecutar` (ejecución simulada ad-hoc, no hace falta guardar antes) |
| Integraciones IA (solo alumno) | `GET /api/ai/proveedores` (catálogo + instructivo + si ya vinculó), `POST/DELETE /api/ai/vinculaciones/:proveedor` (carga/quita su propia API key), `GET /api/ai/conversaciones` (`?proveedor=`, solo de IAs vinculadas hoy), `POST /api/ai/conversaciones` (requiere vinculación; con `proveedor` es un chat normal, con `gptId` es un chat "con" uno de los GPTs propios del alumno, ver "GPTs" más abajo), `DELETE /api/ai/conversaciones/:id`, `GET/POST /api/ai/conversaciones/:id/mensajes` (el POST le pega de verdad a la IA con la key del alumno) — ver "Integraciones IA" más abajo |
| GPTs (solo alumno) | `GET/POST /api/ai/gpts`, `PUT/DELETE /api/ai/gpts/:id` — CRUD de los GPTs propios del alumno (nombre, instrucciones, conocimiento, proveedor) — ver "GPTs" más abajo |
| LTI 1.3 (público, lo llama el LMS/frontend, no el usuario a mano) | `GET\|POST /api/lti/login` (OIDC login), `POST /api/lti/launch` (recibe el id_token de la plataforma), `POST /api/lti/exchange` (cambia el código de un solo uso por la sesión real), `GET /api/lti/jwks` (nuestras claves públicas) |
| **Admin — LTI** | `GET /api/admin/lti/info` (las 3 URLs para registrar esta app en el LMS), `GET/POST /api/admin/lti/plataformas`, `PUT /api/admin/lti/plataformas/:id` \| `/activo`, `DELETE /api/admin/lti/plataformas/:id` |
| **Admin — CV para IA** | `GET /api/admin/cv-templates` (las 3 plantillas, activas e inactivas), `PUT /api/admin/cv-templates/:clave` (editar nombre/html/activo) |
| **Admin — Integraciones IA** | `GET /api/admin/ai-templates` (los 3 instructivos, activos e inactivos), `PUT /api/admin/ai-templates/:clave` (editar nombre/instructivo_html/activo) |
| Completar curso | `GET /api/classroom/courses/:id/students`, `PUT .../students/:userId/complete` (profesor del curso o admin) |
| Contenido público | `GET /api/content` → textos/imágenes editables para Home/Contacto/Footer |
| Profesores (listado) | `GET /api/users/profesores` → cualquier usuario logueado, para elegir con quién pedir un turno |
| Calendario    | `GET /api/calendar/mis-turnos`, `POST /api/calendar/turnos` (alumno), `PUT /api/calendar/turnos/:id/aceptar` \| `/rechazar` \| `/cancelar` |
| Clases en vivo (alumno/profesor) | `GET /api/clases-en-vivo/mias`, `GET /api/clases-en-vivo/:id/sala` (revela `room_id`/`jitsi_domain` solo si corresponde según rol y estado), `GET /api/clases-en-vivo/:id/mensajes` (historial), `PUT /api/clases-en-vivo/:id/iniciar` \| `/finalizar` (solo el/los profesor/es asignados; mandar mensajes en vivo es por socket, ver "Clases en vivo") |
| **Admin — Clases en vivo** | `GET /api/admin/clases-en-vivo` (`?course_id=&estado=`), `GET /api/admin/clases-en-vivo/:id`, `POST /api/admin/clases-en-vivo` (agenda + avisa por mail), `PUT /api/admin/clases-en-vivo/:id` (solo mientras "programada"), `PUT /api/admin/clases-en-vivo/:id/cancelar` (solo mientras "programada"; avisa por mail) |
| **Admin**     | `GET /api/admin/dashboard`, `GET/POST /api/admin/users` (`?rol=alumno\|profesor\|admin\|todos`), `GET/POST/PUT /api/admin/courses`, `GET/PUT /api/admin/content`, `POST /api/admin/upload-imagen`, `GET /api/admin/calendario`, `GET/POST/PUT/DELETE /api/admin/nav-links`, `GET/POST/PUT/DELETE /api/admin/botones`, `GET /api/admin/errores` (`?page=`, paginado de a 20), `DELETE /api/admin/errores` (limpia el registro), `GET /api/admin/logins`, `GET /api/admin/testing/suites`, `POST /api/admin/testing/run/:id` (todo protegido por rol admin) |
| **Admin — Mails** | `GET/PUT /api/admin/mails/plantillas[/:clave]`, `POST /api/admin/mails/plantillas/:clave/probar`, `GET/PUT /api/admin/mails/configuracion[/:clave]`, `GET /api/admin/mails/registro`, `GET/POST/PUT/DELETE /api/admin/mails/listas[/:id]`, `GET/POST /api/admin/mails/listas/:id/miembros`, `POST /api/admin/mails/listas/:id/miembros/todos`, `DELETE /api/admin/mails/listas/:id/miembros/:userId` \| `/todos`, `POST /api/admin/mails/listas/:id/enviar` (todo protegido por rol admin) |
| Chat (alumno/profesor) | `GET /api/chat/mi-conversacion` → historial propio (mandar mensajes es por socket, ver "Chat de soporte en vivo") |
| Chat (soporte) | `GET /api/soporte/conversaciones?estado=`, `GET /api/soporte/conversaciones/:id/mensajes` (protegido por rol soporte; responder/cerrar es por socket) |
| **Admin — Chats** | `GET /api/admin/chats?estado=`, `GET /api/admin/chats/:id/mensajes` → registro de solo lectura de todas las conversaciones (protegido por rol admin) |
| **Admin — Pagos** | `GET /api/admin/pagos` (`?estado=&page=`, solo lectura, con datos del alumno), `GET/PUT /api/admin/pagos/tasa-cambio` (cuántos ARS vale 1 USD, la usa PayPal — ver "Pagos reales") |
| **Admin — Test Pagos** | `GET /api/admin/testing/pagos/metodos`, `POST /api/admin/testing/pagos/orden` (`{titulo, precio, metodo_pago}`, precio libre, crea la orden marcada `es_prueba`), `GET /api/admin/testing/pagos/ordenes` (historial de pruebas del propio admin) — todo protegido por rol admin. El estado de una orden puntual se consulta con `GET /api/payments/ordenes/:id` de siempre (el admin es el dueño de sus propias órdenes de prueba) — ver "Test Pagos" en "Pagos reales" |
| Salud del server | `GET /api/health` → estado general + si hay migraciones sin correr (`migraciones.pendientes`) |

Roles: **alumno**, **profesor**, **admin** y **soporte**. Un profesor crea
tareas, revisa/califica entregas, marca cursadas como completadas y
acepta/rechaza turnos; un alumno se inscribe, entrega tareas, junta logros
y pide turnos con sus profesores; un admin gestiona todo desde el panel
(ver abajo); un agente de soporte solo ve y responde el chat en vivo desde
su propio panel (`/soporte`), no tiene acceso a nada más de la plataforma.

### Validación de cuenta por mail

Al registrarse, además de devolver el token de sesión de siempre (el
registro sigue logueando automáticamente — **no es un gate**, es
informativo), se manda un mail con un **código de 6 dígitos** (`plantilla
verificacion_cuenta`, vence a los 15 minutos, máximo 5 intentos). Mientras
la cuenta no esté validada, el alumno/profesor ve un banner en `/panel`
con un link a `/verificar-email` para cargar el código o pedir uno nuevo
("Reenviar código"). Al validar, se manda el mail de `bienvenida`. Ni el
registro ni el login dependen de este estado — es puramente informativo,
a propósito, para no romper el flujo de "me registro y ya puedo usar la
plataforma" que ya estaba probado.

### Carrito de compras

Persistente en la base (no en el navegador) **una vez que hay sesión**,
para que el server pueda detectar abandono sin depender del cliente: cada
alumno tiene **un carrito activo** a la vez (`carts.estado = 'activo'`, un
alumno puede tener varios carritos históricos — convertidos o
abandonados — pero solo uno activo, garantizado a nivel de código, no de
constraint de base). Sin `metodo_pago` en el body, el checkout paga cada
item del carrito con el pago simulado de siempre (mismo
`payments.service.js` que la compra directa), otorga el logro de "primer
curso" si corresponde, manda un único mail de `confirmacion_compra`
resumiendo toda la compra, y vacía el carrito marcándolo `convertido`. Si
algún curso del carrito ya estaba comprado al momento del checkout, se
salta (no se cobra dos veces) y se informa en la respuesta. Con un
`metodo_pago` real, el flujo es distinto — ver "Pagos reales" más abajo.

**Carrito de invitado (sin login):** un visitante sin sesión también
puede armar carrito — no hay a quién asociarle uno en el server, así que
mientras no haya login vive como una lista de ids de curso en
`localStorage` del navegador (`CartContext.jsx`, clave
`carrito_invitado_ids`), y los datos de cada curso para mostrarlo
(título, precio, imagen) se piden al catálogo público
(`GET /courses/:id`). El ícono de carrito, el panel lateral y `/carrito`
son visibles/accesibles para invitados (antes eran exclusivos de
alumnos); `/carrito` sin sesión muestra el total y un botón "Ingresá para
finalizar la compra" en vez de "Finalizar compra" (el checkout real
siempre requiere cuenta, para saber a quién inscribir). Apenas el
invitado inicia sesión, esos ids se agregan al carrito real de la cuenta
uno por uno vía `POST /cart/items` (mejor esfuerzo: si algún curso ya no
está disponible o ya lo tenía comprado, se ignora sin romper el resto), y
se borran de `localStorage` — el carrito "sigue" a la cuenta sin que el
alumno pierda lo que había juntado antes de loguearse.

### Pagos reales (Mercado Pago / PayPal)

Además del pago simulado de siempre (default: aprueba al toque, no cobra
nada), se puede conectar **Mercado Pago** y/o **PayPal** completando
`MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY` y/o `PAYPAL_CLIENT_ID`/
`PAYPAL_CLIENT_SECRET`/`PAYPAL_MODE` en `backend/.env` — sin tocar código,
y sin apagar el modo simulado para quien no configure nada. `GET
/api/payments/metodos` le dice al frontend qué pasarelas están
habilitadas: si no hay ninguna, ni `/carrito` ni "Comprar ahora" muestran
selector — el pago simulado nunca aparece como una opción que el alumno
"elige" a propósito, solo como lo que pasa cuando no hay nada más
configurado.

**Cómo funciona un pago real, de punta a punta:**

1. El alumno manda `metodo_pago` (`mercadopago` o `paypal`) al hacer
   checkout/enroll. `cart.controller.js`/`courses.controller.js` son los
   ÚNICOS que arman la orden (`checkout.service.js::iniciarOrden`) — buscan
   el curso en la base y arman `items` con **su propio precio**, nunca con
   uno que mande el cliente (evita que alguien manipule el precio desde el
   navegador). Se crea una fila en `payment_orders` con estado `pendiente`
   y se devuelve `{ redirect: true, redirectUrl }`: el frontend manda al
   navegador del alumno directo a la pasarela (Checkout Pro de Mercado
   Pago, o la página de aprobación de PayPal) — el alumno paga ahí, la app
   nunca ve ni maneja un número de tarjeta.
2. Un pago real es **asíncrono**. La confirmación llega por dos caminos, y
   cualquiera de los dos alcanza (el otro queda como red de seguridad):
   - **Webhook** (`POST /api/payments/webhook/mercadopago` \|
     `/webhook/paypal`): la pasarela le pega a la API server-a-server. En
     desarrollo local, sin URL pública, Mercado Pago no puede alcanzar
     esta ruta — no importa, el paso 2 cubre ese caso.
   - **Retorno del alumno** (`GET /api/payments/retorno`): el navegador
     vuelve solo, redirigido por la pasarela después de pagar/cancelar.
     Confirma el pago ahí mismo antes de mandar al alumno a `/mis-cursos`
     (aprobado) o `/tienda` (pendiente/rechazado) con `?pago=ok|pendiente
     |rechazado` — no hay una página de retorno aparte, esas dos páginas
     leen ese query param (`PagoBanner.jsx`) y muestran el resultado.
   Ninguno de los dos confía en lo que dice el body/query de la request:
   ambos vuelven a preguntarle a la API real del proveedor por el estado
   del pago (`confirmarPagoMercadoPago`/`capturarPagoPayPal`) antes de dar
   nada por confirmado — así un webhook falso, como mucho, logra que se
   vuelva a consultar una orden puntual, nunca que se apruebe sola.
3. `checkout.service.js::finalizarOrden` es **idempotente** a propósito:
   si el webhook y el retorno llegan casi al mismo tiempo para la misma
   orden, el primero que la marca `aprobado` gana — el segundo la ve ya
   resuelta y no vuelve a inscribir, ni a otorgar el logro, ni a mandar el
   mail de confirmación de nuevo. Recién con el pago aprobado se inscribe
   al alumno (`enrollments.payment_order_id` queda linkeado a la orden,
   para debug/soporte) y, si el curso seguía en el carrito, se saca de ahí
   automáticamente.

**PayPal cobra en USD**, pero los precios de la app están en ARS: la
conversión usa una tasa manual configurable desde
`/admin-panel/pagos` (`app_settings.paypal_tasa_cambio_usd`, default
1000) — no hay integración con una API de cotización en tiempo real, es
una decisión deliberada para no depender de un tercero más ni de sus
límites de uso.

**Apple Pay** no es una pasarela propia — es un método de pago DENTRO de
Mercado Pago. No hay código específico para Apple Pay: si la cuenta de
Mercado Pago del comercio lo tiene habilitado (depende del país), Checkout
Pro lo ofrece solo como una opción más al alumno, sin que el backend
necesite saber que existe.

**Tests:** `payments.test.js` y `paymentsService.test.js` nunca pegan a
Mercado Pago/PayPal de verdad — mockean el módulo `mercadopago` y el
`fetch` global a la API de PayPal (ver el comentario en
`payments.service.js`). `NODE_ENV=test` además fuerza
`metodosDisponibles()` a devolver `[]` siempre, sin importar las
credenciales en `.env` — ninguna pasarela real puede activarse por
accidente corriendo la suite.

#### Test Pagos (`/admin-panel/testing/pagos`)

Herramienta de admin para probar Mercado Pago/PayPal **de punta a punta,
de verdad**, sin depender de tener un curso de prueba ni un alumno propio:
el admin pone un título, un precio libre (no sale de ningún curso real) y
elige la pasarela, y hace el mismo recorrido que un alumno — se abre el
checkout real de la pasarela en una pestaña nueva, paga con una
cuenta/tarjeta de prueba de esa pasarela, y vuelve a confirmarse contra la
API real igual que cualquier pago (mismo `checkout.service.js`, mismas
credenciales de `.env`). Sirve para validar que las credenciales y la
integración andan sin tener que armar todo un recorrido de compra manual
cada vez.

La diferencia con una compra real es un solo flag: la orden se crea con
`es_prueba: true` (columna nueva en `payment_orders`,
`checkoutService.iniciarOrdenDePrueba`). `finalizarOrden` confirma el pago
contra el proveedor real igual que siempre (así se prueba la integración
de punta a punta) pero, si la orden es de prueba, corta ahí mismo apenas
queda `aprobado`: **no** inscribe en ningún curso (el item de la orden
tiene `course_id: null`, no es un curso real), **no** otorga el logro de
"primer curso" y **no** manda el mail de confirmación de compra. La orden
sí queda visible, como cualquier otra, en `/admin-panel/pagos` (con su
precio y estado real) — y además en su propio historial dentro de Test
Pagos (`GET /api/admin/testing/pagos/ordenes`, filtrado a las órdenes de
prueba de ese admin).

Como usa las credenciales reales de `.env`, la página muestra un aviso
recordando que tienen que ser credenciales de **prueba/sandbox** de cada
pasarela (la misma convención que ya pide "Pagos reales" más arriba) —
con esas, nada de lo que se pague ahí cobra plata real.

### Temario del curso (unidades, capítulos y avance)

Cada curso tiene un temario propio, jerárquico: **curso → unidades →
capítulos** (tablas `course_units`, `course_chapters`). El profesor dueño
del curso lo arma desde `/classroom/:courseId` → pestaña "Contenido del
curso"; el admin tiene su propia puerta de entrada equivalente desde
`/admin-panel/cursos` → botón **"Contenido"** de cada curso
(`AdminCourseCurriculum.jsx`, `/admin-panel/cursos/:id/temario`) — reusa el
mismo editor (`CurriculumEditor.jsx`), sin cambios del lado del backend,
porque el login de admin pasa por el mismo `/api/auth/login` y ya cumple
el chequeo de "profesor dueño o admin" (`checkGestionAcceso`). El botón
**"Editar"**, al lado, sigue siendo para el título/descripción/precio/
portada del curso — son dos pantallas separadas a propósito.

- **Unidad**: título + introducción + "qué vas a ver en esta unidad"
  (texto libre). Tiene su propia página de detalle (`/classroom/:courseId/
  unidades/:unitId`) con esos dos textos y la lista de sus capítulos.
- **Capítulo**: título + link de video de **YouTube o Vimeo** (se pega el
  link normal, tipo `youtube.com/watch?v=...` o `vimeo.com/...` — el
  proveedor se detecta solo). También soporta **Vimeo privado**, que trae
  un hash extra al final del link (`vimeo.com/123456789/abcd1234ef`, o ya
  en formato embed `player.vimeo.com/video/123456789?h=abcd1234ef`) — sin
  ese hash el video no reproduce aunque el id sea correcto; se detectan
  los dos formatos (`VideoPlayer.jsx::parseVideoUrl`). No se sube el
  archivo de video en sí: se eligió link externo a propósito, porque el
  storage de esta app es disco local (ver "Storage de archivos" más
  arriba, en Stack) y un video pesa mucho más que lo que ese storage está
  pensado para aguantar. Cada capítulo tiene también, si el profesor sube
  algo, una sección de **archivos de utilidad** (apuntes, código,
  planillas — cualquier tipo, hasta 25MB) — si no tiene ninguno, esa
  sección directamente no aparece en la página del capítulo.
- La página del capítulo (`/classroom/:courseId/unidades/:unitId/
  capitulos/:chapterId`) y la de la unidad tienen, al costado, una barra
  de navegación con el título del curso y el temario completo
  (unidades + capítulos, con el actual resaltado y los bloqueados
  marcados con 🔒 sin ser clickeables — `CourseSidebar.jsx`, se apila
  arriba del contenido en pantallas angostas). La página del capítulo
  además tiene: el video embebido, una caja de comentarios, botones
  **Anterior/Siguiente**, la sección de archivos de utilidad (si tiene), y
  una línea de tiempo con el % de avance de la unidad.
- **Comentarios y moderación**: cualquiera con acceso al classroom
  (alumno inscripto o el profesor) puede comentar y borrar el suyo. Desde
  el editor del temario (tanto el del profesor como el del admin, mismo
  componente), quien gestiona el curso ve además, por capítulo, la lista
  completa de comentarios con opción de **responder** (queda anidada bajo
  la pregunta) y de **ocultar** un comentario puntual sin borrarlo — el
  registro queda en la base, pero deja de mandarse en la respuesta de
  `GET .../comments` para cualquiera que no gestione el curso (no es un
  filtro del front: un alumno no recibe ese comentario ni aunque
  inspeccione la respuesta de la API). El mismo botón lo vuelve a
  mostrar. Solo el profesor dueño o un admin pueden ocultar/mostrar
  (`PUT .../comments/:id/visibility`); borrar sigue disponible aparte
  (autor del comentario, o gestor del curso) y es definitivo.

**Progreso de video real, no solo "abrió la página":** se usa la API
oficial de cada proveedor (IFrame API de YouTube, Player.js de Vimeo) para
saber cuánto se vio de verdad. Se guarda el **segundo máximo alcanzado**
(no el último reportado), para que adelantar y volver atrás no haga bajar
el progreso ya ganado. Toda la regla vive en el backend
(`src/services/curriculum.service.js`) — el frontend nunca decide por su
cuenta si un capítulo se puede marcar como visto, siempre se lo pregunta
al servidor.

**Configuración por curso** (el profesor dueño o un admin la cambian
desde la misma pestaña):

- **Exigir 80% visto** (on/off): si está activo, un capítulo recién se
  puede marcar como "visto" al haber visualizado el 80% del video. Si el
  profesor lo desactiva, se puede marcar como visto en cualquier momento.
- **Modo de avance**, tres opciones:
  - `libre` — el alumno puede ver cualquier capítulo de cualquier unidad,
    en el orden que quiera.
  - `por_unidad` — el primer capítulo de **cada** unidad está siempre
    desbloqueado (se puede arrancar cualquier unidad), pero dentro de una
    unidad hay que completar el capítulo N para que se desbloquee el N+1.
  - `continuo` — estrictamente lineal: solo está desbloqueado el capítulo
    siguiente al último completado, en todo el curso (cruza unidades sin
    poder saltar ninguna).

Completar todos los capítulos del curso otorga el logro de "curso
completado" automáticamente (el mismo que ya otorgaba el profesor a mano
desde "Alumnos inscriptos" — ahora también se gana solo con el temario).

### Sistema de mails

Motor propio (`mail.service.js`) que **nunca tira una excepción**: si
falla el envío (o la plantilla está inactiva/no existe), queda registrado
en `mail_log` con el error y el flujo de negocio que lo disparó (compra,
registro, turno, etc.) sigue funcionando igual — mismo criterio que ya se
usaba para el registro de logins.

**Modo de envío:** si no hay `SMTP_HOST` configurado, arranca en modo
prueba con [Ethereal](https://ethereal.email/) (una casilla descartable
que Nodemailer crea sola) — no sale ningún mail real, y cada envío queda
en el Registro con un link para ver cómo hubiese quedado. Con `SMTP_HOST`
completo pasa a mandar por ese proveedor de verdad. El backoffice
(`/admin-panel/mails` → Plantillas) muestra en qué modo está corriendo.
**Este proyecto ya tiene un SMTP real configurado** (Hostinger, cuenta
`test@aiviento.com`, `backend/.env` — no versionado) — todo mail que
mande la plataforma sale de verdad, salvo que el modo prueba de
redirección de abajo esté activo.

**Modo prueba de redirección** (`app_settings.mail_modo_prueba_destinatario`,
editable en Configuración — ver bullet de abajo): mientras tenga un email
cargado, **todo mail que la plataforma quiera mandar** (de negocio —
verificación, compra, turnos— o el botón "Probar" de una plantilla) se
redirige de verdad a esa casilla en vez del destinatario real. Pensado
para validar un SMTP recién conectado sin mandarle nada a alumnos o
profesores de verdad. `mail_log.destinatario` queda con la dirección a la
que se mandó de verdad; la nueva columna `mail_log.redirigido_desde`
guarda para quién era en realidad (`null` en un envío sin redirección).
Se apaga guardando el campo vacío en Configuración — ahí vuelve a
respetarse el destinatario real de cada mail.

**Los 10 mails de la plataforma** (plantilla + disparador):

| Plantilla              | Se manda cuando...                                              |
|-------------------------|-------------------------------------------------------------------|
| `verificacion_cuenta`   | se registra una cuenta nueva (código de 6 dígitos)                |
| `bienvenida`             | se valida el código de verificación                               |
| `carrito_abandonado`     | un carrito queda sin actividad más de N horas (job programado)    |
| `confirmacion_compra`    | se completa una compra (carrito o directa)                        |
| `te_extranamos`          | un alumno/profesor no inicia sesión hace más de N días (job)      |
| `felicitaciones_curso`   | un profesor marca un curso como completado para un alumno         |
| `cita_creada`            | un alumno solicita un turno (a alumno y profesor)                  |
| `cita_aprobada`          | el profesor acepta un turno (a alumno y profesor)                  |
| `recordatorio_cita`      | faltan N minutos para un turno aceptado (job programado)          |
| `oferta_aviso`           | el admin manda un aviso a una lista desde el backoffice           |

**Jobs programados** (`backend/src/jobs/`, con `node-cron`, arrancan solo
si `JOBS_HABILITADOS=true` y **nunca** durante `npm test` — están
enganchados al mismo bloque de `app.js` que ya arrancaba el server, así
Jest jamás los dispara):

| Job                        | Frecuencia   | Umbral (editable en Configuración) |
|-----------------------------|--------------|--------------------------------------|
| `carritoAbandonado.job.js`  | cada 30 min  | `horas_carrito_abandonado` (default 24) |
| `inactividad.job.js`        | diario 9am   | `dias_inactividad_te_extranamos` (default 30) |
| `recordatorioCitas.job.js`  | cada 5 min   | `minutos_recordatorio_cita` (default 30) |

### Backoffice de mails (`/admin-panel/mails`)

Cuatro pestañas, todas dentro del panel de admin (rol `admin`):

- **Plantillas:** editar asunto y cuerpo (HTML simple, con variables tipo
  `{{nombre}}`) de cada uno de los 10 mails, activar/desactivar cada uno
  individualmente, y un botón **"Probar"** que manda esa plantilla con
  valores de ejemplo (sin tener que disparar el flujo real — comprar un
  curso, pedir un turno, etc.) y muestra el link de vista previa si está
  en modo prueba.
- **Configuración:** los 3 umbrales de arriba (días de inactividad, horas
  de carrito abandonado, minutos de recordatorio) más el **modo prueba de
  redirección** (ver más arriba), todos editables sin necesitar un
  redeploy. Guardar el campo del modo prueba vacío lo apaga (el endpoint
  acepta explícitamente un valor vacío para este caso puntual — ver nota
  en `mails.controller.js::updateSetting`).
- **Listas:** listas armables a mano (crear, borrar, agregar/quitar
  alumnos y profesores uno por uno o con **"Seleccionar todos" /
  "Quitar todos"**) para el mail de ofertas/avisos. La plantilla
  `oferta_aviso` define el look general; el **título y el mensaje** de
  cada envío se escriben en esta misma pestaña al mandarlo — así una
  misma plantilla sirve tanto para "Black Friday" como para un aviso de
  mantenimiento, sin tocar código.
- **Registro de envíos:** todos los mails que la plataforma intentó
  mandar (transaccionales y de campaña), filtrable por tipo y estado, con
  link a la vista previa cuando corresponde — la forma de confirmar que
  un mail realmente se disparó sin abrir una casilla real.

### Chat de soporte en vivo

Único rincón de la app que no es REST puro: un widget de chat flotante
(💬, abajo a la derecha) visible en cualquier página del sitio público
para **alumnos y profesores logueados** (no para visitantes anónimos, ni
para admin — cada uno tiene su propia forma de interactuar con esto)
habla en tiempo real, por WebSockets (Socket.io), con el panel de
agentes de soporte en `/soporte`.

- **Cómo arranca una conversación:** sola, con el primer mensaje que
  escribe el alumno/profesor — no hay un botón separado de "iniciar
  chat". Si ya tenía una conversación abierta, sigue ahí; si la anterior
  ya se había cerrado, escribir de nuevo abre una nueva.
- **Cola compartida, no asignación:** cualquier agente de soporte
  conectado en `/soporte` ve TODOS los chats (abiertos y cerrados) y
  puede responder cualquiera — no hay "este chat es mío, no tuyo". El
  campo "atendido por" que se ve en la lista es solo informativo (el
  último agente que respondió), pensado para que el equipo sepa quién ya
  le puso el ojo a cada uno, no para bloquear a los demás.
- **Cerrar un chat** es una acción exclusiva de soporte (un alumno no
  puede cerrar su propia conversación). Un chat cerrado no acepta más
  mensajes de soporte; si el alumno vuelve a escribir, se le abre uno
  nuevo automáticamente.
- **Cuentas de soporte:** las crea un admin desde
  `/admin-panel/soporte` (mismo patrón que Profesores) e inician sesión
  en `/soporte/ingresar` — login propio, con su propia sesión
  (`soporte_token` en `localStorage`), igual que el panel de admin tiene
  la suya (`admin_token`). Una cuenta de soporte no puede entrar por el
  login público (`/ingresar`) y viceversa.
- **Qué ve el admin:** un registro de solo lectura en
  `/admin-panel/chats` — todas las conversaciones, con quién habló, quién
  la atendió, cuántos mensajes tiene y la transcripción completa de
  cualquiera. El admin no responde desde ahí, solo supervisa.
- **Por qué WebSockets y no "refrescar cada tanto":** un chat en vivo
  necesita que el mensaje aparezca del otro lado al instante, sin que
  nadie tenga que recargar la página — eso es justo lo que un socket
  permite y un fetch normal no. El resto de la app (mails, carrito,
  calendario...) sigue siendo REST puro a propósito: los sockets solo se
  usan acá, donde de verdad hacen falta.
- **Qué es REST y qué es socket:** cargar el historial al abrir la
  página (`GET /api/chat/mi-conversacion`, `GET /api/soporte/
  conversaciones[/:id/mensajes]`, `GET /api/admin/chats[/:id/mensajes]`)
  es todo REST normal — los sockets (`backend/src/realtime/
  chatSocket.js`) se usan solo para lo que tiene que sentirse instantáneo:
  mandar un mensaje y cerrar un chat.

### Calendario de turnos (`/calendario`)

Página privada para alumno y profesor (no para admin, que tiene su propia
vista de solo lectura, ver más abajo):

- El **alumno** elige un profesor (y opcionalmente un curso propio), un
  motivo y un horario, y solicita el turno. Queda en estado `pendiente` y
  se manda el mail `cita_creada` a ambas partes.
- El **profesor** ve las solicitudes pendientes y las acepta o rechaza
  (con una nota opcional). Al aceptar se manda el mail `cita_aprobada` a
  ambas partes. También ve su agenda ya confirmada.
- Cualquiera de las dos partes puede **cancelar** un turno pendiente o ya
  aceptado.
- **Que no se sobrepongan** se garantiza a nivel de base de datos: no se
  puede solicitar (ni aceptar) un turno cuyo horario se cruza con otro
  turno ya `aceptado` del mismo profesor (`calendarEvent.model.js →
  hasOverlap`). El chequeo corre tanto al solicitar como al aceptar, para
  cubrir el caso de dos solicitudes pendientes que se superponen entre sí
  (el profesor solo puede confirmar una).
- 30 minutos antes de un turno aceptado, el job `recordatorioCitas.job.js`
  manda `recordatorio_cita` a ambas partes (una sola vez por turno).

### Clases en vivo (`/clases-en-vivo`)

Video en vivo (Jitsi Meet embebido) + chat en tiempo real por curso.
Agendar es exclusivo del **admin** (`/admin-panel/clases-en-vivo`); dar la
clase es del/de los **profesor/es** asignados; entrar a verla es del
**alumno** inscripto en el curso.

- **Máquina de estados** (ver `backend/src/db/migrations/
  20260828000001_create_live_classes.js`): `programada` → `en_vivo` →
  `finalizada`, o `cancelada` en cualquier momento mientras sigue
  `programada`. No hay vuelta atrás entre estados.
- **Agendar (admin):** curso, título, descripción, fecha/hora, duración y
  uno o más profesores (co-dictado admitido — cualquiera de los asignados
  puede iniciar/finalizar la transmisión, no hace falta que sea el
  profesor "dueño" del curso). Se manda el mail `clase_en_vivo_programada`
  a todos los alumnos inscriptos en el curso y a los profesores
  asignados. **Editar** (título/horario/profesores) solo está disponible
  mientras la clase sigue `programada`, y a propósito **no** manda mail de
  nuevo (evita spamear por cada ajuste menor). **Cancelar** también solo
  aplica a una clase `programada`, y sí avisa por mail
  (`clase_en_vivo_cancelada`).
- **Sala y `room_id`:** cada clase tiene un `room_id` random (no
  correlativo con el id numérico, ver `liveClass.model.js::generarRoomId`)
  que nunca se expone hasta que corresponde — al profesor asignado
  siempre (incluso con la clase todavía `programada`, para poder probar
  cámara/mic antes de arrancar), al alumno inscripto recién cuando la
  clase pasó a `en_vivo`. `GET /api/clases-en-vivo/:id/sala` es quien
  hace ese chequeo (403 si no tiene ninguna relación con la clase, 409 si
  el estado todavía no lo permite).
- **Video — Jitsi Meet:** se embebe con la **External API oficial**
  (`https://<JITSI_DOMAIN>/external_api.js`, ver `JitsiRoom.jsx`), no un
  `<iframe>` a mano — `meet.jit.si` bloquea el embedding directo por
  iframe en varios casos (`X-Frame-Options`). `JITSI_DOMAIN` (default
  `meet.jit.si`, gratis y sin cuenta) es la única variable que hace falta
  para apuntar a un Jitsi propio el día de mañana.
- **Chat — mismo Socket.io que el chat de soporte:** un `http.Server`
  solo admite una instancia de Socket.io enganchada, así que
  `liveClassSocket.js` NO levanta un segundo servidor — reutiliza la
  misma instancia `io` que ya crea `chatSocket.js` (con la autenticación
  por JWT ya resuelta) y agrega sus propios eventos (`claseEnVivo:unirse`,
  `claseEnVivo:mensaje`, `claseEnVivo:estado`) sobre esa conexión. El
  historial (`live_class_messages`) se carga por REST al abrir la sala
  (`GET /api/clases-en-vivo/:id/mensajes`); los mensajes nuevos llegan en
  vivo por socket — mismo criterio que el chat de soporte.
- **Iniciar/finalizar (profesor):** `PUT /api/clases-en-vivo/:id/iniciar`
  (`programada` → `en_vivo`, guarda `started_at`, recién ahí el alumno
  puede entrar) y `PUT .../finalizar` (`en_vivo` → `finalizada`, guarda
  `ended_at`) — ambos validan que quien pide sea uno de los profesores
  asignados, no alcanza con el rol.

### Sandbox de orquestación de agentes (`/agentes`)

Alumno y profesor arman **flujos**: una cadena de agentes de IA, cada uno
con nombre/rol/instrucciones y un **proveedor** asignado (Claude, Gemini,
ChatGPT o "modelo propio — host privado"). El orden del arreglo de nodos
ES el orden de ejecución — la salida de cada agente es el contexto de
entrada del siguiente, así se ve en la práctica qué significa "orquestar"
varios agentes.

- **Hoy la ejecución es 100% simulada** (`services/agentProviders/`): no
  se llama a ninguna IA real, no hace falta ninguna API key, no genera
  costo. Cada proveedor tiene una "voz" con estilo de redacción distinto
  (Claude piensa en voz alta, Gemini responde en bullets cortos, ChatGPT
  numera los pasos, el modelo propio aclara que corre dentro del host
  privado) solo para que un flujo con proveedores mezclados se note al
  leerlo — no simula diferencias reales de capacidad entre esas IAs.
- **Pensado para escalar a IA real sin rediseñar nada:** conectar un
  proveedor de verdad el día de mañana es crear un archivo nuevo en
  `services/agentProviders/` con la misma firma
  (`ejecutar({ nodo, contextoPrevio }) => { texto, meta }`) y reemplazar
  esa entrada en el registro (`agentProviders/index.js`) — el controller,
  el modelo (`agent_flows`, con los nodos como JSON — mismo criterio que
  `cv_profiles`) y el frontend no necesitan tocarse.
- Los flujos se pueden guardar (`POST/PUT /api/agentes/flujos`) o
  ejecutarse sin guardar antes (`POST /api/agentes/ejecutar`, ad-hoc) —
  útil para probar mientras todavía se está armando el flujo. Cada
  usuario solo ve/edita/borra sus propios flujos.

### CV para IA (ChatGPT / Claude / Gemini)

Dentro del Creador de CV (`/cv`), antes del botón de descargar el PDF de
siempre, hay una sección aparte para generar una versión del CV pensada
para pegar como contexto en un chat de IA (ChatGPT, Claude o Gemini):
`POST /api/cv/generar-ia` devuelve el HTML completo, que el frontend abre
en una pestaña nueva (para leer/copiar/pegar, o imprimirlo como PDF desde
el propio navegador) y también se puede descargar como archivo `.html`.
A propósito NO es un PDF armado por el backend como el creador normal
(`cv.service.js` con pdfkit): el resultado es HTML porque lo va a leer
una IA, no hace falta la maquetación de un documento para imprimir, y así
tampoco hace falta sumar una dependencia nueva (tipo un navegador headless)
solo para este flujo — si el alumno quiere un PDF de esta versión, lo saca
imprimiendo esa pestaña.

- **Plantillas HTML editables por el admin (`/admin-panel/cv-ia`):** las 3
  claves (`chatgpt`, `claude`, `gemini`) son fijas — igual que las
  plantillas de mail, el admin edita el HTML completo de una plantilla
  existente (nunca crea una clave nueva a mano) desde un editor con vista
  previa y valores de ejemplo. Cada plantilla es HTML independiente desde
  que se carga el seed: el admin puede desincronizar el texto de una sin
  afectar a las otras dos. Una plantilla desactivada deja de aparecer
  como opción en `/cv` (`GET /api/cv/generadores-ia` solo lista las
  activas) y generarla a mano da 409.
- **Sustitución simple de variables** (`services/cvAi/templateEngine.js` +
  `utils/template.js`, el mismo `{{variable}}` que ya usaban las
  plantillas de mail — se extrajo a un util compartido en esta vuelta en
  vez de duplicar la regex): los datos que carga el alumno a mano llegan
  ya escapados (un nombre con `&`/`<`/`>` no rompe el HTML resultante), y
  las listas (experiencia, educación, habilidades, idiomas, cursos de la
  plataforma, recomendaciones) llegan pre-armadas como fragmentos de HTML
  listos para insertar — no es un motor de templates con loops, es
  sustitución de texto sobre fragmentos ya resueltos del lado del server.
- **Nivel sugerido en IA aplicada a oficina** (`config/nivelesIA.js` +
  `cv.service.js::calcularNivelIA`): 4 niveles fijos (inicial / básico /
  intermedio / avanzado) según cuántos de los 3 cursos de la categoría
  "Inteligencia Artificial" el alumno ya completó — 0 cursos completados
  es "inicial", los 3 completados es "avanzado". Es una referencia que la
  app calcula sola, no una autoevaluación ni una certificación externa; el
  alumno puede seguir editando el resto del CV como cualquier campo de
  texto generado.
- **Recomendación de contenido** (`cv.service.js::getRecomendaciones`):
  hasta 2 cursos de la categoría IA que el alumno todavía no completó, en
  el mismo orden pedagógico del catálogo (fundamentos → automatización →
  integración con LMS) — sin sesión (CV anónimo) recomienda el arranque
  sugerido del catálogo completo, para que la sección nunca quede vacía.
- **Pensado para escalar a que en el futuro lo genere una IA de
  verdad, sin rediseñar nada:** mismo patrón de registro que
  `services/agentProviders/` (ver "Sandbox de orquestación de agentes"
  arriba) — hoy `services/cvAi/index.js` solo tiene un motor,
  `'plantilla'` (sustitución de variables sobre el HTML del admin, reglas
  fijas para nivel/recomendaciones). El día de mañana, un motor `'ia'`
  que le pida a un modelo real que redacte/optimice el CV en vez de solo
  sustituir variables se suma como un archivo más en `services/cvAi/` y
  una entrada nueva en el registro — `cv.controller.js` y el frontend no
  cambian.

**Mis datos de CV (`/cv/datos`):** pantalla aparte del Creador de CV
donde el alumno ve y edita el perfil guardado (datos personales,
experiencia, educación, habilidades, idiomas, y la preferencia de incluir
cursos de la plataforma) sin necesidad de generar un PDF ni un CV para IA
— antes de esto la única forma de persistir estos datos era descargar un
CV desde `/cv`. Guarda con `PUT /api/cv/perfil`
(`cv.controller.js::guardarPerfil`), el mismo `upsert` que ya usaban
`/generate` y `/generar-ia`, pero acá el guardado es el propósito
completo del endpoint (se espera el resultado y se devuelve el perfil
guardado, no es best-effort). El formulario en sí
(`components/CvDatosForm.jsx`) está extraído del Creador de CV para que
las dos pantallas compartan el mismo JSX sin duplicarlo — `CvBuilder.jsx`
suma encima la sección "Generar CV para IA" y el botón de descargar PDF,
que son específicos del flujo de generación. Cada pantalla tiene un link
a la otra (no se agregó al Navbar principal para no sumar ítems al menú:
se llega desde adentro del flujo del Creador de CV).

### Integraciones IA (`/integraciones-ia`)

A diferencia del Sandbox de orquestación de agentes (100% simulado, ver
más arriba), acá cada alumno vincula su **propia** cuenta de ChatGPT,
Claude o Gemini con su **propia** API key y chatea de verdad con esa IA
— la plataforma nunca ve la key en texto plano ni paga nada por ese uso:
corre 100% por cuenta y crédito del alumno. Es exclusiva de la sección de
alumnos (a diferencia de `/cv` o `/agentes`, que son para cualquier
usuario logueado) — tanto la ruta del frontend como
`/api/ai/*` en el backend exigen rol `alumno`.

Tres pestañas, en este orden — Chats primero porque es lo que se usa todos
los días, Registros al final porque es la que menos:

- **Chats**: el chat en vivo (pestaña por defecto al entrar). Un panel a
  la izquierda deja elegir a qué IA consultar (solo las vinculadas se
  pueden abrir) y navegar entre las conversaciones que ya tenés con ella,
  con un botón **+ Nueva** para arrancar otra — a diferencia del creador
  de CV o el sandbox de agentes, acá cada IA puede tener **varias
  conversaciones separadas**, como en las apps reales de cada proveedor.
  Cada mensaje que mandás es un pedido HTTP normal (no un socket): el
  backend guarda tu mensaje, le manda TODO el historial de esa
  conversación a la IA real como contexto
  (`POST /api/ai/conversaciones/:id/mensajes`), guarda la respuesta y te
  la devuelve. Si la IA falla (key inválida, sin crédito, rate limit) tu
  mensaje igual queda guardado — no se pierde lo que escribiste, solo no
  hay respuesta todavía.
- **Vinculaciones**: una sección desplegable por IA (ChatGPT, Claude,
  Gemini) con un video tutorial + el instructivo paso a paso para sacar
  la API key de cada proveedor — todo editable por el admin desde
  `/admin-panel/ai-integraciones` (ver más abajo), no está fijo en el
  código. Al desplegarla, si todavía no está vinculada aparece el campo
  para pegar la key; si ya está vinculada, un preview corto (`••••1234`,
  últimos 4 caracteres) y el botón **Desvincular**. El instructivo se
  muestra dentro de un `<iframe sandbox>` en vez de inyectarse directo en
  la página (`VinculacionesTab.jsx`): es HTML que escribió el admin, no
  el alumno, así que igual no confiamos ciegamente en él. El sandbox
  habilita `allow-scripts` (lo necesita el player embebido de YouTube
  para funcionar) pero deliberadamente **no** incluye
  `allow-same-origin`: sin esa combinación el contenido corre en un
  origen único/opaco sin acceso a cookies, `localStorage` ni el DOM de
  esta página — un admin comprometido podría romper el recuadro del
  instructivo, nunca tocar la sesión del alumno (`allow-fullscreen` deja
  poner el video en pantalla completa, `allow-popups
  allow-popups-to-escape-sandbox` deja que los links a
  platform.openai.com/etc. abran en pestaña nueva). El video sembrado por
  defecto (`db/seeds/004_ai_integration_templates.js`) es el mismo de
  YouTube que se usa como placeholder de prueba en el resto de la
  plataforma (capítulos de curso, ver `001_demo_data.js`) — el admin lo
  reemplaza por uno real propio en cualquier momento, es HTML como el
  resto del instructivo.
- **Registros**: todo el historial de conversaciones. El backend
  (`GET /api/ai/conversaciones` sin filtro) devuelve **solo** las de IAs
  vinculadas **hoy** — si desvinculás una IA, sus chats viejos no se
  borran (ver `aiLink.model.js::desvincular`) pero dejan de listarse acá
  hasta que la vuelvas a vincular. Es el criterio de permisos pedido:
  podés ver el detalle completo de cómo vincular cualquier IA en
  cualquier momento (la pestaña Vinculaciones no depende de esto), pero
  los chats de una IA no vinculada quedan fuera de vista. Desde acá
  también se puede **Abrir** una conversación vieja (salta a la pestaña
  Chats con esa conversación ya cargada) o **Borrar** una entera.

**Llamadas reales, sin SDK aparte** (`services/aiChat/`): mismo criterio
que PayPal en `payments.service.js` — Node 22 ya trae `fetch` nativo, así
que en vez de sumar `openai`/`@anthropic-ai/sdk`/`@google/generative-ai`
como dependencias, cada proveedor es un archivo chico que arma el request
HTTP con el formato propio de esa API (`openai.provider.js`,
`anthropic.provider.js`, `gemini.provider.js`) detrás de un registro
(`services/aiChat/index.js::getMotor`) — mismo patrón de "motor
intercambiable" que `agentProviders/` y `cvAi/`. El modelo concreto de
cada uno (`gpt-4o-mini`, `claude-3-5-haiku-20241022`, `gemini-1.5-flash`)
es configurable por variable de entorno (`OPENAI_CHAT_MODEL`,
`ANTHROPIC_CHAT_MODEL`, `GEMINI_CHAT_MODEL` — ver `config/aiProviders.js`
y `.env.example`) sin tocar código, para el día que un proveedor
deprecie el que viene por defecto.

**La API key nunca se guarda en texto plano** (`utils/crypto.js`):
cifrado simétrico AES-256-GCM, con la clave de cifrado derivada de
`JWT_SECRET` (scrypt + salt fijo) en vez de pedir una variable de entorno
nueva — `JWT_SECRET` ya es el secreto maestro de esta app (`env.js` ya
frena el arranque en producción si quedó el valor por defecto del repo),
así que reusarlo no baja la protección real. Ningún endpoint devuelve la
key descifrada una vez guardada: `GET /api/ai/proveedores` solo expone un
preview de los últimos 4 caracteres (`aiLink.model.js::listForUser`) — la
key completa solo se descifra server-side, en el momento exacto de
reenviar un mensaje a la IA real, y nunca sale de ese request.

### GPTs (`/gpts`)

Sección aparte en el menú lateral (no una pestaña más de Integraciones
IA, aunque depende de ella): acá el alumno arma sus propios asistentes
con personalidad fija — nombre + instrucciones (system prompt) +
conocimiento de referencia opcional — usando la IA que ya vinculó.

**Por qué esto NO es un Custom GPT/Proyecto/Gem real** (investigado a
fondo antes de construirlo, no es una suposición): ninguno de los 3
proveedores expone una API pública para crear estas cosas con una simple
API key —

- **ChatGPT**: los Custom GPTs se crean solo desde el GPT Builder de la
  interfaz web de ChatGPT, con cuenta propia — no hay endpoint de API. Y
  desde 2026 ni siquiera está disponible para cuentas personales (Free,
  Go, Plus, Pro): hace falta un workspace Business/Enterprise/Edu.
- **Claude**: los Proyectos se crean solo desde claude.ai (disponible en
  todos los planes, incluido el gratuito) — tampoco hay forma de crearlos
  vía API.
- **Gemini**: las Gems se crean solo desde la app de consumidor de
  Gemini — intentar llamarlas desde la API pública de Gemini (aun siendo
  el dueño de la Gem, con su propia API key) da 404: no están expuestas
  ahí.

Ninguna de las 3 tiene tampoco un OAuth/scope público para que una app de
terceros las cree en nombre del usuario — la única forma de literalmente
crear una sería automatizar la sesión web real del alumno (screen
scraping o endpoints internos no documentados), algo frágil, en contra de
los términos de servicio de cada proveedor, y que requeriría manejar la
contraseña/cookie de sesión real del alumno — descartado de plano.

**Lo que sí se puede construir de verdad, y es lo que hay acá**: el
equivalente funcional, alojado 100% en esta plataforma —

- `POST /api/ai/gpts` — crear (`proveedor`, `nombre`, `instrucciones`,
  `conocimiento` opcional). `PUT/DELETE /api/ai/gpts/:id` para editar o
  borrar (`GET /api/ai/gpts` los lista) — ver `aiGpts.controller.js` y
  `models/aiGpt.model.js`.
- **"Chatear"** con un GPT (botón en `Gpts.jsx`) llama a
  `POST /api/ai/conversaciones` con `{ gptId }` en vez de `{ proveedor }`
  — el proveedor se DERIVA del GPT (`ai.controller.js::crearConversacion`)
  y el sistema arma el system prompt combinado
  (`aiGpt.model.js::armarSistemaPrompt`: instrucciones + conocimiento con
  un separador) y lo guarda como **foto** en la nueva columna
  `ai_conversations.sistema_prompt`. Es una foto, no una referencia viva
  a propósito: editar o borrar el GPT después nunca cambia
  retroactivamente cómo responde una conversación ya empezada — mismo
  comportamiento que un Custom GPT real (`gpt_id` sí es una referencia
  viva, pero solo se usa para mostrar el nombre con un badge 🤖 en
  ChatsTab/RegistrosTab, `ON DELETE SET NULL` si se borra el GPT).
- **Cada proveedor manda el system prompt con SU propio formato**
  (`services/aiChat/*.provider.js`, parámetro nuevo `sistema`): OpenAI lo
  agrega como un mensaje más con `role: "system"` al principio de
  `messages`; Anthropic lo manda en un campo separado top-level `system`
  (esa API no acepta un mensaje con role "system" dentro de `messages`);
  Gemini lo manda en su propio campo top-level `systemInstruction` (nunca
  mezclado en `contents`). Los 3 formatos están cubiertos con tests
  específicos en `tests/ai.test.js`.
- Después de crear la conversación, `navigate('/integraciones-ia', {
  state: { abrirConversacion: {...} } })` reutiliza el mismo mecanismo
  que ya tenía "Registros" para reabrir una conversación puntual — salta
  directo a la pestaña Chats con esa conversación ya abierta
  (`IntegracionesIA.jsx` lee `location.state` al montar).
- Requiere que el proveedor del GPT esté vinculado (mismo criterio que un
  chat normal, 409 si no) — el botón "Chatear" en `Gpts.jsx` aparece
  deshabilitado con un tooltip si todavía no vinculaste esa IA.

Por ahora el "conocimiento" es texto pegado, sin subida de archivos ni
búsqueda semántica (RAG) — se manda entero como parte del system prompt
en cada mensaje. Alcanza para instrucciones/glosarios cortos; un
documento largo consumiría mucho contexto en cada llamada.

### Integración LMS real (LTI 1.3)

Esta app puede actuar como **Tool** LTI 1.3 Advantage: cualquier LMS
compatible (Moodle, Canvas, Google Classroom, etc. — no está atado a uno
específico, es justamente lo que resuelve el estándar) puede lanzar un
curso puntual de la plataforma desde adentro suyo, con el alumno entrando
ya logueado, y mandar la nota de vuelta automáticamente al completar el
curso.

- **Alta desde el admin (`/admin-panel/lti`):** cada integración conecta
  UN LMS (identificado por `issuer` + `client_id` + `deployment_id`, como
  pide el estándar) a UN curso local. La misma pantalla muestra las 3 URLs
  que hay que cargar del otro lado, en el LMS, al registrar esta
  herramienta como "External Tool" LTI 1.3 (`GET /api/admin/lti/info`):
  OpenID Connect Login URL, Launch URL y JWKS URL.
- **Login OIDC de dos pasos** (`services/lti/oidcLogin.service.js` +
  `launchValidator.service.js`): el LMS manda al navegador a
  `/api/lti/login`, generamos `state`+`nonce` y redirigimos al login de
  la plataforma; ella responde con un POST `form_post` a
  `/api/lti/launch` con un `id_token` firmado — validamos la firma contra
  el JWKS de la plataforma (`jwks_url`, cacheado 10 min), el `iss`/`aud`,
  el `nonce`, la versión LTI, el tipo de mensaje y el `deployment_id`.
  El JWT nunca llega al frontend por la URL: pasa por un código de un solo
  uso (`POST /api/lti/exchange`) que el frontend cambia por la sesión real.
- **Alta automática de cuenta e inscripción**
  (`userProvisioning.service.js`): la primera vez que alguien entra por
  LTI se crea (o se reutiliza, si ya existía una cuenta con el mismo
  email) su usuario local, con el rol derivado del claim de roles del
  `id_token` (Instructor → profesor, el resto → alumno), y se lo inscribe
  al curso mapeado para esa plataforma.
- **Passback de notas (AGS):** si el launch trajo un `lineitem` de AGS, al
  marcar el curso completado (`classroom.controller.js::markCompleted`)
  se le manda la nota a la plataforma en segundo plano
  (`services/lti/ags.service.js` — pide un access token con
  `client_credentials`, firmado con la clave RSA propia de esta app, y
  postea el score) — best-effort: si la plataforma está caída o rechaza
  el pedido, no rompe ni demora la respuesta de "completar curso".
- **Clave propia:** esta app genera sola (una vez, la primera vez que
  hace falta) su propio par de claves RSA (`lti_tool_keys`) para firmar
  esos pedidos de AGS — no hay ningún secreto para pegar a mano. La
  pública se expone en `/api/lti/jwks`.
- Sin un LMS real registrado para probar el handshake de punta a punta
  contra una plataforma de verdad, la implementación se validó con un
  test que arma una "plataforma" LTI real (keypair propio, `/jwks`,
  `/token`, `/lineitem/scores` — HTTP real, no mocks de función) y corre
  todo el protocolo contra ella (`tests/lti.test.js`) — ver "Tests".

## Frontend — páginas

Públicas: Home, Contacto, Tienda de cursos, Detalle de curso, Carrito,
Términos y condiciones, Login, Registro.

Privadas (requieren login): Panel (intro, con banner de validación de
cuenta si corresponde), Verificar email, Perfil, Mis cursos, Classroom
(vista distinta para alumno/profesor, incluye marcar cursada completada),
Calendario (turnos alumno-profesor, vista distinta según rol), Clases en
vivo (`/clases-en-vivo`, video + chat, vista distinta según rol — ver
"Clases en vivo" más arriba) y su sala (`/clases-en-vivo/:id/sala`),
Creador de CV (con el perfil guardado, se precarga solo, y la sección
"Generar CV para IA" para ChatGPT/Claude/Gemini — ver "CV para IA" más
arriba), Mis datos de CV (`/cv/datos`, ver "Mis datos de CV" más arriba),
Sandbox de orquestación de agentes (`/agentes`, alumno y
profesor). Logros (`/logros`), Integraciones IA (`/integraciones-ia`,
ver "Integraciones IA" más arriba) y GPTs (`/gpts`, ver "GPTs" más
arriba) son privadas y exclusivas de alumnos.
`/lti/entrando` es pública pero no
navegable a mano — es la página de aterrizaje de un launch de LTI (ver
"Integración LMS real" más arriba), que cambia el código de un solo uso
por la sesión real y entra directo al curso conectado.

El menú de navegación y el panel/intro (`/panel`) también cambian según el
rol: alumno y profesor no ven las mismas opciones, porque cumplen
funciones distintas en la plataforma (ver `Navbar.jsx` y `UserHome.jsx`).
El ícono de carrito en el menú (con contador) es visible para invitados y
alumnos (ver "Carrito de compras" más arriba) — se oculta solo para
profesor/admin, que no compran cursos.

**Detalle de curso (`/tienda/:id`)** muestra, además de título/precio/
descripción: quién lo dicta (`profesor_nombre`/`profesor_apellido` vía
`course.model.js::findByIdConProfesor`) y un preview del temario ("Qué
vas a ver en este curso", unidades y capítulos sin el contenido real —
videos y archivos quedan ocultos hasta estar inscripto). Tiene "Comprar
ahora" (inscribe directo, requiere cuenta) y "Agregar al carrito"
(funciona sin cuenta, ver carrito de invitado). Las tarjetas de curso en
la tienda (`CourseCard.jsx`) tienen un botón negro "Ver curso" que lleva
acá.

Además, en **todas** las páginas públicas y privadas (vía `Layout.jsx`) hay
un widget flotante de **chat de soporte** (💬, abajo a la derecha), visible
solo para alumnos y profesores logueados — ver "Chat de soporte en vivo"
más arriba para el detalle completo.

## Panel de administración (`/admin-panel`)

Área separada del sitio público, con su propio login (`/admin-panel/ingresar`)
y layout (sidebar), protegida por rol `admin`:

- **Dashboard** (`/admin-panel`): cursos vendidos, alumnos, cursos
  completados, tareas revisadas, y una tabla de profesores con cursos que
  dictan y tareas revisadas/pendientes.
- **Profesores** (`/admin-panel/profesores`): alta de cuentas de profesor
  (única forma de crearlas) y listado de las existentes.
- **Agentes de soporte** (`/admin-panel/soporte`): alta de cuentas de
  soporte (mismo patrón que Profesores — es la única forma de crearlas) y
  listado de las existentes. Reutiliza el endpoint genérico
  `GET/POST /api/admin/users?rol=soporte`, sin lógica nueva del lado del
  backend.
- **Chats** (`/admin-panel/chats`): registro de solo lectura de todas las
  conversaciones del chat de soporte (abiertas y cerradas), filtrable por
  estado, con la transcripción completa de cualquiera expandible por fila
  — ver "Chat de soporte en vivo" más arriba.
- **Integraciones LMS (LTI)** (`/admin-panel/lti`): alta de plataformas
  LTI 1.3 conectadas a esta app — ver "Integración LMS real (LTI 1.3)"
  más arriba para el detalle técnico completo. Arriba de todo muestra las
  **3 URLs de la herramienta** que hay que cargar del lado del LMS al
  registrarla (login OIDC, launch y JWKS), cada una con botón de copiar.
  El formulario de alta/edición pide: nombre descriptivo, **curso
  destino** (a qué curso local mapea esta integración — un desplegable
  con los cursos existentes), y los datos que da el LMS al registrar la
  herramienta (issuer, client\_id, deployment\_id, y las 3 URLs del lado
  del LMS: auth, token y JWKS). La tabla de plataformas listadas permite
  **Editar**, **Activar/Desactivar** (una plataforma desactivada rechaza
  cualquier intento de login/launch aunque las credenciales sean
  correctas — corta el acceso sin borrar la configuración) y **Borrar**
  por fila.
- **CV para IA** (`/admin-panel/cv-ia`): editor de las 3 plantillas HTML
  de "CV para IA" (ChatGPT/Claude/Gemini, ver "CV para IA" más arriba) —
  mismo patrón que el editor de plantillas de mail: HTML completo por
  plantilla (no un fragmento), lista de variables disponibles, vista
  previa con valores de ejemplo y **Activa/Inactiva** por fila (una
  plantilla inactiva deja de aparecer como opción en el Creador de CV).
  Las 3 claves son fijas — se edita el contenido de una existente, no se
  crean ni se borran plantillas nuevas desde acá.
- **Integraciones IA** (`/admin-panel/ai-integraciones`): editor de los 3
  instructivos (ChatGPT/Claude/Gemini, ver "Integraciones IA" más arriba)
  que ve el alumno al desplegar cada sección de la pestaña Vinculaciones
  — mismo patrón exacto que el editor de "CV para IA": HTML completo,
  vista previa dentro de un iframe sandboxeado y **Activo/Inactivo** por
  fila (un instructivo inactivo deja esa sección vacía, pero la IA se
  puede seguir vinculando igual — el instructivo es solo la ayuda, no un
  requisito técnico). Mismas 3 claves fijas que el resto de los
  editores de este estilo.
- **Cursos** (`/admin-panel/cursos`): crear cursos nuevos (asignando
  profesor) y editar los existentes, con subida de imagen de portada. El
  botón **"Contenido"** de cada fila abre el editor del temario completo
  (unidades, capítulos, videos, archivos de utilidad y comentarios — ver
  "Temario del curso" más abajo), para no depender de que el admin tenga
  sesión como profesor en algún classroom. Dentro del formulario de
  edición hay además un link directo **"Editar contenido del curso →"**
  al lado del título — antes, para pasar de editar los datos del curso a
  editar su temario había que cerrar el formulario y volver a buscar el
  botón "Contenido" en la fila; ahora es un solo click sin salir de la
  edición en curso.
  - **Categoría**: desplegable con una lista fija (`backend/src/config/
    categorias.js`, servida en `GET /api/courses/categories`) — antes era
    texto libre, lo que permitía inconsistencias (mayúsculas distintas,
    typos) entre cursos. El backend no rechaza una categoría que no esté
    en la lista al guardar (para no romper un curso viejo con una
    categoría que ya no está ahí), así que la lista es un control del
    lado del formulario, no una restricción dura de la base.
  - **Estado** (`backend/src/config/estadosCurso.js`, columna
    `courses.estado`): otro desplegable, con cuatro valores —
    **Subido** (normal: visible en la tienda y comprable), **En
    revisión** (no aparece en la tienda ni se puede comprar),
    **Cancelado** (no se puede comprar más, pero un alumno que ya lo
    tenía comprado sigue con acceso normal al classroom — no se le saca
    nada) y **Fuera de sistema** (no lo ve nadie, ni siquiera un alumno
    que ya lo había comprado — el profesor dueño y el admin son la única
    excepción, para poder reactivarlo). La tabla de cursos muestra el
    estado de cada uno con un badge de color. Esta lógica se valida del
    lado del servidor en varios puntos a la vez, no solo ocultando cosas
    en el front: `courses.controller.js` (catálogo público y compra
    directa), `cart.controller.js` (agregar al carrito y checkout),
    `classroom.controller.js`/`curriculum.controller.js` (acceso al
    classroom y al temario) y `enrollment.model.js` ("mis cursos").
- **Contenido del sitio** (`/admin-panel/contenido`): dividido en
  sub-pestañas, una por página pública más "Generales". Todo el registro de
  campos vive en `frontend/src/config/content.js` (`CONTENT_PAGES`) — para
  agregar un campo nuevo alcanza con sumarlo ahí y leerlo con `useContent()`
  en la página pública correspondiente.
  - **Generales**: logo + alt, **logo para fondos oscuros** (opcional —
    variante clara para el footer/secciones oscuras; si no se carga, cae al
    logo normal, ver `Footer.jsx`), **favicon** (PNG o SVG, se aplica tanto
    al sitio público como al panel de admin — es el único campo de este
    grupo que sí corre en el admin, ver nota de alcance más abajo),
    tipografía de títulos/texto (lista curada de Google Fonts, se aplica a
    todo el sitio público vía `useFonts()`), **4 colores globales**
    (primario, acento, fondo oscuro, texto sobre fondo oscuro — se aplican
    como variables CSS en `:root` vía `useTheme()`, mismo mecanismo que
    `useFonts()`: si no se carga un color queda el default de
    `global.css`), sufijo de título y meta descripción por defecto (SEO),
    links extra de menú/footer (además de la navegación funcional por rol,
    que sigue en código), y el **registro de botones**: cada "Opción N"
    define color de fondo, color de texto y link — se define acá una sola
    vez y se reutiliza en cualquier página.

  **La identidad visual por defecto es la de [aiviento.com](https://aiviento.com)**
  — negro (`#000000`) como color primario, verde lima (`#a5e84f`) como
  acento, secciones oscuras en negro puro con texto blanco, y las mismas
  tipografías (Syne/Inter) y logo (wordmark AIVIENTO, con una variante
  clara embebida como `data:image/png;base64,...` para el footer). Estos
  son los `default` de cada campo en `frontend/src/config/content.js` —no
  filas en la base— así que un sitio recién instalado, o uno cuya tabla
  `site_content` está vacía, arranca automáticamente con esta identidad
  sin que el admin tenga que cargar nada. Si el admin edita un color/logo
  desde este panel, esa fila en la base pisa el default; si más adelante
  se quiere volver a la identidad de aiviento alcanza con borrar esa fila
  (o dejar el campo en blanco al editar). `global.css` tiene los mismos
  valores como fallback de CSS puro (por si el JS de `useTheme()`/
  `useFonts()` todavía no corrió).
  - **Home / Contacto / Tienda / Detalle de curso / Términos / Ingresar /
    Crear cuenta**: cada una en su propia sub-pestaña, con sus textos,
    imágenes, color de fondo/acento y SEO propio (título + meta
    descripción, con fallback al de Generales). Los botones de cada página
    tienen un selector para elegir qué "Opción N" del registro usan. Los
    botones que disparan una acción (enviar el formulario, comprar,
    ingresar, crear cuenta) solo toman el **color** de la opción elegida —
    el link queda fijo en código porque no tendría sentido que un botón de
    "Enviar mensaje" navegue a otro lado en vez de mandar el formulario.
    Tienda no tiene un botón asignable porque cada tarjeta de curso es
    dinámica (no hay "el botón" fijo de esa página).
  - **Zona horaria del sitio** (`general.zona_horaria`, dentro de
    Generales): con qué hora se muestran **todas** las fechas de la
    plataforma — calendario, sesiones, registro de errores/mails,
    comentarios del temario, chats de soporte, etc. Selector con una
    lista curada de zonas por país (`frontend/src/config/timezones.js`,
    identificadores IANA reales — el mismo formato que entiende
    `Intl.DateTimeFormat`), por defecto **Argentina (GMT-3)**. El alcance
    es de **visualización**: no cambia en qué momento real corren los
    jobs programados (recordatorio de turno, carrito abandonado, etc.),
    que siguen su propio horario de servidor — ver "Decisiones
    pendientes" más abajo. `frontend/src/utils/fecha.js` centraliza el
    formateo (se mantiene al día automáticamente apenas carga el
    contenido del sitio, sin tener que pasar la zona horaria como prop
    por cada página) y `backend/src/utils/fecha.js` hace lo mismo del
    lado del servidor para el contenido de los mails de calendario
    (fecha/hora del turno que ve el alumno/profesor en su bandeja).
- **Mails** (`/admin-panel/mails`): backoffice completo del sistema de
  mails — ver "Backoffice de mails" más arriba.
- **Pagos** (`/admin-panel/pagos`): listado de solo lectura de las órdenes
  de pago real (Mercado Pago/PayPal), con filtro por estado y los datos
  del alumno — el pago simulado no genera filas acá. También la tasa de
  cambio ARS→USD que usa PayPal — ver "Pagos reales" más arriba.
- **Calendario** (`/admin-panel/calendario`): registro de **todos** los
  turnos solicitados en la plataforma (alumno, profesor, curso, horario,
  motivo y estado), con filtro por estado. Es de solo lectura — aceptar,
  rechazar o cancelar sigue siendo cosa del alumno y el profesor
  involucrados, no del admin.
- **Clases en vivo** (`/admin-panel/clases-en-vivo`): a diferencia del
  Calendario, acá el admin **sí** actúa — es el único que agenda una clase
  en vivo (curso, título, descripción, fecha/hora, duración y uno o más
  profesores a cargo, con checkboxes para el co-dictado). Edición y
  cancelación solo están habilitadas mientras la clase sigue `programada`
  (ver "Clases en vivo" más arriba); iniciar/finalizar la transmisión en
  sí es del profesor asignado, no aparece acá.
- **Errores** (`/admin-panel/errores`): registro de errores 5xx reales de
  la aplicación, capturados automáticamente por el `errorHandler` central
  (`backend/src/middlewares/error.middleware.js`). A propósito no incluye
  errores 4xx (permisos, validaciones de negocio como "ya estás
  inscripto"): esos son parte del uso normal y llenarían el registro de
  ruido. Filtrable por rango de fechas, **paginado de a 20** (`GET
  /api/admin/errores` acepta `page` y devuelve `{errores, total, page,
  totalPages}` — ver `errorLog.model.js::listPage`), con controles
  "← Anterior" / "Siguiente →" y el total a la vista. Tiene además un
  botón **"Limpiar registro"** (con confirmación) que borra todas las
  filas — pensado para arrancar de cero después de resolver una tanda de
  errores conocidos; se deshabilita solo si el registro ya está vacío.
- **Usuarios** (`/admin-panel/usuarios`): edición de cuentas existentes —
  cambiar el email o resetear la contraseña de cualquier usuario (alumno,
  profesor o admin). No hay autoservicio para esto todavía (decisión
  explícita: cambios de cuenta quedan centralizados en el admin, no en
  `/perfil`) — es la única vía si alguien pierde acceso a su cuenta o hay
  que corregir un dato mal cargado. `PUT /api/admin/users/:id` acepta
  `email` y/o `password`, ambos opcionales e independientes. **Resetear
  la contraseña cierra automáticamente todas las sesiones abiertas de ese
  usuario** (`loginLogModel.revocarTodasDeUsuario`) — si el motivo del
  reset era una cuenta comprometida, dejar la sesión vieja funcionando
  anularía el sentido del cambio. Cada fila tiene un link **"Ver
  sesiones"** directo a "Sesiones", ya filtrado a ese usuario.
- **Sesiones** (`/admin-panel/logins`): historial de conexiones de cada
  usuario — cuándo inició, cuándo terminó, desde qué **IP** y, resuelto
  por geolocalización, **país/provincia** (`backend/src/services/
  geo.service.js`, vía [ip-api.com](https://ip-api.com), gratis y sin
  API key; mejor esfuerzo, nunca bloquea un login si falla o tarda —
  timeout de 3s, resultado cacheado 6hs por IP). Una IP local/privada
  (común en desarrollo) se muestra como "Red local" sin llamar a la API.
  El admin puede **forzar el cierre de cualquier sesión abierta** con el
  botón "Cerrar sesión" — a partir de ahí el próximo request con ese
  token rebota con 401, sin esperar a que el JWT expire solo.
  - Técnicamente, esto significó dejar de ser 100% stateless con JWT: cada
    login genera un `jti` (id único) que viaja adentro del token y queda
    guardado en `login_logs` junto con ip/país/provincia; en cada request
    autenticado, `auth.middleware.js` confirma contra esa tabla que la
    sesión sigue activa (ni el usuario la cerró con logout ni el admin la
    revocó) — un chequeo extra a la base en cada request, el trade-off
    aceptado a cambio de poder invalidar una sesión de verdad. Tokens
    emitidos antes de este cambio (sin `jti`) se dejan pasar sin chequeo
    — no se pueden revocar, pero expiran solos dentro de `JWT_EXPIRES_IN`
    (ventana de transición, no un agujero permanente). Cerrar sesión en
    un dispositivo ya no afecta a los demás dispositivos logueados con la
    misma cuenta (antes, con un solo heurístico "la más reciente sin
    cerrar", un logout en el celular podía cerrar por error la sesión de
    la compu).
- **APIs** (`/admin-panel/apis`): accesos de **solo lectura**, con usuario
  y contraseña propios (no el login de la app), para que sistemas
  externos consulten datos de la plataforma — tabla por tabla y **columna
  por columna**, nunca "toda la tabla" por defecto. Dos pestañas:
  - **Accesos**: crear un acceso nuevo (elige el usuario, la contraseña se
    genera sola) — la contraseña se muestra **una única vez**, en texto
    plano, justo al crearla o regenerarla; después queda hasheada y no
    hay forma de volver a verla (mismo criterio que un token de GitHub o
    Stripe: si se pierde, se regenera, no se recupera). Por cada acceso se
    puede activar/desactivar, regenerar la contraseña, y gestionar a qué
    tablas tiene permiso — eligiendo tabla del catálogo y tildando
    columna por columna qué se expone. Volver a guardar la misma tabla con
    otra selección de columnas **reemplaza** la anterior (no la suma), así
    se puede sacar una columna que ya se había dado.
  - **Detalle y uso**: por cada acceso, el endpoint exacto y un ejemplo de
    `curl` para cada tabla habilitada, más el **registro de uso real**:
    cuándo se consultó, cuánto tardó (ms) y desde qué IP
    (`api_usage_log`, poblado por `dataApi.controller.js` después de
    responder, sin sumarle latencia al cliente).
  - El catálogo de tablas/columnas disponibles (`GET /api/admin/
    api-clients/catalogo`) se arma consultando el esquema real de la base
    con knex (`dataCatalog.service.js`) en vez de mantener una lista a
    mano — las tablas de esta app cambian seguido. Como red de seguridad
    fija, ciertas columnas quedan **bloqueadas siempre**, sin importar lo
    que el admin elija: cualquier columna cuyo nombre contenga
    "password", "hash", "secret" o "token" (`COLUMNA_BLOQUEADA` en
    `dataCatalog.service.js`) nunca puede exponerse por esta vía, y las
    tablas internas de la propia API de datos (`api_clients`,
    `api_client_permisos`, `api_usage_log`) ni siquiera aparecen en el
    catálogo, para que un acceso no pueda autoconcederse permisos.
  - Consumo: `GET /api/data/:tabla?limit=&offset=` (no `/api/admin/...`,
    y no requiere el JWT de la app) con `Authorization: Basic
    base64(usuario:contraseña)`. `limit` por defecto 50, tope 200.
    Devuelve `{tabla, columnas, total, limit, offset, filas}`.

- **Testing** (`/admin-panel/testing`): corre la suite real de Jest del
  backend (`backend/tests/`) con un click, cada suite contra su propia base
  SQLite descartable — no toca los datos reales de la app ni reinicia el
  server (`nodemon.json` ignora `data/*` y `**/*.test.js`). Un botón
  "Correr todos los tests" los corre uno por uno y muestra cuántos tests
  pasaron por suite; si alguno falla, se puede expandir para ver el mensaje
  de error puntual. Pensado para confirmar rápido que un cambio no rompió
  nada, sin abrir una terminal. El código vive en
  `backend/src/controllers/testing.controller.js` (agregar un archivo de
  test nuevo en `backend/tests/` es sumar una línea al array `SUITES` ahí)
  — ya incluye las suites de **carrito**, **mails** y **chat de soporte**
  (esta última con sockets reales, ver "Tests" más abajo).
  Sigue sin haber tests end-to-end de navegador (tipo Playwright): lo que
  cubre esta suite es a nivel API/lógica de negocio, no la UI en sí.
- **Test Pagos** (`/admin-panel/testing/pagos`): al lado de Testing en el
  menú, no una pestaña adentro — probar Mercado Pago/PayPal de punta a
  punta como si fuera una compra manual: precio libre, elegís la
  pasarela, pagás de verdad en su checkout real (credenciales de `.env`,
  se abre en una pestaña nueva) y el estado se confirma solo (polling
  liviano contra `GET /api/payments/ordenes/:id`, la misma ruta que usa
  cualquier alumno para consultar una orden propia). No inscribe en
  ningún curso ni manda mail de confirmación — ver "Test Pagos" en la
  sección "Pagos reales" más arriba para el detalle de por qué.

**Nota de alcance:** la tipografía/colores/botones del panel de admin en
sí (sidebar, dashboard, etc.) NO se re-temean con este sistema — es una
herramienta funcional aparte, a propósito visualmente distinta del sitio
público (mismo criterio que ya se había tomado para el layout). Tampoco se
aplica a las pantallas internas del alumno/profesor logueado (Mis cursos,
Classroom, CV, Perfil, Calendario, Carrito): el pedido original hablaba de
logo/menú/footer/SEO, que son conceptos del sitio público. Si en algún
momento se quiere extender el mismo mecanismo a esas pantallas, es
agregar campos nuevos a `CONTENT_PAGES` — la arquitectura ya lo soporta.

La **única excepción** es el favicon: a diferencia de `useTheme()`/
`useFonts()`, `useFavicon()` también se llama desde `AdminLayout.jsx`,
porque el ícono de la pestaña del navegador identifica la pestaña en sí,
no es parte del "look" de una sección — tiene sentido que sea el mismo en
todo el sitio, admin incluido.

## Tests

```powershell
cd "C:\Users\Dba24\Desktop\escuela-app\backend"
npm test
```

Cubre el flujo de registro/login (incluyendo la validación de cuenta por
código de 6 dígitos), creación de curso → inscripción (compra simulada) →
logro otorgado automáticamente, el carrito de compras (agregar/quitar
items, checkout, cursos ya comprados), el panel de admin (permisos, alta
de profesor, alta/edición de curso, edición de contenido, dashboard), el
backoffice de mails (plantillas, configuración, listas con
seleccionar/quitar todos, registro de envíos, y el modo prueba de
redirección: activarlo, confirmar que un envío queda redirigido con
`redirigido_desde` registrado, y volver a apagarlo), el calendario de
turnos (solicitar, aceptar, rechazar, cancelar, permisos por
rol/titularidad, y el chequeo de superposición de horarios), el
backoffice general (links de menú/footer, registro de botones,
validación de tipos de contenido, captura automática de errores 5xx con
su paginado de a 20 y el botón de limpiar registro, y el registro de
logins con apertura/cierre de sesión y filtros), el rate limiting de
login, el chat de soporte en vivo (permisos por rol, cola compartida,
cierre, y aislamiento entre conversaciones), las rutas del propio panel
de Testing, y el temario de cursos (unidades/capítulos, los tres modos de
avance con su regla del 80%, progreso de video, comentarios —incluida la
moderación: responder y ocultar/mostrar sin borrar— y archivos de
utilidad, tanto la lógica pura en `curriculum.service.js` como los
endpoints de punta a punta), los cuatro estados de curso (visibilidad en
la tienda, bloqueo de compra, y quién mantiene o pierde el acceso al
classroom en cada uno), la edición de usuarios por el admin (cambio de
mail/contraseña, unicidad de mail, revocación forzada de sesiones al
resetear contraseña), el historial de sesiones con ip/país/provincia y
el cierre forzado de una sesión puntual (con el rechazo inmediato del
token cerrado), la API de datos de solo lectura (alta de acceso,
generación y regeneración de contraseña, permisos por tabla/columna, el
bloqueo no salteable de columnas sensibles, y el registro de uso), el
formateo de fecha/hora según la zona horaria configurable
(`utils/fecha.js`, con Argentina como default), los pagos reales con
Mercado Pago/PayPal (armado de la orden con el precio validado del lado
del servidor, webhooks, el retorno del alumno como red de seguridad, la
idempotencia entre ambos caminos, y el listado/tasa de cambio del admin —
todo mockeando el módulo `mercadopago` y el `fetch` a PayPal, nunca contra
una sandbox real), y las clases en vivo (agendar solo-admin con sus
validaciones, aviso por mail a alumnos inscriptos y profesores asignados
al agendar y al cancelar —y la ausencia deliberada de mail al editar—,
permisos de "mis clases"/sala/mensajes según rol+inscripción+estado,
iniciar/finalizar restringido al/a los profesor/es asignados, y el chat en
vivo de la sala por socket real, incluyendo que un usuario sin acceso no
se pueda unir ni mandar mensajes), y **Test Pagos** (`/admin-panel/testing/pagos`
— validaciones de título/precio/método, que solo admin puede usarla, que
la orden se crea marcada `es_prueba` con `course_id: null` y el precio
libre que puso el admin, que aparece en su propio historial, y que
confirmar el pago la marca `aprobado` de verdad SIN crear ninguna
inscripción, sin otorgar logros y sin mandar el mail de confirmación de
compra), el perfil de CV persistente (requiere sesión, `null` antes del
primer "Generar", autoguardado y lectura del mismo perfil en generaciones
sucesivas —sobreescribe, no duplica—, generación anónima que sigue
funcionando sin guardar nada, y el rechazo con 401 si un anónimo pide
incluir sus cursos de la plataforma; y el guardado manual vía
`PUT /cv/perfil` de "Mis datos de CV" —401 sin sesión, 400 sin nombre
completo, guarda y devuelve el perfil sin generar nada, y un segundo PUT
pisa el anterior en vez de duplicarlo—), el sandbox de orquestación de
agentes (permisos por rol, catálogo de proveedores, ejecución de una
cadena de 2+ agentes verificando que el contexto del paso anterior llega
al siguiente, validación de una cadena vacía, fallback a un proveedor
válido si se manda uno inexistente, CRUD completo de flujos guardados, y
aislamiento entre usuarios), y la integración LTI 1.3 (`lti.test.js` —ver
el detalle en "Integración LMS real" más arriba: login OIDC → launch
firmado → alta de usuario/inscripción → passback de nota, contra una
plataforma LMS simulada de verdad, más los casos negativos de seguridad y
el CRUD/permisos del panel de admin), y el CV para IA (`cvAi.test.js` —
catálogo de destinos activos/inactivos, validaciones de destino faltante/
inexistente/inactivo, el nivel sugerido subiendo de inicial a avanzado a
medida que se completan los 3 cursos de la categoría IA —confirmando
además que completar un curso de OTRA categoría no lo mueve—, las
recomendaciones de contenido excluyendo lo ya completado, que los datos
del alumno lleguen escapados en el HTML resultante, y el CRUD/permisos
del editor de plantillas del admin), y las Integraciones IA
(`ai.test.js` — permisos exclusivos de alumno (401/403), vincular/
desvincular con la key siempre cifrada en la base (nunca en texto plano,
ni siquiera en la respuesta del endpoint), que vincular de nuevo pisa la
key anterior en vez de duplicarla, que crear una conversación sin
vincular da 409, el flujo completo de chat con **fetch mockeado** contra
las 3 APIs reales (OpenAI/Anthropic/Gemini — nunca pega a un proveedor de
verdad ni en este test ni en CI, mismo criterio que PayPal en
`paymentsService.test.js`) verificando que el historial completo se manda
como contexto en cada mensaje nuevo, que un fallo de la IA no hace perder
el mensaje del alumno, que un alumno no puede ver ni mandar mensajes en
la conversación de otro, que desvincular oculta esos chats de "Registros"
sin borrarlos, el CRUD/permisos del editor de instructivos del admin, y
los GPTs propios —validaciones de alta, aislamiento entre alumnos,
crear conversación con un GPT no vinculado da 409, que el proveedor de la
conversación se DERIVA del GPT, y que el system prompt combinado llega en
el formato correcto a cada uno de los 3 proveedores (role "system" en
OpenAI, campo "system" en Anthropic, "systemInstruction" en Gemini),
verificando además que editar o borrar el GPT nunca cambia
retroactivamente el comportamiento de una conversación ya creada—).
**302 tests, 22 suites, todo verde.**

Las suites de chat (`chat.test.js`) y de clases en vivo
(`liveClasses.test.js`) son una excepción a la falta de tests de
navegador de más abajo: en vez de solo pegarle a los endpoints REST,
levantan un servidor HTTP real y conectan clientes de `socket.io-client`
de verdad (alumno, profesor, soporte y admin según el caso) para probar
el flujo completo en vivo — mandar y recibir mensajes por socket, cerrar
un chat, unirse a la sala de una clase, y que un usuario sin acceso no
pueda meterse en una conversación o clase ajena — no solo que la lógica
de negocio esté bien, sino que la infraestructura de WebSockets en sí
funciona de punta a punta. `liveClasses.test.js` además arranca
`chatSocket.js` y `liveClassSocket.js` sobre la MISMA instancia `io`,
mismo criterio que usa `app.js` en producción (ver "Clases en vivo" más
arriba).

Los jobs programados y el envío real de mails (SMTP) **no** corren durante
los tests: los jobs solo arrancan si el módulo se ejecuta como server real
(`require.main === module`, mismo guard que ya usaba `app.listen()`), y
`mail.service.js` en modo prueba tampoco toca la red real salvo para crear
la casilla descartable de Ethereal.

También se puede correr suite por suite (o todas) desde el navegador, sin
terminal, en `/admin-panel/testing` (ver sección de Panel de administración
más arriba) — mismo resultado, más cómodo para un chequeo rápido.

## Decisiones y próximos pasos pendientes

- **Pagos reales:** ya conectados (Mercado Pago Checkout Pro + PayPal
  Orders v2 — ver "Pagos reales" más arriba), quedan activos completando
  las variables en `.env`. Trade-offs deliberados: la confirmación es
  asíncrona (webhook + retorno del alumno como red de seguridad, nunca se
  confía en el body/query de esas requests sin volver a preguntarle al
  proveedor), la conversión ARS→USD de PayPal usa una tasa manual (no una
  API de cotización en tiempo real), y no hay reintentos automáticos de
  cobro ni suscripciones/pagos recurrentes — cada compra es un pago único.
- **Envío de emails:** ya está armado el motor completo (verificación,
  carrito abandonado, confirmación de compra, inactividad, felicitaciones,
  turnos, ofertas/avisos a listas) y arranca en **modo prueba** (Ethereal)
  para no mandar nada real por accidente. Para pasar a producción alcanza
  con completar `SMTP_HOST` y compañía en `backend/.env` — no hace falta
  tocar código.
- **Storage de archivos:** las entregas de tareas se guardan en disco local
  (`backend/uploads/`). Ya está aislado en `storage.service.js` para migrar
  a S3 (o similar) sin tocar controllers ni modelos — para producción con
  más de una instancia del server conviene hacerlo, porque disco local no
  se comparte entre instancias ni sobrevive a que se recree el contenedor.
- **Integración LTI 1.3 — falta la prueba contra un LMS real:** el
  protocolo entero (login OIDC, verificación de firma del `id_token`
  contra el JWKS del LMS, passback de notas vía AGS) está probado a fondo
  en `lti.test.js` contra una plataforma LMS simulada de verdad —levanta
  su propio servidor HTTP con keypair RSA propio y verifica que nuestras
  requests firmadas son válidas de punta a punta—, pero eso no reemplaza
  registrar la herramienta en un Moodle/Canvas/etc. real y confirmar el
  handshake en producción, que todavía no se hizo porque no había un LMS
  disponible para probar en este entorno. Tampoco hay Deep Linking (elegir
  qué curso lanzar desde el propio LMS) ni Names and Roles Provisioning —
  hoy el mapeo es 1 plataforma LTI = 1 curso local, fijado al registrar la
  integración desde el admin.
- **Sandbox de agentes — hoy 100% simulado:** el motor de ejecución ya
  está pensado como un registro de proveedores intercambiable (ver
  "Sandbox de orquestación de agentes" más arriba), pero conectar Claude,
  Gemini, ChatGPT o un modelo propio alojado en un host privado de verdad
  todavía no se hizo — falta sumar las claves de API correspondientes y un
  módulo de proveedor real por cada una, sin tocar el resto del sistema.
- **Integraciones IA — la ÚNICA parte de la app que llama a una IA real
  hoy:** a diferencia del Sandbox de agentes y CV para IA (ambos
  simulados, ver los dos ítems de arriba/abajo), acá SÍ se le pega de
  verdad a OpenAI/Anthropic/Google — con la API key y el crédito del
  propio alumno, nunca de la plataforma. Cosas a tener en cuenta: (1) al
  vincular no se valida la key contra el proveedor real (evita gastar una
  llamada solo para confirmar el formato) — si es inválida, recién se
  entera al mandar el primer mensaje, con un error claro; (2) cada
  llamada tiene un timeout de 30s (`AbortSignal.timeout`, ver
  `services/aiChat/`); (3) un chat normal (sin GPT) es historial de
  mensajes puro, sin `system prompt` — las conversaciones que sí llevan
  instrucciones de comportamiento son las que nacen de un GPT propio (ver
  "GPTs" más arriba); (4) no hay límite de longitud de historial por
  conversación — una charla muy larga eventualmente puede pegar contra el
  límite de contexto del modelo elegido (el proveedor devuelve un error
  claro en ese caso, no rompe la app, pero no hay truncado automático
  todavía).
- **GPTs — equivalente propio, no una integración real con cada
  proveedor:** ver "GPTs" más arriba para el porqué completo (investigado
  a fondo: ninguno de los 3 expone crear Custom GPTs/Proyectos/Gems por
  API). Cosas a tener en cuenta: (1) el "conocimiento" es texto pegado sin
  límite de longitud ni subida de archivos — se manda entero en cada
  mensaje como parte del system prompt, así que un texto muy largo suma
  directo al consumo de contexto/costo de cada llamada; (2) no hay
  búsqueda semántica (RAG) — si en el futuro hiciera falta manejar
  documentos largos de conocimiento, el patrón sería sumar un paso de
  embeddings + retrieval antes de armar el system prompt, sin tocar el
  resto del flujo; (3) el "proveedor" de un GPT se puede editar libremente
  (a diferencia de nombre/instrucciones, cambiarlo no rompe nada: el
  `sistema_prompt` que quedó congelado en conversaciones viejas es texto
  plano, no depende del proveedor).
- **CV para IA — hoy es sustitución de variables, no IA de verdad:**
  mismo criterio que el sandbox de agentes de arriba: `services/cvAi/`
  ya está armado como un registro de motores intercambiable, pero el
  único motor que existe hoy (`'plantilla'`) arma el HTML sustituyendo
  `{{variables}}` en texto fijo, con nivel/recomendaciones calculados por
  reglas (cantidad de cursos IA completados) — no hay ningún modelo real
  redactando u optimizando el CV todavía. Sumar un motor `'ia'` que sí lo
  haga es un archivo nuevo en `services/cvAi/` más una entrada en el
  registro, sin tocar `cv.controller.js` ni el frontend.
- **Testing end-to-end de navegador:** el panel de Testing (ver arriba)
  cubre auth/cursos/carrito/mails/admin/calendario/backoffice a nivel API
  con Jest, pero no hay todavía algo tipo Playwright que maneje un
  navegador real y reproduzca los flujos completos de UI — lo que se
  probó de esa forma en esta última ronda de QA se hizo a mano, no queda
  automatizado.
- **Frontend/QA:** este README y el código cubren el backend y el frontend
  a nivel funcional; falta una revisión de diseño/UX más fina si se quiere
  llevar a producción.
- **Chat de soporte — alcance actual:** cubre lo pedido (widget en vivo,
  panel de soporte con cola compartida, registro de admin). Cosas que NO
  se pidieron y por eso no están: paginación del historial (hoy carga todo
  el hilo entero, viable mientras las conversaciones sean cortas),
  indicador de "escribiendo…", confirmación de lectura, ni notificaciones
  push cuando soporte está desconectado del panel — si el proyecto crece,
  son las próximas mejoras naturales sobre `chatSocket.js`.
- **Clases en vivo — alcance actual:** video con Jitsi Meet embebido
  (servidor público `meet.jit.si`, gratis) en vez de una integración con
  Zoom/Meet/una infraestructura de WebRTC propia — la External API de
  Jitsi da video + audio + compartir pantalla sin necesitar cuenta ni
  backend adicional, a costa de depender de la disponibilidad del servidor
  público (mitigable el día de mañana apuntando `JITSI_DOMAIN` a un Jitsi
  propio, sin tocar código). Cosas que NO se pidieron y por eso no están:
  grabación de la clase, límite de participantes, salas de espera/lobby,
  ni un indicador de "quién está conectado" más allá del chat en sí — si
  el proyecto crece, son las próximas mejoras naturales sobre
  `liveClassSocket.js`/`JitsiRoom.jsx`. También quedó afuera a propósito
  (no se pidió) que el alumno pueda ver el chat/video de una clase ya
  `finalizada`: la sala se cierra con la clase, aunque el historial de
  texto sigue disponible por `GET /mensajes`.
- **Cuentas y sesiones — alcance actual:** cambiar email/contraseña y
  cerrar sesiones abiertas es, a propósito, **solo del admin** (decisión
  explícita, no una limitación técnica) — no hay autoservicio desde
  `/perfil` todavía para que un alumno/profesor cambie su propio email,
  resetee su contraseña o vea/cierre sus propias sesiones por dispositivo.
  Si se quiere sumar, el mismo mecanismo de abajo (`jti` + `login_logs`)
  ya lo soporta — falta solo la UI y los endpoints con `requireAuth` en
  vez de `requireRole('admin')`.
- **Zona horaria — alcance actual:** el selector (`general.zona_horaria`)
  controla cómo se **muestran** las fechas en todo el sitio y en los
  mails de calendario, pero no en qué momento real corren los jobs
  programados (`recordatorioCitas.job.js`, carrito abandonado,
  inactividad) — esos siguen corriendo según la hora del servidor donde
  esté desplegado. Si se quiere que también respeten la zona horaria
  configurada (por ejemplo, para que "30 minutos antes" se calcule en
  hora Argentina sin importar en qué zona esté el servidor), es un cambio
  aparte sobre esos jobs, no cubierto todavía.
- **API de datos — alcance actual:** es de **solo lectura** (no hay forma
  de escribir/modificar datos a través de `/api/data/:tabla`, a
  propósito). La geolocalización de IP (país/provincia en "Sesiones") usa
  un servicio externo gratuito (ip-api.com) sin API key — para un volumen
  alto de logins simultáneos podría convenir pasar a una base GeoIP local
  (tipo MaxMind GeoLite2) para no depender de un tercero externo ni de su
  límite de 45 consultas/minuto (mitigado hoy con una cache de 6hs por
  IP, pero sigue siendo una dependencia externa).
