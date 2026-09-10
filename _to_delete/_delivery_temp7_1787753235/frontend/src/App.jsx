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
import VerifyEmail from './pages/VerifyEmail';
import LtiLanding from './pages/LtiLanding';
import NotFound from './pages/NotFound';

import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminUsers from './pages/admin/AdminUsers';
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

        {/* Privadas: solo alumnos (logros y cv son conceptos de alumno) */}
        <Route element={<PrivateRoute roles={['alumno']} />}>
          <Route path="/logros" element={<Achievements />} />
        </Route>

        {/* Privadas: alumno y profesor (no admin, que tiene su propia vista
            de calendario dentro del panel de administración) */}
        <Route element={<PrivateRoute roles={['alumno', 'profesor']} />}>
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
          <Route path="/admin-panel/errores" element={<AdminErrors />} />
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
        </Route>
      </Route>
    </Routes>
  );
}
