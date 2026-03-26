import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startAttendanceSession, markStudentAttendance, updateClassName, regenerateClassCode, deleteClass, markClassCancelled } from '../services/api';
import './ClassDashboard.css';
import CreateNotice from './CreateNotice';
import API from '../services/api';
import io from 'socket.io-client';

const IconBack = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const IconLocation = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>;
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

function ClassDashboard() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [classData, setClassData] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showRosterModal, setShowRosterModal] = useState(false);

    const [notices, setNotices] = useState([]);
    const [activeNotice, setActiveNotice] = useState(null);
    const [comment, setComment] = useState('');

    // ✅ FIX: Replaced liveSocket state with a stable ref and a refresh trigger
    const socketRef = useRef(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [showNoticeModal, setShowNoticeModal] = useState(false);
    const [attendanceDict, setAttendanceDict] = useState({});
    const [roster, setRoster] = useState([]);

    const [useGps, setUseGps] = useState(true);
    const [sessionCode, setSessionCode] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [inputCode, setInputCode] = useState('');
    const [geoMessage, setGeoMessage] = useState('');

    const [ShowSettings, setShowSettings] = useState(false);
    const [NewName, setNewName] = useState('');

    const [viewDate, setViewDate] = useState(new Date());

    const fetchClassData = useCallback(async () => {
        setIsLoading(true);
        try {
            const authRes = await API.get('/auth/me');
            if (!authRes.data.success) return navigate('/login');
            setCurrentUser(authRes.data.user);

            const res = await API.get(`/classes/${id}/dashboard-data`);
            const data = res.data;

            if (data.success) {
                setClassData(data.classroom);
                const teacherCheck = data.classroom.owner_id === authRes.data.user.id;
                setIsTeacher(teacherCheck);
                setNotices(data.notices);
                setRoster(data.roster);

                const attMap = {};
                if (data.allSessions) {
                    data.allSessions.forEach(session => {
                        const dateObj = new Date(session.createdAt);
                        const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
                        if (session.session_code === 'CANCELLED') {
                            attMap[dateKey] = 'CANCELLED';
                        } else if (teacherCheck) {
                            attMap[dateKey] = 'PRESENT';
                        } else {
                            attMap[dateKey] = 'ABSENT';
                        }
                    });
                }
                if (data.attendance) {
                    data.attendance.forEach(record => {
                        const dateObj = new Date(record.AttendanceSession.createdAt);
                        const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;
                        if (attMap[dateKey] !== 'CANCELLED') {
                            attMap[dateKey] = record.status;
                        }
                    });
                }
                setAttendanceDict(attMap);
            }
        } catch (error) {
            console.error("Dashboard Fetch Error:", error);
            alert("Failed to load dashboard data.");
            navigate('/dashboard');
        } finally {
            setIsLoading(false);
        }
    }, [id, navigate]);

    // Initial Load
    useEffect(() => { fetchClassData(); }, [fetchClassData]);

    // ✅ FIX: Triggers a silent UI refresh when the socket increments the counter
    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchClassData();
        }
    }, [refreshTrigger, fetchClassData]);

    // Timer Logic
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        } else if (timeLeft === 0 && sessionCode) {
            setSessionCode(null);
            setGeoMessage("Session Expired.");
        }
    }, [timeLeft, sessionCode]);

    // ✅ FIX: The Bulletproof Socket Connection
    useEffect(() => {
        const socketUrl = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api', '') : "http://localhost:5000";
        const token = localStorage.getItem('token');

        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            auth: { token: token },
            extraHeaders: { Authorization: `Bearer ${token}` },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000
        });

        // Store active connection safely so buttons can always reach it
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("🟢 SOCKET CONNECTED TO SERVER!");
            socket.emit("join_class_room", id);
        });

        socket.on("connect_error", (err) => console.error("🔴 SOCKET REJECTED:", err.message));

        socket.on("receive_message", () => {
            console.log("🔄 Chat update signal received!");
            setRefreshTrigger(prev => prev + 1); // Increments to trigger UI update
        });

        socket.on("update_attendance_count", () => {
            console.log("🔄 Attendance update signal received!");
            setRefreshTrigger(prev => prev + 1); // Increments to trigger UI update
        });

        return () => socket.disconnect();
    }, [id]); // 🚨 fetchClassData is GONE from here, ending the reconnect loop forever

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();
    const daysInMonth = Array.from({ length: new Date(currentYear, currentMonth + 1, 0).getDate() }, (_, i) => i + 1);

    const getAttendanceClass = (day) => {
        const dateKey = `${currentYear}-${currentMonth}-${day}`;
        const status = attendanceDict[dateKey];
        if (status === 'CANCELLED') return 'cancelled';
        if (status === 'PRESENT') return 'present';
        if (status === 'ABSENT') return 'absent';
        if (status === 'LATE') return 'bunked';
        return 'upcoming';
    };

    const handleMarkLeave = async () => {
        if (!window.confirm("Mark today as a cancelled class/leave? This will appear orange for all students.")) return;
        try {
            const res = await markClassCancelled(id);
            if (res.data.success) {
                fetchClassData();
                socketRef.current?.emit('attendance_marked', id); // Inform students
            }
        } catch (err) { alert("Failed to mark leave"); }
    };

    const handleStartAttendance = async () => {
        setIsLoading(true);
        const startSession = async (lat = null, lng = null) => {
            try {
                const res = await startAttendanceSession(id, lat, lng);
                if (res.data.success) {
                    setSessionCode(res.data.code);
                    setTimeLeft(120);
                    setGeoMessage('');
                    fetchClassData();
                }
            } catch (err) { }
            setIsLoading(false);
        };

        if (useGps) {
            navigator.geolocation.getCurrentPosition(
                pos => startSession(pos.coords.latitude, pos.coords.longitude),
                () => { alert("Location required!"); setIsLoading(false); }, { enableHighAccuracy: true }
            );
        } else { startSession(); }
    };

    const handleMarkAttendance = async () => {
        if (!inputCode) return alert("Enter code");
        setGeoMessage("Verifying Hardware & Location...");
        setIsLoading(true);

        const markSession = async (lat = null, lng = null) => {
            try {
                const res = await markStudentAttendance(id, inputCode, lat, lng);
                setGeoMessage(res.data.message);
                if (res.data.success) {
                    fetchClassData();
                    console.log("🚀 Firing Socket Event to Server!");
                    socketRef.current?.emit('attendance_marked', id); // ✅ Uses ref
                }
            } catch (err) {
                setGeoMessage(err.response?.data?.message || "Server error.");
            }
            setIsLoading(false);
        };

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                pos => {
                    if (pos.coords.accuracy > 500) {
                        setGeoMessage("Location signal too weak. Please turn on Wi-Fi or step outside.");
                        setIsLoading(false);
                        return;
                    }
                    console.log(`Student Location Accuracy: ${pos.coords.accuracy} meters`);
                    markSession(pos.coords.latitude, pos.coords.longitude);
                },
                () => markSession(),
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            markSession();
        }
    };

    const handleSendMessage = async () => {
        if (!comment.trim() || !activeNotice) return;
        try {
            const res = await API.post(`/classes/notices/${activeNotice.id}/chat`, { message: comment });
            if (res.data.success) {
                const updatedNotice = { ...activeNotice, ChatMessages: [...activeNotice.ChatMessages, res.data.chat] };
                setActiveNotice(updatedNotice);
                setNotices(notices.map(n => n.id === activeNotice.id ? updatedNotice : n));
                setComment('');

                console.log("🚀 Firing Chat Socket Event!");
                socketRef.current?.emit('send_message', { classId: id }); // ✅ Uses ref
            }
        } catch (error) {
            console.error("Chat Error:", error);
            alert(error.response?.data?.message || "Failed to send message");
        }
    };

    const handleUpdateName = async () => {
        if (!NewName.trim()) return alert("Name cannot be empty");
        try {
            const res = await updateClassName(id, NewName);
            if (res.data.success) {
                setClassData({ ...classData, class_name: NewName });
                setShowSettings(false);
            }
        } catch (err) { alert("Failed to update name"); }
    };

    const handleRegenerateCode = async () => {
        if (!window.confirm("Are you sure? Old codes will stop working.")) return;
        try {
            const res = await regenerateClassCode(id);
            if (res.data.success) {
                setClassData({ ...classData, join_code: res.data.new_code });
                alert(`Success! New code is: ${res.data.new_code}`);
            }
        } catch (err) { alert("Failed to regenerate code"); }
    };

    const handleDeleteClass = async () => {
        if (!window.confirm("WARNING: This will permanently delete the class. Continue?")) return;
        try {
            const res = await deleteClass(id);
            if (res.data.success) navigate('/dashboard');
        } catch (err) { alert("Failed to delete class"); }
    };

    if (isLoading && !classData) return <div className="class-dashboard-container"><div className="loading-state">Loading Classroom...</div></div>;
    if (!classData) return <div className="class-dashboard-container"><div className="loading-state">Class not found.</div></div>;

    return (
        <div className="class-dashboard-container">
            <header className="class-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/dashboard')}><IconBack /></button>
                    <div>
                        <h1>{classData.class_name}</h1>
                        <p className="teacher-name">Code: {classData.join_code}</p>
                    </div>
                </div>
                <div className="header-actions">
                    <button className="join-class-btn" onClick={() => setShowRosterModal(true)}>
                        👥 Members ({roster.length})
                    </button>
                    {isTeacher && (
                        <button className="setting_btn" onClick={() => { setShowSettings(true); setNewName(classData.class_name); }}>⚙️</button>
                    )}
                </div>
            </header>

            <div className="vertical-layout">
                <div className="left-main-column">

                    <div className="glass-panel">
                        <div className="calendar-header">
                            <button className="calendar-nav-btn" onClick={handlePrevMonth}>&lt;</button>
                            <h4>{viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                            <button className="calendar-nav-btn" onClick={handleNextMonth}>&gt;</button>
                        </div>

                        <div className="calendar-legend">
                            <span className="legend-item"><div className="dot present"></div> {isTeacher ? 'Session Held' : 'Present'}</span>
                            {!isTeacher && <span className="legend-item"><div className="dot absent"></div> Absent</span>}
                            <span className="legend-item"><div className="dot cancelled"></div> Leave/Cancelled</span>
                        </div>

                        <div className="calendar-grid">
                            {daysInMonth.map(day => (
                                <div key={day} className={`calendar-day ${getAttendanceClass(day)}`}>{day}</div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-panel geofence-card" style={{ marginTop: '20px' }}>
                        {isTeacher ? (
                            <>
                                <h3><IconLocation /> Generate Attendance</h3>
                                <label style={{ display: 'flex', gap: '10px', justifyContent: 'center', margin: '15px 0', color: 'var(--text-muted)' }}>
                                    <input type="checkbox" checked={useGps} onChange={(e) => setUseGps(e.target.checked)} />
                                    Enforce 50m GPS Radius
                                </label>
                                {sessionCode && timeLeft > 0 ? (
                                    <div className="live-code-display">
                                        <h2>{sessionCode}</h2>
                                        <p className="pulse-text">Expires in: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</p>
                                    </div>
                                ) : (
                                    <button className="join-class-btn large-btn" onClick={handleStartAttendance}>Generate 2-Min Code</button>
                                )}
                                <button className="leave-btn" onClick={handleMarkLeave}>Flag Today as Cancelled Class</button>
                            </>
                        ) : (
                            <>
                                <h3><IconLocation /> Mark Attendance</h3>
                                <div className="mark-input-group">
                                    <input type="text" placeholder="Enter Code" value={inputCode} onChange={(e) => setInputCode(e.target.value)} className="modal-input" />
                                    <button className="join-class-btn" onClick={handleMarkAttendance}>Submit</button>
                                </div>
                                {geoMessage && <p className={`geo-msg ${geoMessage.includes('Verifying') ? '' : (geoMessage.includes('present') ? 'success-text' : 'error-text')}`}>{geoMessage}</p>}
                            </>
                        )}
                    </div>

                    <div className="glass-panel notices-section" style={{ marginTop: '20px' }}>
                        <div className="create-notice-header">
                            <h3>Notice Board</h3>
                            {isTeacher && (
                                <button className="join-class-btn" onClick={() => setShowNoticeModal(true)}><IconPlus /> Post Notice</button>
                            )}
                        </div>

                        <div className="notice-list">
                            {notices.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No notices posted yet.</p>}

                            {notices.map(notice => (
                                <div key={notice.id} className="notice-card" style={{ marginBottom: '15px' }}>
                                    <div className="notice-header">
                                        <h4>{notice.title}</h4>
                                        <span className="notice-date">
                                            {new Date(notice.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="notice-preview">{notice.content}</p>

                                    {notice.attachment_url && (
                                        <a href={notice.attachment_url} target="_blank" rel="noopener noreferrer" className="drive-file-attachment">
                                            <span className="drive-icon">🔗</span>
                                            <span className="file-name">{notice.file_name || 'Attached Document'}</span>
                                        </a>
                                    )}

                                    <div
                                        style={{ fontSize: '13px', color: 'var(--accent)', marginTop: '10px', cursor: 'pointer', fontWeight: 'bold' }}
                                        onClick={() => setActiveNotice(activeNotice?.id === notice.id ? null : notice)}
                                    >
                                        {activeNotice?.id === notice.id ? "⬆️ Hide Replies" : `💬 Show Replies (${notice.ChatMessages?.length || 0}) ⬇️`}
                                    </div>

                                    {activeNotice?.id === notice.id && (
                                        <div className="inline-chat-section">
                                            <div className="chat-messages" style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '10px' }}>
                                                {activeNotice.ChatMessages?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No replies yet.</p>}
                                                {activeNotice.ChatMessages?.map(msg => (
                                                    <div key={msg.id} className={`chat-bubble ${msg.Sender?.id === currentUser?.id ? 'sent' : 'received'}`}>
                                                        <strong>{msg.Sender?.firstName}:</strong> {msg.message}
                                                    </div>
                                                ))}
                                            </div>

                                            {notice.allows_chat ? (
                                                <div className="chat-input-area">
                                                    <input
                                                        type="text"
                                                        placeholder="Ask a question or reply..."
                                                        value={comment}
                                                        onChange={(e) => setComment(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                                    />
                                                    <button className="send-btn" onClick={handleSendMessage}><IconSend /></button>
                                                </div>
                                            ) : (
                                                <div className="chat-locked">🔒 The teacher has disabled replies for this notice.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showNoticeModal && (
                <CreateNotice
                    classId={id}
                    onClose={() => setShowNoticeModal(false)}
                    onNoticeCreated={(newNoticeData) => {
                        setNotices([newNoticeData, ...notices]);
                    }}
                />
            )}

            {ShowSettings && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card">
                        <h2>Class Settings</h2>
                        <div className="settings-section">
                            <label>Rename Class</label>
                            <div className="input-group">
                                <input type="text" value={NewName} onChange={(e) => setNewName(e.target.value)} placeholder="Class Name" className="modal-input" />
                                <button className="join-class-btn" onClick={handleUpdateName}>Save</button>
                            </div>
                        </div>
                        <div className="settings-section">
                            <label>Class Code: <strong style={{ color: 'var(--accent)', letterSpacing: '2px' }}>{classData.join_code}</strong></label>
                            <button className="join-class-btn" style={{ width: 'fit-content' }} onClick={handleRegenerateCode}>Regenerate Code</button>
                        </div>
                        <div className="settings-section danger-zone">
                            <label style={{ color: '#ff4d4d' }}>Danger Zone</label>
                            <button className="danger-btn" onClick={handleDeleteClass}>Permanently Delete Class</button>
                        </div>
                        <div className="modal-actions" style={{ marginTop: '25px' }}>
                            <button className="cancel-btn" onClick={() => setShowSettings(false)}>Close Settings</button>
                        </div>
                    </div>
                </div>
            )}

            {showRosterModal && (
                <div className="modal-overlay" onClick={() => setShowRosterModal(false)}>
                    <div className="modal-content glass-card" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2>Class Members</h2>
                            <button className="cancel-btn" onClick={() => setShowRosterModal(false)}>✕</button>
                        </div>

                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px' }}>{roster.length} Enrolled Students</p>

                        <div className="roster-list" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                            {roster.map(user => (
                                <div key={user.id} className="roster-item" style={{ marginBottom: '10px' }}>
                                    <span className="roster-name-scroll">
                                        <div className="avatar" style={{ width: '30px', height: '30px', fontSize: '12px', marginRight: '10px' }}>
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                        {user.name}
                                        {user.isTeacher && <span className="teacher-tag" style={{ marginLeft: '10px' }}>Teacher</span>}
                                    </span>
                                    {isTeacher && !user.isTeacher && (
                                        <span className={`roster-percent ${user.percent < 75 ? 'danger-text' : 'success-text'}`}>
                                            {user.percent}%
                                        </span>
                                    )}
                                </div>
                            ))}
                            {roster.length === 0 && <p className="text-muted">No students joined yet.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClassDashboard;