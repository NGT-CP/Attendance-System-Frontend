import React, { useState } from 'react';
import './register.css';
import { useNavigate } from "react-router-dom";
import API from '../services/api';

function Register() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: ''
    });

    // ADDED: State for the checkbox
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSocialClick = (provider) => {
        alert(`${provider} Authentication is currently disabled in this demo environment.`);
    };
    const handleRegister = async (e) => {
        e.preventDefault();

        if (!formData.firstName || !formData.email || !formData.password) {
            setError("Please fill in all required fields!");
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(formData.password)) {
            setError("Password must be at least 8 characters and include an uppercase letter, a number, and a special character (e.g., @, $, !).");
            return;
        }

        if (!agreedToTerms) {
            setError("Please agree to the Terms & Conditions.");
            return;
        }

        setLoading(true);
        setError('');

        try {
            const res = await API.post('/auth/register', formData);
            if (res.data.success) {
                navigate("/login");
            }
        } catch (err) {
            setError(err.response?.data?.message || "Registration failed.");
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
                        <h2>Capturing Moments,</h2>
                        <h2>Creating Memories</h2>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="login-right">
                    <h1>Create an account</h1>
                    <p className="sub-text">
                        Already have an account?
                        <span className="underline" onClick={() => navigate("/login")} style={{ cursor: 'pointer' }}> Log in</span>
                    </p>

                    <div className="row">
                        <input
                            name="firstName"
                            type="text"
                            placeholder="First name"
                            value={formData.firstName}
                            onChange={handleChange}
                        />
                        <input
                            name="lastName"
                            type="text"
                            placeholder="Last name"
                            value={formData.lastName}
                            onChange={handleChange}
                        />
                    </div>

                    <input
                        name="email"
                        type="email"
                        placeholder="Email"
                        value={formData.email}
                        onChange={handleChange}
                    />
                    <input
                        name="password"
                        type="password"
                        placeholder="Enter your password"
                        value={formData.password}
                        onChange={handleChange}
                    />

                    {/* CONTROLLED CHECKBOX */}
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                        />
                        <span>I agree to the <u>Terms & Conditions</u></span>
                    </label>

                    {/* ERROR DISPLAY INJECTED HERE */}
                    {error && (
                        <p style={{ color: '#ff4d4d', fontSize: '13px', margin: '8px 0' }}>
                            {error}
                        </p>
                    )}

                    {/* BUTTON UPDATED WITH LOADING STATE */}
                    <button
                        className="primary-btn"
                        onClick={handleRegister}
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Creating account...' : 'Create account'}
                    </button>

                    <div className="divider">or register with</div>

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

export default Register;