import axios from 'axios';
import fpPromise from '@fingerprintjs/fingerprintjs';

const API = axios.create({
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Generate or retrieve the Device Fingerprint
const getDeviceFingerprint = async () => {
    try {
        let fp = localStorage.getItem('device_fp');
        if (!fp) {
            const fpAgent = await fpPromise.load();
            const result = await fpAgent.get();
            fp = result.visitorId;
            localStorage.setItem('device_fp', fp); // Save it so we don't recalculate
        }
        return fp;
    } catch (err) {
        console.warn("Failed to generate fingerprint:", err);
        return 'UNKNOWN_DEVICE'; // Fallback so the request doesn't crash
    }
};

// Automatically attach the JWT token AND the Device Fingerprint to every request
API.interceptors.request.use(async (req) => {
    // Attach Auth Token
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }

    // Attach Physical Device ID
    const deviceId = await getDeviceFingerprint();
    if (deviceId) {
        req.headers['x-device-fingerprint'] = deviceId;
    }

    return req;
}, (error) => {
    return Promise.reject(error);
});

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

// Note: We do NOT need to pass deviceFingerprint here because the interceptor handles it!
export const markStudentAttendance = (classId, code, lat, lng) =>
    API.post(`/classes/${classId}/attendance/mark`, { code, lat, lng });

export const markClassCancelled = (classId) =>
    API.post(`/classes/${classId}/attendance/cancel`);

// --- DASHBOARD & NOTICE ROUTES ---
export const fetchDashboardData = (classId) =>
    API.get(`/classes/${classId}/dashboard-data`);

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