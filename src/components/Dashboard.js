import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfile, fetchOverviewStats, fetchMyNotices, joinClass, createClass, updateProfile, changePassword, deleteAccount } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

// --- ICONS ---
const IconDashboard = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>;
const IconClass = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>;
const IconNotice = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>;
const IconLogout = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>;
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

function Dashboard({ onLogout }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // --- DYNAMIC DATA STATES ---
    const [classes, setClasses] = useState([]);
    const [attendanceTrend, setAttendanceTrend] = useState([]);
    const [notices, setNotices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- PROFILE STATES ---
    const [profile, setProfile] = useState({ firstName: "", lastName: "", email: "", mobile: "", instituteId: "", dob: "" });
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState({});

    // ✅ NEW: Mobile Sidebar State
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

    // --- CLASS MODAL STATES ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newClassName, setNewClassName] = useState('');
    const [createError, setCreateError] = useState('');
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joinError, setJoinError] = useState('');

    const fullName = `${profile.firstName || 'Unknown'} ${profile.lastName || ''}`.trim();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const userRes = await fetchProfile();
            if (userRes.data.success && userRes.data.user) setProfile(userRes.data.user);

            const statsRes = await fetchOverviewStats();
            if (statsRes.data.success) {
                setClasses(statsRes.data.classes);
                setAttendanceTrend(statsRes.data.trend);
            }

            const noticeRes = await fetchMyNotices();
            if (noticeRes.data.notices) setNotices(noticeRes.data.notices);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- PROFILE EDIT LOGIC ---
    const handleOpenProfile = () => {
        setEditForm(profile);
        setIsEditingProfile(false);
        setShowProfileModal(true);
    };

    const handleSaveProfile = async () => {
        try {
            const res = await updateProfile(editForm);
            if (res.data.success) {
                setProfile(editForm);
                setIsEditingProfile(false);
            }
        } catch (error) {
            alert("Failed to update profile.");
        }
    };

    // --- CLASS LOGIC ---
    const handleJoinClass = async () => {
        setJoinError('');
        try {
            const res = await joinClass(joinCode);
            if (res.data.success) {
                setShowJoinModal(false);
                setJoinCode('');
                fetchDashboardData();
            }
        } catch (error) { setJoinError(error.response?.data?.message || "Server error."); }
    };

    const handleCreateClass = async () => {
        setCreateError('');
        try {
            const res = await createClass(newClassName);
            if (res.data.success) {
                setShowCreateModal(false);
                setNewClassName('');
                fetchDashboardData();
            }
        } catch (error) { setCreateError(error.response?.data?.message || "Server error."); }
    };

    if (isLoading) return <div className="dashboard-container"><div className="loading-state">Loading Command Center...</div></div>;

    return (
        <div className="dashboard-container">
            {/* ✅ UPDATED SIDEBAR: Dynamic Class & Click Handler */}
            <aside
                className={`sidebar ${isSidebarExpanded ? 'expanded' : ''}`}
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
            >
                <div className="brand-logo">Gama</div>

                <div
                    className="user-profile-mini clickable"
                    title="View Profile"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProfile();
                        setIsSidebarExpanded(false);
                    }}
                >
                    <div className="avatar">{fullName.charAt(0).toUpperCase()}</div>
                    <div className="user-info">
                        <h3>{fullName}</h3>
                        <span className="view-profile-text">View Profile</span>
                    </div>
                </div>

                <nav className="nav-menu">
                    <button
                        className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveTab('overview'); setIsSidebarExpanded(false); }}
                    >
                        <IconDashboard /> <span className="menu-text">Overview</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'classes' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveTab('classes'); setIsSidebarExpanded(false); }}
                    >
                        <IconClass /> <span className="menu-text">Classes</span>
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'notices' ? 'active' : ''}`}
                        onClick={(e) => { e.stopPropagation(); setActiveTab('notices'); setIsSidebarExpanded(false); }}
                    >
                        <IconNotice /> <span className="menu-text">Notices</span>
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={(e) => { e.stopPropagation(); onLogout(); }}>
                        <IconLogout /> <span className="menu-text">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="main-content">
                <header className="top-bar">
                    <div className="header-title">
                        <h1>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                        <p className="date-display">{new Date().toDateString()}</p>
                    </div>
                    <div className="header-actions">
                        <button className="cancel-btn create-btn" onClick={() => setShowCreateModal(true)} style={{ marginRight: '10px' }}>
                            <IconPlus /> <span>Create Class</span>
                        </button>
                        <button className="join-class-btn" onClick={() => setShowJoinModal(true)}>
                            <IconPlus /> <span>Join Class</span>
                        </button>
                    </div>
                </header>

                <div className="content-scrollable">
                    {/* OVERVIEW TAB */}
                    {activeTab === 'overview' && (
                        <>
                            <div className="stats-grid">
                                <div className="glass-card stat-card">
                                    <h3>Total Enrolled</h3>
                                    <div className="stat-value text-accent">{classes.length}</div>
                                    <p className="stat-desc">Active classes this semester</p>
                                </div>
                                <div className="glass-card stat-card">
                                    <h3>Average Attendance</h3>
                                    <div className="stat-value">{classes.length > 0 ? Math.floor(classes.reduce((acc, c) => acc + c.attendancePercent, 0) / classes.length) : 0}%</div>
                                    <p className="stat-desc">Across all subjects</p>
                                </div>
                            </div>

                            {/* --- RECHARTS ATTENDANCE GRAPH --- */}
                            {attendanceTrend.length > 0 && (
                                <div className="glass-panel graph-card" style={{ height: '300px', padding: '20px', marginTop: '25px' }}>
                                    <h3 style={{ margin: '0 0 20px 0' }}>Attendance Trend (Past 6 Months)</h3>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={attendanceTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--accent, #6f5cc2)" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="var(--accent, #6f5cc2)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(tick) => `${tick}%`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: 'rgba(25, 25, 25, 0.9)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'white' }}
                                                itemStyle={{ color: '#00ff88', fontWeight: 'bold' }}
                                            />
                                            <Area type="monotone" dataKey="attendance" stroke="var(--accent, #6f5cc2)" strokeWidth={3} fillOpacity={1} fill="url(#colorAttendance)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* --- FORMATTED TABLE --- */}
                            <h3 className="section-title" style={{ marginTop: '30px' }}>Your Enrolled Subjects</h3>
                            {classes.length === 0 ? (
                                <div className="empty-state glass-panel">
                                    <h3>No Classes Found</h3>
                                    <p>You haven't joined any classes yet. Click "Join Class" above.</p>
                                </div>
                            ) : (
                                <div className="table-container glass-panel">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Subject Name</th>
                                                <th>Instructor</th>
                                                <th>Attendance</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {classes.map((cls) => (
                                                <tr key={cls.id}>
                                                    <td style={{ fontWeight: 'bold' }}>{cls.class_name}</td>
                                                    <td className="code-cell">{cls.User ? `${cls.User.firstName} ${cls.User.lastName}` : 'Unknown'}</td>
                                                    <td>
                                                        <span className={`attendance-pill ${cls.attendancePercent >= 75 ? 'attendance-high' : cls.attendancePercent >= 60 ? 'attendance-med' : 'attendance-low'}`}>
                                                            {cls.attendancePercent}%
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <button className="mark-btn" onClick={() => navigate(`/classes/${cls.id}`)}>Enter Room</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}

                    {/* CLASSES TAB */}
                    {activeTab === 'classes' && (
                        <div className={classes.length > 0 ? "grid-layout" : ""}>
                            {classes.length === 0 ? (
                                <div className="empty-state glass-panel">
                                    <h3>You are not in any classes.</h3>
                                </div>
                            ) : (
                                classes.map(cls => (
                                    <div className="glass-card class-card" key={cls.id}>
                                        <div className="card-header">
                                            <span className="class-code">👨‍🏫 {cls.User ? `${cls.User.firstName} ${cls.User.lastName}` : 'Unknown'}</span>
                                        </div>
                                        <h3>{cls.class_name}</h3>
                                        <button className="view-details-btn" onClick={() => navigate(`/classes/${cls.id}`)}>View Dashboard</button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* NOTICES TAB */}
                    {activeTab === 'notices' && (
                        <div className="notices-list">
                            {notices.length === 0 ? (
                                <div className="empty-state glass-panel"><h3>No Notices</h3></div>
                            ) : (
                                notices.slice(0, 10).map(notice => {
                                    const relatedClass = classes.find(c => c.id === notice.class_id);
                                    return (
                                        <div className="glass-panel notice-item clickable-notice" key={notice.id} onClick={() => navigate(`/classes/${notice.class_id}`)}>
                                            <div className="notice-icon">📋</div>
                                            <div className="notice-content">
                                                <h4>{notice.title}</h4>
                                                <p className="notice-meta">
                                                    <span className="notice-class-tag">{relatedClass ? relatedClass.class_name : 'Unknown Class'}</span>
                                                    &nbsp;•&nbsp; {new Date(notice.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* --- PROFILE MODAL (VIEW & EDIT MODE) --- */}
            {showProfileModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card profile-modal">
                        <div className="profile-header">
                            <div className="avatar large-avatar">{(editForm.firstName || fullName).charAt(0).toUpperCase()}</div>
                            <h2>{isEditingProfile ? "Edit Profile" : fullName}</h2>
                            {!isEditingProfile && <button className="edit-btn" onClick={() => setIsEditingProfile(true)}>✎ Edit Details</button>}
                        </div>

                        <div className="profile-form-grid">
                            <div className="form-group">
                                <label>First Name</label>
                                {isEditingProfile ? <input type="text" className="modal-input" value={editForm.firstName || ''} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} /> : <p>{profile.firstName || '-'}</p>}
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                {isEditingProfile ? <input type="text" className="modal-input" value={editForm.lastName || ''} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} /> : <p>{profile.lastName || '-'}</p>}
                            </div>
                            <div className="form-group">
                                <label>Mobile Number</label>
                                {isEditingProfile ? <input type="text" className="modal-input" value={editForm.mobile || ''} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /> : <p>{profile.mobile || '-'}</p>}
                            </div>
                            <div className="form-group">
                                <label>Date of Birth</label>
                                {isEditingProfile ? <input type="date" className="modal-input" value={editForm.dob || ''} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} /> : <p>{profile.dob || '-'}</p>}
                            </div>
                            <div className="form-group full-width">
                                <label>Institute ID / Roll No</label>
                                {isEditingProfile ? <input type="text" className="modal-input" value={editForm.instituteId || ''} onChange={(e) => setEditForm({ ...editForm, instituteId: e.target.value })} /> : <p>{profile.instituteId || '-'}</p>}
                            </div>
                            <div className="form-group full-width">
                                <label>Email (Unchangeable)</label>
                                <p style={{ opacity: 0.7 }}>{profile.email}</p>
                            </div>
                        </div>

                        {/* --- DANGER ZONE --- */}
                        {isEditingProfile && (
                            <div className="danger-zone" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--danger)' }}>
                                <h4 style={{ color: 'var(--danger)', marginBottom: '15px' }}>Danger Zone</h4>

                                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                                    <button
                                        className="cancel-btn"
                                        style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                        onClick={async () => {
                                            const curr = prompt("Enter current password:");
                                            const newPass = prompt("Enter new password (Min 8 chars, 1 Uppercase, 1 Number, 1 Special):");
                                            if (curr && newPass) {
                                                try {
                                                    const res = await changePassword(curr, newPass);
                                                    alert(res.data.message);
                                                } catch (err) {
                                                    alert(err.response?.data?.message || "Error changing password");
                                                }
                                            }
                                        }}
                                    >
                                        Reset Password
                                    </button>

                                    <button
                                        className="cancel-btn"
                                        style={{ background: 'rgba(255, 77, 77, 0.1)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                        onClick={async () => {
                                            if (window.confirm("WARNING: This will permanently delete your account, all your classes, and all attendance records. This cannot be undone. Type 'OK' to confirm.")) {
                                                try {
                                                    await deleteAccount();
                                                    onLogout(); // Log them out immediately
                                                } catch (err) {
                                                    alert("Failed to delete account.");
                                                }
                                            }
                                        }}
                                    >
                                        Delete Account
                                    </button>
                                </div>
                            </div>
                        )}
                        {/* --- END DANGER ZONE --- */}

                        <div className="modal-actions" style={{ marginTop: '25px' }}>
                            <button className="cancel-btn" onClick={() => { setShowProfileModal(false); setIsEditingProfile(false); }}>Close</button>
                            {isEditingProfile && <button className="join-class-btn" onClick={handleSaveProfile}>Save Changes</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* --- CREATE / JOIN MODALS --- */}
            {showJoinModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card">
                        <h2>Join a Class</h2>
                        <input type="text" placeholder="e.g. CS-201" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} className="modal-input" />
                        {joinError && <p className="error-text">{joinError}</p>}
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowJoinModal(false)}>Cancel</button>
                            <button className="join-class-btn" onClick={handleJoinClass}>Join</button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay">
                    <div className="modal-content glass-card">
                        <h2>Create a New Class</h2>
                        <input type="text" placeholder="e.g. Advanced Data Structures" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="modal-input" />
                        {createError && <p className="error-text">{createError}</p>}
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setShowCreateModal(false)}>Cancel</button>
                            <button className="join-class-btn" onClick={handleCreateClass}>Create</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;