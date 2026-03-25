import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/Dashboard";
import AuthLayout from './AuthLayout';
import ClassDashboard from './components/ClassDashboard';
import "./App.css";
import API from './services/api';

function App() {
  // null = checking, true = logged in, false = not logged in
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsLoggedIn(false);
      return;
    }
    // Verify token with backend
    API.get('/auth/me')
      .then(res => setIsLoggedIn(res.data.success === true))
      .catch(err => {
        console.error("Auth verification failed:", err);
        setIsLoggedIn(false);
      });
  }, []);

  const handleLogin = () => {
    localStorage.setItem("isLoggedIn", "true");
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("token");
    localStorage.removeItem("device_fp");
    setIsLoggedIn(false);
  };

  // Show nothing while verifying to prevent UI flicker
  if (isLoggedIn === null) return null;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={isLoggedIn ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />} />
          <Route path="/register" element={isLoggedIn ? <Navigate to="/dashboard" /> : <Register />} />
        </Route>
        <Route path="/dashboard" element={isLoggedIn ? <Dashboard onLogout={handleLogout} /> : <Navigate to="/login" />} />
        <Route path="/classes/:id" element={isLoggedIn ? <ClassDashboard /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;