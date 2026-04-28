import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "./pages/Login";
import CambiarContrasena from "./pages/CambiarContrasena";
import Home from "./pages/Home";
import NuevaOrden from "./pages/NuevaOrden";
import MisOrdenes from "./pages/MisOrdenes";
import OrdenDetalle from "./pages/OrdenDetalle";
import Placeholder from "./pages/Placeholder";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cambiar-contrasena" element={
              <ProtectedRoute><CambiarContrasena /></ProtectedRoute>
            } />

            <Route path="/" element={<ProtectedRoute><AppLayout><Home /></AppLayout></ProtectedRoute>} />

            <Route path="/ordenes/nueva" element={
              <ProtectedRoute roles={["capturista", "admin"]}><AppLayout><NuevaOrden /></AppLayout></ProtectedRoute>
            } />
            <Route path="/ordenes/:id" element={<ProtectedRoute><AppLayout><OrdenDetalle /></AppLayout></ProtectedRoute>} />
            <Route path="/ordenes/:id/editar" element={
              <ProtectedRoute roles={["capturista", "admin"]}><AppLayout><NuevaOrden /></AppLayout></ProtectedRoute>
            } />
            <Route path="/mis-ordenes" element={
              <ProtectedRoute roles={["capturista", "admin"]}><AppLayout><MisOrdenes /></AppLayout></ProtectedRoute>
            } />

            {/* Fases siguientes */}
            <Route path="/bandeja/revision" element={
              <ProtectedRoute roles={["verificador", "admin"]}>
                <AppLayout><Placeholder titulo="Bandeja de revisión" descripcion="Disponible en la próxima fase: aprobar órdenes según tu límite, devolver con comentario y ver tu acumulado mensual." /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/bandeja/autorizacion" element={
              <ProtectedRoute roles={["autorizador", "admin"]}>
                <AppLayout><Placeholder titulo="Bandeja de autorización" descripcion="Disponible en la próxima fase: autorizar órdenes, revocar aprobaciones de verificadores en la ventana de 24h y gestionar multifirma." /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute roles={["verificador", "autorizador", "admin"]}>
                <AppLayout><Placeholder titulo="Dashboard ejecutivo" descripcion="Disponible en la próxima fase: KPIs, gasto por categoría y departamento, exportación a CSV." /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute roles={["admin"]}>
                <AppLayout><Placeholder titulo="Panel de administración" descripcion="Disponible en la próxima fase: invitar usuarios, configurar límites de autorización, gestionar empresas y catálogos." /></AppLayout>
              </ProtectedRoute>
            } />
            <Route path="/perfil" element={
              <ProtectedRoute>
                <AppLayout><Placeholder titulo="Mi cuenta" descripcion="Próximamente podrás cambiar tu contraseña y actualizar tus datos personales." /></AppLayout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
