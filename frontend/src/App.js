import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/toaster";

// Components
import Login from "./components/Login";
import Layout from "./components/Layout";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminBuildings from "./pages/admin/AdminBuildings";
import AdminZones from "./pages/admin/AdminZones";
import AdminChecklists from "./pages/admin/AdminChecklists";
import AdminCleaners from "./pages/admin/AdminCleaners";
import AdminAssignments from "./pages/admin/AdminAssignments";

// Cleaner pages  
import CleanerDashboard from "./pages/cleaner/CleanerDashboard";
import CleanerHistory from "./pages/cleaner/CleanerHistory";
import TaskExecution from "./pages/cleaner/TaskExecution";

// Protected Route component
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/cleaner/dashboard'} replace />;
  }
  
  return <Layout>{children}</Layout>;
};

function AppContent() {
  const { user } = useAuth();
  
  return (
    <div className="App">
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={user ? (
            <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/cleaner/dashboard'} replace />
          ) : (
            <Login />
          )} 
        />
        
        {/* Admin routes */}
        <Route 
          path="/admin/dashboard" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/buildings" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminBuildings />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/zones" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminZones />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/checklists" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminChecklists />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/cleaners" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminCleaners />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/admin/assignments" 
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminAssignments />
            </ProtectedRoute>
          } 
        />
        
        {/* Cleaner routes */}
        <Route 
          path="/cleaner/dashboard" 
          element={
            <ProtectedRoute requiredRole="cleaner">
              <CleanerDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cleaner/history" 
          element={
            <ProtectedRoute requiredRole="cleaner">
              <CleanerHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/cleaner/task/:taskId" 
          element={
            <ProtectedRoute requiredRole="cleaner">
              <TaskExecution />
            </ProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route 
          path="/" 
          element={
            user ? (
              <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/cleaner/dashboard'} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
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