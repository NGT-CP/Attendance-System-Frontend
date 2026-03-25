import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./login.css";
import API from '../services/api';

function Login({ onLogin }) {
    const navigate = useNavigate();
    const [loginData, setLoginData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                    <input
                        name="password"
                        type="password"
                        placeholder="Password"
                        value={loginData.password}
                        onChange={handleChange}
                    />

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