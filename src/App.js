import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/login";
import Register from "./components/register";
import Dashboard from "./components/Dashboard";
import AuthLayout from './AuthLayout';
import ClassDashboard from './components/ClassDashboard';
import "./App.css";
import API, { logout, initializeCSRF } from './services/api';

function App() {
  // null = checking, true = logged in, false = not logged in
  const [isLoggedIn, setIsLoggedIn] = useState(null);

  useEffect(() => {
    const initializeApp = async () => {
      // 🛡️ CRITICAL FIX: Initialize CSRF protection FIRST
      // This fetches the CSRF token from the server and caches it for future requests
      await initializeCSRF();

      // Check local storage first. If no token, don't even bother hitting the API.
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      // Hit the /me endpoint to validate the token/cookie
      API.get('/auth/me')
        .then(res => {
          if (res.data.success) {
            setIsLoggedIn(true);
          } else {
            setIsLoggedIn(false);
          }
        })
        .catch(err => {
          console.error("Auth verification failed:", err);
          // Clear bad token if it failed
          localStorage.removeItem('token');
          setIsLoggedIn(false);
        });
    };

    initializeApp();
  }, []);

  const handleLogin = () => {
    // Token is automatically stored in HTTP-only cookie by server
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      // 🛡️ HIGH FIX: Call logout endpoint to clear HTTP-only cookie
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // 🛡️ CRITICAL FIX: Remove ALL auth tokens from localStorage
      // Includes the Bearer token fallback for localhost dev
      localStorage.removeItem("device_fp");
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("token"); // 👈 CRITICAL: Remove fallback token
      setIsLoggedIn(false);
    }
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