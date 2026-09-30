import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import SupportRoute from './components/SupportRoute';
import SupportLayout from './components/SupportLayout';

import Home from './pages/Home';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import Store from './pages/Store';
import CourseDetail from './pages/CourseDetail';
import Cart from './pages/Cart';
import Terms from './pages/Terms';
import UserHome from './pages/UserHome';
import Profile from './pages/Profile';
import MyCourses from './pages/MyCourses';
import Achievements from './pages/Achievements';
import Classroom from './pages/Classroom';
import CourseUnitDetail from './pages/CourseUnitDetail';
import CourseChapter from './pages/CourseChapter';
import CvBuilder from './pages/CvBuilder';
import CvDatos from './pages/CvDatos';
import Calendar from './pages/Calendar';
import LiveClasses from './pages/LiveClasses';
import LiveClassRoom from './pages/LiveClassRoom';
import AgentSandbox from './pages/AgentSandbox';
import IntegracionesIA from './pages/integracionesIA/IntegracionesIA';
import Gpts from './pages/Gpts';
import VerifyEmail from './pages/VerifyEmail';
import LtiLanding from './pages/LtiLanding';
import Alertas from './pages/Alertas';
import ReportarError from './pages/ReportarError';
import { MisConsultas, ConsultaDetalle } from './pages/MisConsultas';
import Aprobacion from './pages/Aprobacion';
import Novedades from './pages/Novedades';
import Manual from './pages/Manual';
import Encuestas from './pages/Encuestas';
import BajaPublicidad from './pages/BajaPublicidad';
import NotFound from './pages/NotFound';

import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminUsers from './pages/admin/AdminUsers';
import AdminBloqueados from './pages/admin/AdminBloqueados';
import AdminAlertas from './pages/admin/AdminAlertas';
import AdminApis from './pages/admin/AdminApis';
import AdminCourses from './pages/admin/AdminCourses';
import AdminCourseCurriculum from './pages/admin/AdminCourseCurriculum';
import AdminContent from './pages/admin/AdminContent';
import AdminCalendar from './pages/admin/AdminCalendar';
import AdminLiveClasses from './pages/admin/AdminLiveClasses';
import AdminErrors from './pages/admin/AdminErrors';
import AdminLogins from './pages/admin/AdminLogins';
import AdminTesting from './pages/admin/AdminTesting';
import AdminTestPagos from './pages/admin/AdminTestPagos';
import AdminMails from './pages/admin/AdminMails';
import AdminPagos from './pages/admin/AdminPagos';
import AdminSupportAgents from './pages/admin/AdminSupportAgents';
import AdminChats from './pages/admin/AdminChats';
import AdminLti from './pages/admin/AdminLti';
import AdminCvTemplates from './pages/admin/AdminCvTemplates';
import AdminAiTemplates from './pages/admin/AdminAiTemplates';
import AdminTickets from './pages/admin/AdminTickets';
import AdminConfiguracion from './pages/admin/AdminConfiguracion';
import AdminEstadoApp from './pages/admin/AdminEstadoApp';
import AdminTrafico from './pages/admin/AdminTrafico';
import AdminVersiones from './pages/admin/AdminVersiones';
import AdminProcesos from './pages/admin/AdminProcesos';
import AdminSistema from './pages/admin/AdminSistema';
import AdminMenu from './pages/admin/AdminMenu';
import AdminPantallas from './pages/admin/AdminPantallas';
import AdminTester from './pages/admin/AdminTester';
import AdminManual from './pages/admin/AdminManual';
import AdminReportes from './pages/admin/AdminReportes';
import AdminEncuestas from './pages/admin/AdminEncuestas';
import AdminCalificaciones from './pages/admin/AdminCalificaciones';
import AdminAsistente from './pages/admin/AdminAsistente';
import AdminCampanias from './pages/admin/AdminCampanias';
import AdminOfertas from './pages/admin/AdminOfertas';

