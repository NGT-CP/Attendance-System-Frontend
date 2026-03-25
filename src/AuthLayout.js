import React from 'react';
import { Outlet } from 'react-router-dom';
import './AuthLayout.css'; // We will create this next

const AuthLayout = () => {
    return (
        <div className="auth-container">
            {/* The video is now permanent while on Auth pages */}
            <video autoPlay muted loop playsInline className="bg-video">
                <source src="/Star_bgl.mp4" type="video/mp4" />
            </video>

            <div className="auth-content">
                {/* This is where Login.js or Register.js will render */}
                <Outlet />
            </div>
        </div>
    );
};

export default AuthLayout;