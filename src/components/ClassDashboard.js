import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { startAttendanceSession, markStudentAttendance, updateClassName, regenerateClassCode, deleteClass, markClassCancelled, fetchStudentProfileForTeacher } from '../services/api';
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

    const socketRef = useRef(null);
    const chatMessagesRef = useRef(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [openTeacherNoticeMenuId, setOpenTeacherNoticeMenuId] = useState(null);
    const [showEditNoticeModal, setShowEditNoticeModal] = useState(false);
    const [editNoticeForm, setEditNoticeForm] = useState({ id: null, title: '', content: '', link: '', allowsChat: true });
    const [noticeModalBusy, setNoticeModalBusy] = useState(false);

    const [editingChatId, setEditingChatId] = useState(null);
    const [editingChatText, setEditingChatText] = useState('');

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

    // --- STUDENT PROFILE MODAL STATE ---
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [isFetchingStudent, setIsFetchingStudent] = useState(false);

    // --- CUSTOM MODAL STATE ---
    const [dialog, setDialog] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null });

    const showAlert = (title, message) => {
        setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: closeDialog });
    };

    const showConfirm = (title, message, onConfirmCallback) => {
        setDialog({
            isOpen: true, type: 'confirm', title, message, onConfirm: () => {
                closeDialog();
                if (onConfirmCallback) onConfirmCallback();
            }
        });
    };

    const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
    // --------------------------

    const sortNoticeChats = useCallback((noticeList = []) => {
        return noticeList.map((notice) => ({
            ...notice,
            ChatMessages: [...(notice.ChatMessages || [])].sort(
                (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            )
        }));
    }, []);

    const isWithin15Minutes = (createdAt) => {
        if (!createdAt) return false;
        const t = new Date(createdAt).getTime();
        if (Number.isNaN(t)) return false;
        return (Date.now() - t) <= (15 * 60 * 1000);
    };

    const scrollChatToBottom = useCallback(() => {
        const el = chatMessagesRef.current;
        if (!el) return;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, []);

    const fetchClassData = useCallback(async () => {
        setIsLoading(true);
        try {
            const authRes = await API.get('/auth/me');
            if (!authRes.data.success) return navigate('/login');
            setCurrentUser(authRes.data.user);

            const res = await API.get(`/classes/${id}/dashboard-data`);
            const data = res.data;

            if (data.success) {
                const normalizedNotices = sortNoticeChats(data.notices || []);
                setClassData(data.classroom);
                const teacherCheck = data.classroom.owner_id === authRes.data.user.id;
                setIsTeacher(teacherCheck);
                setNotices(normalizedNotices);
                setActiveNotice(prevActive => {
                    if (!prevActive) return null;
                    const freshNotice = normalizedNotices.find(n => n.id === prevActive.id);
                    return freshNotice || prevActive;
                });
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

            // Only handle non-auth errors here - interceptor handles 401/403
            if (error.response?.status === 404) {
                showAlert("Error", "Class not found.");
                navigate('/dashboard');
            } else if (error.response?.status !== 401 && error.response?.status !== 403) {
                showAlert("Error", error.response?.data?.message || "Failed to load dashboard data.");
                navigate('/dashboard');
            }
            // For 401/403: let interceptor handle it (no action here)
        } finally {
            setIsLoading(false);
        }
    }, [id, navigate, sortNoticeChats]);

    useEffect(() => { fetchClassData(); }, [fetchClassData]);

    useEffect(() => {
        if (refreshTrigger > 0) {
            fetchClassData();
        }
    }, [refreshTrigger, fetchClassData]);

    useEffect(() => {
        if (!openTeacherNoticeMenuId) return;

        const menuId = `teacher-notice-menu-${openTeacherNoticeMenuId}`;
        const btnId = `teacher-notice-menu-btn-${openTeacherNoticeMenuId}`;

        const handler = (e) => {
            const menuEl = document.getElementById(menuId);
            const btnEl = document.getElementById(btnId);

            const target = e.target;
            if (menuEl && (menuEl === target || menuEl.contains(target))) return;
            if (btnEl && (btnEl === target || btnEl.contains(target))) return;

            setOpenTeacherNoticeMenuId(null);
        };

        window.addEventListener('mousedown', handler);
        return () => window.removeEventListener('mousedown', handler);
    }, [openTeacherNoticeMenuId]);

    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
            return () => clearTimeout(timerId);
        } else if (timeLeft === 0 && sessionCode) {
            setSessionCode(null);
            setGeoMessage("Session Expired.");
        }
    }, [timeLeft, sessionCode]);

    useEffect(() => {
        const socketUrl = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace('/api', '') : "http://localhost:5000";

        // 🛡️ CRITICAL FIX: Explicitly send token to socket server
        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'],
            withCredentials: true,
            auth: {
                token: localStorage.getItem('token')
            },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000
        });

        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Socket connected successfully");
            socket.emit("join_class_room", id);
        });

        socket.on("receive_message", () => {
            setRefreshTrigger(prev => prev + 1);
        });

        socket.on("update_attendance_count", () => {
            setRefreshTrigger(prev => prev + 1);
        });

        // 🛡️ HIGH FIX: Add error handlers to catch auth and connection failures
        socket.on("connect_error", (error) => {
            console.error("Socket connection error:", error);
            // Log but don't show alerts for every socket error
            // The API interceptor will handle 401/403 from HTTP calls
        });

        socket.on("error", (error) => {
            console.error("Socket error:", error);
        });

        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });

        return () => socket.disconnect();
    }, [id]);

    useEffect(() => {
        if (!activeNotice?.id) return;
        const timeoutId = setTimeout(() => {
            scrollChatToBottom();
        }, 0);
        return () => clearTimeout(timeoutId);
    }, [
        activeNotice?.id,
        activeNotice?.ChatMessages?.length,
        scrollChatToBottom
    ]);

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

    const handleMarkLeave = () => {
        showConfirm("Cancel Class", "Mark today as a cancelled class/leave? This will appear orange for all students.", async () => {
            try {
                const res = await markClassCancelled(id);
                if (res.data.success) {
                    // Stop the timer and clear the code from the UI
                    setSessionCode(null);
                    setTimeLeft(0);
                    setGeoMessage('');

                    fetchClassData();
                    socketRef.current?.emit('attendance_marked', id);
                }
            } catch (err) { showAlert("Error", "Failed to mark leave"); }
        });
    };

    const handleStartAttendance = async () => {
        setIsLoading(true);
        const startSession = async (lat = null, lng = null) => {
            try {
                // 🛡️ FIX: Pass 'useGps' as the 4th argument so the backend knows the checkbox choice
                const res = await startAttendanceSession(id, lat, lng, useGps);
                if (res.data.success) {
                    setSessionCode(res.data.code);
                    setTimeLeft(120);
                    setGeoMessage('');
                    fetchClassData();
                    socketRef.current?.emit('attendance_marked', id);
                }
            } catch (err) {
                showAlert("Error", err.response?.data?.message || "Failed to start attendance session.");
            }
            setIsLoading(false);
        };

        if (useGps) {
            navigator.geolocation.getCurrentPosition(
                pos => startSession(pos.coords.latitude, pos.coords.longitude),
                () => { showAlert("Location Error", "Location is required to generate GPS attendance."); setIsLoading(false); },
                { enableHighAccuracy: true }
            );
        } else { startSession(); }
    };

    const handleMarkAttendance = async () => {
        const codeToSubmit = inputCode.trim();
        if (!codeToSubmit) return showAlert("Notice", "Please enter the attendance code.");
        setGeoMessage("Verifying Hardware & Location...");
        setIsLoading(true);

        const markSession = async (lat = null, lng = null) => {
            try {
                const res = await markStudentAttendance(id, codeToSubmit, lat, lng);
                setGeoMessage(res.data.message);
                if (res.data.success) {
                    fetchClassData();
                    socketRef.current?.emit('attendance_marked', id);
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

    const handleStudentClick = async (studentId) => {
        if (!isTeacher) return; // Only teachers can click
        setIsFetchingStudent(true);
        setShowStudentModal(true);
        try {
            const res = await fetchStudentProfileForTeacher(id, studentId);
            if (res.data.success) {
                setSelectedStudent(res.data);
            }
        } catch (err) {
            console.error("Failed to fetch student details", err);
            setShowStudentModal(false);
            showAlert("Error", err.response?.data?.message || "Failed to fetch student profile.");
        } finally {
            setIsFetchingStudent(false);
        }
    };

    const handleSendMessage = async () => {
        if (!comment.trim() || !activeNotice) return;
        try {
            const res = await API.post(`/classes/notices/${activeNotice.id}/chat`, { message: comment });
            if (res.data.success) {
                const updatedNotice = {
                    ...activeNotice,
                    ChatMessages: [...(activeNotice.ChatMessages || []), res.data.chat].sort(
                        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
                    )
                };
                setActiveNotice(updatedNotice);
                setNotices(notices.map(n => n.id === activeNotice.id ? updatedNotice : n));
                setComment('');
                socketRef.current?.emit('send_message', { classId: id });
            }
        } catch (error) {
            showAlert("Error", error.response?.data?.message || "Failed to send message");
        }
    };

    const handleTeacherToggleNoticeChat = async (notice) => {
        try {
            setNoticeModalBusy(true);
            setOpenTeacherNoticeMenuId(null);

            const newAllows = !notice.allows_chat;
            await API.put(`/classes/notices/${notice.id}/chat-enabled`, { allows_chat: newAllows });
            socketRef.current?.emit('send_message', { classId: id });
            await fetchClassData();
        } catch (err) {
            showAlert("Error", err.response?.data?.message || "Failed to update notice chat settings.");
        } finally {
            setNoticeModalBusy(false);
        }
    };

    const handleTeacherOpenEditNotice = (notice) => {
        setOpenTeacherNoticeMenuId(null);
        setEditNoticeForm({
            id: notice.id,
            title: notice.title || '',
            content: notice.content || '',
            link: notice.attachment_url || '',
            allowsChat: typeof notice.allows_chat === 'boolean' ? notice.allows_chat : true
        });
        setShowEditNoticeModal(true);
    };

    const handleTeacherSaveEditNotice = async () => {
        if (!editNoticeForm.title.trim() || !editNoticeForm.content.trim()) {
            return showAlert("Notice", "Title and content are required.");
        }

        try {
            setNoticeModalBusy(true);
            await API.put(`/classes/notices/${editNoticeForm.id}`, {
                title: editNoticeForm.title,
                content: editNoticeForm.content,
                file_url: editNoticeForm.link,
                allows_chat: editNoticeForm.allowsChat
            });
            socketRef.current?.emit('send_message', { classId: id });
            setShowEditNoticeModal(false);
            await fetchClassData();
        } catch (err) {
            showAlert("Error", err.response?.data?.message || "Failed to update notice.");
        } finally {
            setNoticeModalBusy(false);
        }
    };

    const handleTeacherDeleteNotice = (noticeId) => {
        setOpenTeacherNoticeMenuId(null);
        showConfirm("Delete Notice", "Are you sure you want to permanently remove this notice?", async () => {
            try {
                setNoticeModalBusy(true);
                await API.delete(`/classes/notices/${noticeId}`);
                setActiveNotice(prev => (prev?.id === noticeId ? null : prev));
                socketRef.current?.emit('send_message', { classId: id });
                await fetchClassData();
            } catch (err) {
                showAlert("Error", err.response?.data?.message || "Failed to delete notice.");
            } finally {
                setNoticeModalBusy(false);
            }
        });
    };

    const handleStudentStartEditChat = (msg) => {
        setEditingChatId(msg.id);
        setEditingChatText(msg.message || '');
    };

    const handleStudentCancelEditChat = () => {
        setEditingChatId(null);
        setEditingChatText('');
    };

    const handleStudentSaveEditChat = async () => {
        if (!editingChatText.trim()) return;
        try {
            const chatId = editingChatId;
            await API.put(`/classes/notices/chat/${chatId}`, { message: editingChatText });
            setEditingChatId(null);
            setEditingChatText('');
            socketRef.current?.emit('send_message', { classId: id });
            await fetchClassData();
        } catch (err) {
            showAlert("Error", err.response?.data?.message || "Failed to edit chat message.");
        }
    };

    const handleStudentDeleteChat = (chatId) => {
        showConfirm("Delete Reply", "Are you sure you want to delete this reply?", async () => {
            try {
                await API.delete(`/classes/notices/chat/${chatId}`);
                socketRef.current?.emit('send_message', { classId: id });
                await fetchClassData();
            } catch (err) {
                showAlert("Error", err.response?.data?.message || "Failed to delete chat message.");
            }
        });
    };

    const handleUpdateName = async () => {
        if (!NewName.trim()) return showAlert("Notice", "Name cannot be empty");
        try {
            const res = await updateClassName(id, NewName);
            if (res.data.success) {
                setClassData({ ...classData, class_name: NewName });
                setShowSettings(false);
            }
        } catch (err) { showAlert("Error", "Failed to update name"); }
    };

    const handleRegenerateCode = () => {
        showConfirm("Regenerate Code", "Are you sure? Old codes will immediately stop working.", async () => {
            try {
                const res = await regenerateClassCode(id);
                if (res.data.success) {
                    setClassData({ ...classData, join_code: res.data.new_code });
                    showAlert("Success", `New class code is: ${res.data.new_code}`);
                }
            } catch (err) { showAlert("Error", "Failed to regenerate code"); }
        });
    };

    const handleDeleteClass = () => {
        showConfirm("Delete Class", "WARNING: This will permanently delete the class and all its data. Continue?", async () => {
            try {
                const res = await deleteClass(id);
                if (res.data.success) navigate('/dashboard');
            } catch (err) { showAlert("Error", "Failed to delete class"); }
        });
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
                                        <div className="notice-header-right">
                                            <span className="notice-date">
                                                {new Date(notice.createdAt).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>

                                            {isTeacher && (
                                                <div className="notice-options">
                                                    <button
                                                        id={`teacher-notice-menu-btn-${notice.id}`}
                                                        className="notice-options-btn"
                                                        aria-label="Notice options"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenTeacherNoticeMenuId(prev => (prev === notice.id ? null : notice.id));
                                                        }}
                                                    >
                                                        ⋮
                                                    </button>

                                                    {openTeacherNoticeMenuId === notice.id && (
                                                        <div
                                                            id={`teacher-notice-menu-${notice.id}`}
                                                            className="notice-options-menu open"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                className="notice-options-item"
                                                                onClick={() => handleTeacherToggleNoticeChat(notice)}
                                                                disabled={noticeModalBusy}
                                                            >
                                                                {notice.allows_chat ? 'Disable replies' : 'Enable replies'}
                                                            </button>

                                                            <button
                                                                className="notice-options-item"
                                                                onClick={() => handleTeacherOpenEditNotice(notice)}
                                                                disabled={noticeModalBusy}
                                                            >
                                                                Edit notice
                                                            </button>

                                                            <button
                                                                className="notice-options-item notice-options-item-danger"
                                                                onClick={() => handleTeacherDeleteNotice(notice.id)}
                                                                disabled={noticeModalBusy}
                                                            >
                                                                Remove notice
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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
                                            <div
                                                ref={chatMessagesRef}
                                                className="chat-messages"
                                                style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '10px' }}
                                            >
                                                {activeNotice.ChatMessages?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No replies yet.</p>}
                                                {activeNotice.ChatMessages?.map((msg) => {
                                                    const isMine = msg.sender_id === currentUser?.id;
                                                    const canEdit = isMine && isWithin15Minutes(msg.createdAt);
                                                    const isEditing = editingChatId === msg.id;

                                                    return (
                                                        <div
                                                            key={msg.id}
                                                            className={`chat-bubble ${isMine ? 'sent' : 'received'}`}
                                                        >
                                                            <strong>{msg.Sender?.firstName}:</strong>

                                                            {isEditing ? (
                                                                <div className="chat-edit-area">
                                                                    <input
                                                                        type="text"
                                                                        className="chat-edit-input"
                                                                        value={editingChatText}
                                                                        onChange={(e) => setEditingChatText(e.target.value)}
                                                                        onKeyPress={(e) => e.key === 'Enter' && handleStudentSaveEditChat()}
                                                                    />
                                                                    <div className="chat-edit-actions">
                                                                        <button className="chat-action-btn" onClick={handleStudentSaveEditChat}>
                                                                            Save
                                                                        </button>
                                                                        <button className="chat-action-btn chat-action-btn-secondary" onClick={handleStudentCancelEditChat}>
                                                                            Cancel
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <p className="chat-message-text">{msg.message}</p>
                                                                    <span className="chat-time">
                                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>

                                                                    {isMine && (
                                                                        <div className="chat-bubble-actions enabled">
                                                                            {canEdit ? (
                                                                                <button
                                                                                    className="chat-action-btn chat-action-btn-icon"
                                                                                    onClick={() => handleStudentStartEditChat(msg)}
                                                                                    title="Edit reply"
                                                                                >
                                                                                    ✎
                                                                                </button>
                                                                            ) : (
                                                                                <span className="chat-action-expired" style={{ marginRight: '8px' }}>Edit expired</span>
                                                                            )}
                                                                            <button
                                                                                className="chat-action-btn chat-action-btn-icon chat-action-btn-danger"
                                                                                onClick={() => handleStudentDeleteChat(msg.id)}
                                                                                title="Delete reply"
                                                                            >
                                                                                🗑
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
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

            {/* CUSTOM DIALOG MODAL */}
            {dialog.isOpen && (
                <div className="modal-overlay" style={{ zIndex: 9999 }}>
                    <div className="modal-content glass-card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <h3 style={{ marginTop: 0 }}>{dialog.title}</h3>
                        <p style={{ margin: '20px 0', color: 'var(--text-muted)' }}>{dialog.message}</p>
                        <div className="modal-actions" style={{ justifyContent: 'center', gap: '15px' }}>
                            {dialog.type === 'confirm' && (
                                <button className="cancel-btn" onClick={closeDialog}>Cancel</button>
                            )}
                            <button className="join-class-btn" onClick={dialog.onConfirm}>
                                {dialog.type === 'confirm' ? 'Confirm' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNoticeModal && (
                <CreateNotice
                    classId={id}
                    onClose={() => setShowNoticeModal(false)}
                    onNoticeCreated={(newNoticeData) => {
                        setNotices([newNoticeData, ...notices]);
                    }}
                />
            )}

            {showEditNoticeModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card notice-edit-modal">
                        <h2>Edit Notice</h2>

                        <input
                            type="text"
                            placeholder="Notice Title"
                            value={editNoticeForm.title}
                            onChange={(e) => setEditNoticeForm({ ...editNoticeForm, title: e.target.value })}
                            className="modal-input"
                            style={{ marginTop: '10px' }}
                        />

                        <textarea
                            placeholder="Type your message here..."
                            value={editNoticeForm.content}
                            onChange={(e) => setEditNoticeForm({ ...editNoticeForm, content: e.target.value })}
                            className="notice-modal-textarea"
                        />

                        <input
                            type="text"
                            placeholder="Paste Google Drive Link (Optional)"
                            value={editNoticeForm.link}
                            onChange={(e) => setEditNoticeForm({ ...editNoticeForm, link: e.target.value })}
                            className="modal-input"
                        />

                        <div className="toggle-container">
                            <input
                                type="checkbox"
                                checked={editNoticeForm.allowsChat}
                                onChange={(e) => setEditNoticeForm({ ...editNoticeForm, allowsChat: e.target.checked })}
                            />
                            <label>Allow students to reply / ask questions</label>
                        </div>

                        <div className="modal-actions" style={{ marginTop: '25px' }}>
                            <button
                                className="cancel-btn"
                                onClick={() => setShowEditNoticeModal(false)}
                                disabled={noticeModalBusy}
                            >
                                Cancel
                            </button>
                            <button
                                className="join-class-btn"
                                onClick={handleTeacherSaveEditNotice}
                                disabled={noticeModalBusy}
                            >
                                {noticeModalBusy ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
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

                        {!isTeacher && (
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '15px', fontStyle: 'italic' }}>
                                💡 As a student, you can view attendance percentages but cannot view other students' profile details.
                            </p>
                        )}

                        <div className="roster-list" style={{ overflowY: 'auto', paddingRight: '10px' }}>
                            {roster.map(user => (
                                <div
                                    key={user.id}
                                    className="roster-item"
                                    style={{
                                        marginBottom: '10px',
                                        cursor: isTeacher ? 'pointer' : 'default',
                                        padding: '10px',
                                        borderRadius: '8px',
                                        transition: 'background 0.2s',
                                        // Optional hover effect only for teachers
                                        ...(isTeacher && { ':hover': { background: 'rgba(255,255,255,0.05)' } })
                                    }}
                                    onClick={() => isTeacher && handleStudentClick(user.id)}
                                >
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

            {/* --- STUDENT PROFILE MODAL (TEACHER ONLY) --- */}
            {showStudentModal && (
                <div className="modal-overlay" onClick={() => setShowStudentModal(false)}>
                    <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                        {isFetchingStudent || !selectedStudent ? (
                            <div style={{ textAlign: 'center', padding: '20px' }}>Loading student data...</div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
                                    <div className="avatar" style={{ width: '50px', height: '50px', fontSize: '20px' }}>
                                        {selectedStudent.student.firstName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0 }}>{selectedStudent.student.firstName} {selectedStudent.student.lastName}</h2>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{selectedStudent.student.instituteId || 'No ID Provided'}</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px' }}>
                                    <p><strong>Email:</strong> {selectedStudent.student.email}</p>
                                    <p><strong>Mobile:</strong> {selectedStudent.student.mobile || 'N/A'}</p>
                                    <p><strong>DOB:</strong> {selectedStudent.student.dob ? new Date(selectedStudent.student.dob).toLocaleDateString() : 'N/A'}</p>
                                    {/* --- BEAUTIFUL ATTENDANCE METRIC --- */}
                                    {/* Replace your old attendance <div> inside the modal with this */}
                                    <div style={{
                                        marginTop: '15px',
                                        padding: '20px',
                                        background: 'rgba(111, 92, 194, 0.1)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--accent, #6f5cc2)'
                                    }}>
                                        <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                            Class Attendance Record
                                        </p>

                                        <h3 style={{ margin: '10px 0 5px 0', color: 'var(--accent, #6f5cc2)', fontSize: '28px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                                            {selectedStudent.attendance.attended}
                                            <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 'normal' }}>out of</span>
                                            {selectedStudent.attendance.total}
                                            <span style={{ fontSize: '16px', color: 'var(--text-muted)', fontWeight: 'normal' }}>classes</span>
                                        </h3>

                                        <p style={{
                                            margin: 0,
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            color: selectedStudent.attendance.total > 0 && (selectedStudent.attendance.attended / selectedStudent.attendance.total) >= 0.75
                                                ? '#00ff88'
                                                : '#ff4d4d'
                                        }}>
                                            {selectedStudent.attendance.total > 0
                                                ? Math.round((selectedStudent.attendance.attended / selectedStudent.attendance.total) * 100)
                                                : 0}% Attendance Rate
                                        </p>
                                    </div>
                                </div>

                                <div className="modal-actions">
                                    <button className="cancel-btn" onClick={() => setShowStudentModal(false)} style={{ width: '100%' }}>Close</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ClassDashboard;