import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import API from '../services/api';

function Login({ onLogin }) {
    const navigate = useNavigate();
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const IconEye = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
        </svg>
    );

    const IconEyeOff = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
    );

    const handleChange = (e) => {
        setLoginData({
            ...loginData,
            [e.target.name]: e.target.value
        });
    };

    const handleSocialClick = (provider) => {
        alert(`${provider} Authentication is currently disabled in this demo environment.`);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // This uses the API instance so the Fingerprint is attached!
            const res = await API.post('/auth/login', loginData);
            if (res.data.success) {
                localStorage.setItem("token", res.data.token);
                onLogin();
                navigate("/dashboard");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                {/* LEFT PANEL */}
                <div className="login-left">
                    <div className="brand">Gama</div>
                    <div className="left-text">
                        <h2>Welcome Back,</h2>
                        <h2>Let’s Continue</h2>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="login-right">
                    <h1>Log in</h1>

                    <p className="sub-text">
                        Don’t have an account?
                        <span onClick={() => navigate("/register")} style={{ cursor: 'pointer' }}> Register</span>
                    </p>

                    <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={loginData.email}
                        onChange={handleChange}
                    />
                    {/* WRAPPER IS REQUIRED FOR POSITION: ABSOLUTE TO WORK */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                        <input
                            name="password"
                            type={showPassword ? "text" : "password"} // 👈 Toggles the text visibility
                            placeholder="Password"
                            value={loginData.password}
                            onChange={handleChange} // 👈 Uses your existing loginData handler
                            style={{ width: '100%', paddingRight: '40px' }}
                        />

                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: 'absolute',
                                right: '10px',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted, #888)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0'
                            }}
                            title={showPassword ? "Hide password" : "Show password"}
                        >
                            {showPassword ? <IconEyeOff /> : <IconEye />}
                        </button>
                    </div>

                    {/* ERROR DISPLAY INJECTED HERE */}
                    {error && (
                        <p style={{ color: '#ff4d4d', fontSize: '13px', margin: '8px 0' }}>
                            {error}
                        </p>
                    )}

                    {/* BUTTON UPDATED WITH LOADING STATE */}
                    <button
                        className="primary-btn"
                        onClick={handleLogin}
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Logging in...' : 'Log in'}
                    </button>

                    <div className="divider">or login with</div>

                    <div className="social-row">
                        <button className="social google" onClick={() => handleSocialClick('Google')}>
                            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg" alt="Google" />
                            Google
                        </button>
                        <button className="social apple" onClick={() => handleSocialClick('Apple')}>
                            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg" alt="Apple" />
                            Apple
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;