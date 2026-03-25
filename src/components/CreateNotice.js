import React, { useState } from 'react';
import API from '../services/api';

function CreateNotice({ classId, onNoticeCreated, onClose }) {
    const [newNotice, setNewNotice] = useState({ title: '', content: '', link: '', allowsChat: true });
    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');

    const handleCreateNotice = async () => {
        if (!newNotice.title || !newNotice.content) {
            return setError("Title and Content are required!");
        }

        setIsPosting(true);
        setError('');

        try {
            const res = await API.post(`/classes/${classId}/notices`, {
                title: newNotice.title,
                content: newNotice.content,
                file_url: newNotice.link,
                allows_chat: newNotice.allowsChat
            });

            if (res.data.success) {
                onNoticeCreated(res.data.notice);
                onClose();
            }
        } catch (err) {
            console.error("Create Notice Error:", err);
            setError(err.response?.data?.message || "Failed to post notice");
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content glass-card">
                <h2>Post an Announcement</h2>

                {error && <p style={{ color: '#ff4d4d', fontSize: '14px', margin: '5px 0' }}>{error}</p>}

                <input
                    type="text"
                    placeholder="Notice Title"
                    value={newNotice.title}
                    onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                    className="modal-input"
                    style={{ marginTop: '10px' }}
                />
                <textarea
                    placeholder="Type your message here..."
                    value={newNotice.content}
                    onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                    className="notice-modal-textarea"
                />
                <input
                    type="text"
                    placeholder="Paste Google Drive Link (Optional)"
                    value={newNotice.link}
                    onChange={(e) => setNewNotice({ ...newNotice, link: e.target.value })}
                    className="modal-input"
                />

                <div className="toggle-container">
                    <input
                        type="checkbox"
                        checked={newNotice.allowsChat}
                        onChange={(e) => setNewNotice({ ...newNotice, allowsChat: e.target.checked })}
                    />
                    <label>Allow students to reply / ask questions</label>
                </div>

                <div className="modal-actions">
                    <button className="cancel-btn" onClick={onClose} disabled={isPosting}>Cancel</button>
                    <button className="join-class-btn" onClick={handleCreateNotice} disabled={isPosting}>
                        {isPosting ? 'Posting...' : 'Post Notice'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CreateNotice;