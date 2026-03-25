import axios from 'axios';
import fpPromise from '@fingerprintjs/fingerprintjs';

console.log("🚨 THE API URL REACT SEES IS:", process.env.REACT_APP_API_URL);
// Create a central axios instance
const API = axios.create({
    baseURL: 'http://localhost:5000/api', // Replace with your actual backend port
});

// Generate or retrieve the Device Fingerprint
const getDeviceFingerprint = async () => {
    let fp = localStorage.getItem('device_fp');
    if (!fp) {
        const fpAgent = await fpPromise.load();
        const result = await fpAgent.get();
        fp = result.visitorId;
        localStorage.setItem('device_fp', fp); // Save it so we don't recalculate
    }
    return fp;
};

// Automatically attach the JWT token AND the Device Fingerprint to every request
API.interceptors.request.use(async (req) => {
    // Attach Auth Token
    const token = localStorage.getItem('token');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }

    // Attach Physical Device ID
    try {
        const deviceId = await getDeviceFingerprint();
        if (deviceId) {
            req.headers['x-device-fingerprint'] = deviceId;
        }
    } catch (err) {
        console.warn("Fingerprint error:", err);
    }

    return req;
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
export const startAttendanceSession = (classId, lat, lng) =>
    API.post(`/classes/${classId}/attendance/start`, { lat, lng });

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

export default API;