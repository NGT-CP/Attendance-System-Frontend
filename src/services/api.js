import axios from 'axios';
import fpPromise from '@fingerprintjs/fingerprintjs';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
    withCredentials: true, // 🛡️ HIGH FIX: Include HTTP-only cookies in requests
});

// 🛡️ CRITICAL FIX: Cache the CSRF token for all state-changing requests
let csrfToken = null;

// Fetch the token once when the app initializes
export const initializeCSRF = async () => {
    try {
        const res = await API.get('/csrf-token');
        csrfToken = res.data.csrfToken;
        console.log('✅ CSRF token initialized');
    } catch (err) {
        console.error("❌ Failed to fetch CSRF token:", err);
    }
};

// 🛡️ HIGH FIX: Device fingerprint cached locally for performance
// Safe to cache (not a security token like JWT) - used for fraud detection only
const getDeviceFingerprint = async () => {
    try {
        let fp = localStorage.getItem('device_fp');
        if (!fp) {
            const fpAgent = await fpPromise.load();
            const result = await fpAgent.get();
            fp = result.visitorId;
            localStorage.setItem('device_fp', fp); // Cache to avoid expensive recalculation
        }
        return fp;
    } catch (err) {
        console.warn("Failed to generate fingerprint:", err);
        return 'UNKNOWN_DEVICE'; // Fallback so the request doesn't crash
    }
};

// Automatically attach the Device Fingerprint AND Auth Token to every request
API.interceptors.request.use(async (req) => {
    // 1. Attach Device Fingerprint
    const deviceId = await getDeviceFingerprint();
    if (deviceId) {
        req.headers['x-device-fingerprint'] = deviceId;
    }

    // 🛡️ CRITICAL FIX: Provide the JWT explicitly!
    // If the browser blocks the HTTP-only cookie during local dev,
    // the backend will gracefully fall back to reading this Bearer token.
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }

    // 🛡️ CRITICAL FIX: Attach CSRF Token to state-changing requests
    // CSRF protects against malicious websites silently POST/PUT/DELETE to our API
    if (csrfToken && ['post', 'put', 'delete', 'patch'].includes(req.method)) {
        req.headers['CSRF-Token'] = csrfToken;
    }

    return req;
}, (error) => {
    return Promise.reject(error);
});

// 🛡️ HIGH FIX: Global response interceptor to handle auth errors
API.interceptors.response.use(
    response => response,
    error => {
        // 🛡️ CRITICAL FIX: Only logout on 401 (Invalid Token).
        // 403 means "Forbidden" (e.g., user too far away, not enrolled).
        // Deleting token on 403 causes the random logout bug!
        if (error.response?.status === 401) {
            // Only redirect if we're not already on login page
            if (window.location.pathname !== '/login') {
                // Clear auth data and redirect
                localStorage.removeItem('device_fp');
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// --- AUTHENTICATION ROUTES ---
export const login = (email, password) =>
    API.post('/auth/login', { email, password });

export const register = (firstName, lastName, email, password) =>
    API.post('/auth/register', { firstName, lastName, email, password });

// 🛡️ HIGH FIX: Add logout endpoint to clear HTTP-only cookie
export const logout = () =>
    API.post('/auth/logout');

// --- DASHBOARD ROUTES ---
export const fetchProfile = () => API.get('/auth/me');
export const updateProfile = (profileData) => API.put('/auth/profile', profileData);
export const fetchMyClasses = () => API.get('/classes/my-classes');
export const fetchMyNotices = () => API.get('/classes/my-notices');
export const fetchOverviewStats = () => API.get('/classes/overview-stats');

// --- CLASS CREATION & JOINING ---
export const createClass = (className) => API.post('/classes/create', { class_name: className });
export const joinClass = (joinCode) => API.post('/classes/join', { join_code: joinCode });

// --- ATTENDANCE ROUTES ---
export const startAttendanceSession = (classId, lat, lng, requireGps = true) =>
    API.post(`/classes/${classId}/attendance/start`, { lat, lng, requireGps });

// Note: Device fingerprint is automatically sent via interceptor
export const markStudentAttendance = (classId, code, lat, lng) =>
    API.post(`/classes/${classId}/attendance/mark`, { code, lat, lng });

export const markClassCancelled = (classId) =>
    API.post(`/classes/${classId}/attendance/cancel`);

// --- DASHBOARD & NOTICE ROUTES ---
export const fetchDashboardData = (classId) =>
    API.get(`/classes/${classId}/dashboard-data`);

export const fetchStudentProfileForTeacher = (classId, studentId) =>
    API.get(`/classes/${classId}/student/${studentId}`);

export const sendChatMessage = (noticeId, message) =>
    API.post(`/classes/notices/${noticeId}/chat`, { message });

// --- CLASS SETTINGS ROUTES ---
export const updateClassName = (classId, className) =>
    API.put(`/classes/${classId}/update`, { class_name: className });

export const regenerateClassCode = (classId) =>
    API.post(`/classes/${classId}/regenerate-code`);

export const deleteClass = (classId) =>
    API.delete(`/classes/${classId}/delete`);

export const changePassword = (currentPassword, newPassword) =>
    API.put('/auth/profile/password', { currentPassword, newPassword });

export const deleteAccount = () =>
    API.delete('/auth/profile');

export default API;