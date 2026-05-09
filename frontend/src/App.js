import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/toaster";
import { roleHome } from "./lib/api";

import Login from "./components/Login";
import Layout from "./components/Layout";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import OrganizationCabinet from "./pages/OrganizationCabinet";
import CleaningCabinet from "./pages/CleaningCabinet";
import CleanerCabinet from "./pages/CleanerCabinet";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-yellow-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Layout>{children}</Layout>;
};

function AppContent() {
  const { user } = useAuth();

  return (
    <div className="App">
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to={roleHome(user.role)} replace /> : <Login />}
        />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={["super_admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/organization"
          element={
            <ProtectedRoute allowedRoles={["organization_admin"]}>
              <OrganizationCabinet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cleaning"
          element={
            <ProtectedRoute allowedRoles={["cleaning_company_admin"]}>
              <CleaningCabinet />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cleaner"
          element={
            <ProtectedRoute allowedRoles={["cleaner"]}>
              <CleanerCabinet />
            </ProtectedRoute>
          }
        />

        <Route path="/admin/dashboard" element={<Navigate to="/organization" replace />} />
        <Route path="/cleaner/dashboard" element={<Navigate to="/cleaner" replace />} />

        <Route
          path="/"
          element={user ? <Navigate to={roleHome(user.role)} replace /> : <Navigate to="/login" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;