import SupportLogin from './pages/support/SupportLogin';
import SupportInbox from './pages/support/SupportInbox';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Públicas */}
        <Route path="/" element={<Home />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/tienda" element={<Store />} />
        <Route path="/tienda/:id" element={<CourseDetail />} />
        <Route path="/terminos" element={<Terms />} />
        <Route path="/ingresar" element={<Login />} />
        <Route path="/registrarme" element={<Register />} />
        {/* El carrito es público a propósito: un invitado puede armar su
            carrito en localStorage (ver CartContext.jsx) y recién se le
            pide iniciar sesión al momento de finalizar la compra — la
            propia página Cart.jsx maneja ese caso. */}
        <Route path="/carrito" element={<Cart />} />
        {/* Aterrizaje de un launch de LTI (viene de un LMS externo, todavía
            sin sesión en esta app — ver LtiLanding.jsx) */}
        <Route path="/lti/entrando" element={<LtiLanding />} />
        {/* Aprobación de un pedido de soporte (link por mail, sin login). */}
        <Route path="/aprobacion/:token" element={<Aprobacion />} />
        {/* Baja de publicidad (link al pie de cada campaña, sin login). */}
        <Route path="/baja-publicidad/:token" element={<BajaPublicidad />} />

        {/* Privadas: cualquier usuario logueado */}
        <Route element={<PrivateRoute />}>
          <Route path="/panel" element={<UserHome />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/mis-cursos" element={<MyCourses />} />
          <Route path="/classroom/:courseId" element={<Classroom />} />
          <Route path="/classroom/:courseId/unidades/:unitId" element={<CourseUnitDetail />} />
          <Route path="/classroom/:courseId/unidades/:unitId/capitulos/:chapterId" element={<CourseChapter />} />
          <Route path="/cv" element={<CvBuilder />} />
          <Route path="/cv/datos" element={<CvDatos />} />
          <Route path="/verificar-email" element={<VerifyEmail />} />
        </Route>

        {/* Privadas: solo alumnos (logros, cv, integraciones IA y GPTs son
            conceptos de alumno — se pidieron explícitamente para esta
            sección, a diferencia de /cv o /agentes que son para cualquier
            usuario logueado). GPTs depende de Integraciones IA (usa las
            IAs ya vinculadas ahí) pero vive en su propia entrada de menú,
            no como una pestaña más. */}
        <Route element={<PrivateRoute roles={['alumno']} />}>
          <Route path="/logros" element={<Achievements />} />
          <Route path="/integraciones-ia" element={<IntegracionesIA />} />
          <Route path="/gpts" element={<Gpts />} />
          <Route path="/encuestas" element={<Encuestas />} />
        </Route>

        {/* Privadas: alumno y profesor (no admin, que tiene su propia vista
            de calendario dentro del panel de administración) */}
        <Route element={<PrivateRoute roles={['alumno', 'profesor']} />}>
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/reportar-error" element={<ReportarError />} />
          <Route path="/mis-consultas" element={<MisConsultas />} />
          <Route path="/mis-consultas/:id" element={<ConsultaDetalle />} />
          <Route path="/novedades" element={<Novedades />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/calendario" element={<Calendar />} />
          <Route path="/clases-en-vivo" element={<LiveClasses />} />
          <Route path="/clases-en-vivo/:id/sala" element={<LiveClassRoom />} />
          <Route path="/agentes" element={<AgentSandbox />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Panel de administración: área aparte, con su propio login y layout. */}
      <Route path="/admin-panel/ingresar" element={<AdminLogin />} />
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin-panel" element={<AdminDashboard />} />
          <Route path="/admin-panel/profesores" element={<AdminTeachers />} />
          <Route path="/admin-panel/usuarios" element={<AdminUsers />} />
          <Route path="/admin-panel/bloqueados" element={<AdminBloqueados />} />
          <Route path="/admin-panel/alertas" element={<AdminAlertas />} />
          <Route path="/admin-panel/apis" element={<AdminApis />} />
          <Route path="/admin-panel/cursos" element={<AdminCourses />} />
          <Route path="/admin-panel/cursos/:id/temario" element={<AdminCourseCurriculum />} />
          <Route path="/admin-panel/contenido" element={<AdminContent />} />
          <Route path="/admin-panel/calendario" element={<AdminCalendar />} />
          <Route path="/admin-panel/clases-en-vivo" element={<AdminLiveClasses />} />
          <Route path="/admin-panel/mails" element={<AdminMails />} />
          <Route path="/admin-panel/pagos" element={<AdminPagos />} />
          <Route path="/admin-panel/soporte" element={<AdminSupportAgents />} />
          <Route path="/admin-panel/chats" element={<AdminChats />} />
          <Route path="/admin-panel/lti" element={<AdminLti />} />
          <Route path="/admin-panel/cv-ia" element={<AdminCvTemplates />} />
          <Route path="/admin-panel/ai-integraciones" element={<AdminAiTemplates />} />
          <Route path="/admin-panel/errores" element={<AdminErrors />} />
          <Route path="/admin-panel/tickets" element={<AdminTickets />} />
          <Route path="/admin-panel/configuracion" element={<AdminConfiguracion />} />
          <Route path="/admin-panel/estado-app" element={<AdminEstadoApp />} />
          <Route path="/admin-panel/trafico" element={<AdminTrafico />} />
          <Route path="/admin-panel/versiones" element={<AdminVersiones />} />
          <Route path="/admin-panel/procesos" element={<AdminProcesos />} />
          <Route path="/admin-panel/sistema" element={<AdminSistema />} />
          <Route path="/admin-panel/menu" element={<AdminMenu />} />
          <Route path="/admin-panel/pantallas" element={<AdminPantallas />} />
          <Route path="/admin-panel/tester" element={<AdminTester />} />
          <Route path="/admin-panel/manual" element={<AdminManual />} />
          <Route path="/admin-panel/reportes" element={<AdminReportes />} />
          <Route path="/admin-panel/encuestas" element={<AdminEncuestas />} />
          <Route path="/admin-panel/calificaciones" element={<AdminCalificaciones />} />
          <Route path="/admin-panel/asistente" element={<AdminAsistente />} />
          <Route path="/admin-panel/campanias" element={<AdminCampanias />} />
          <Route path="/admin-panel/ofertas" element={<AdminOfertas />} />
          <Route path="/admin-panel/logins" element={<AdminLogins />} />
          <Route path="/admin-panel/testing" element={<AdminTesting />} />
          <Route path="/admin-panel/testing/pagos" element={<AdminTestPagos />} />
        </Route>
      </Route>

      {/* Panel de soporte: otra área aparte, con su propio login (chat en
          vivo con alumnos/profesores — ver ChatWidget.jsx del lado público). */}
      <Route path="/soporte/ingresar" element={<SupportLogin />} />
      <Route element={<SupportRoute />}>
        <Route element={<SupportLayout />}>
          <Route path="/soporte" element={<SupportInbox />} />
          <Route path="/soporte/tickets" element={<AdminTickets />} />
          <Route path="/soporte/manual" element={<Manual />} />
        </Route>
      </Route>
    </Routes>
  );
}
