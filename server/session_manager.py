"""
Session Manager for Chatbot
Handles conversation context and history storage in memory
"""

from typing import Dict, List, Optional
from datetime import datetime, timedelta
import json


class ConversationSession:
    """Represents a single conversation session"""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.created_at = datetime.now()
        self.last_updated = datetime.now()
        self.history: List[Dict] = []  # Gemini chat history
        self.context: Dict = {
            # User context
            'patient_id': None,
            'patient_name': None,
            'patient_email': None,
            
            # Booking context
            'selected_doctor_id': None,
            'selected_doctor_name': None,
            'appointment_date': None,
            'appointment_time': None,
            'reason_for_visit': None,
            
            # Flow state
            'current_step': None,  # e.g., 'selecting_doctor', 'selecting_time', 'confirming'
            'last_action': None,
        }
    
    def update_activity(self):
        """Update last activity timestamp"""
        self.last_updated = datetime.now()
    
    def add_message(self, role: str, content: str):
        """Add a message to conversation history"""
        self.history.append({
            'role': role,
            'parts': [content]
        })
        self.update_activity()
    
    def update_context(self, **kwargs):
        """Update context with new values"""
        self.context.update(kwargs)
        self.update_activity()
    
    def clear_booking_context(self):
        """Clear booking-related context"""
        self.context.update({
            'selected_doctor_id': None,
            'selected_doctor_name': None,
            'appointment_date': None,
            'appointment_time': None,
            'reason_for_visit': None,
            'current_step': None,
        })
    
    def get_context_value(self, key: str):
        """Get a value from context"""
        return self.context.get(key)
    
    def to_dict(self):
        """Convert session to dictionary"""
        return {
            'session_id': self.session_id,
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat(),
            'history': self.history,
            'context': self.context,
        }


class SessionManager:
    """Manages all conversation sessions"""
    
    def __init__(self, session_timeout_minutes: int = 30):
        self.sessions: Dict[str, ConversationSession] = {}
        self.session_timeout = timedelta(minutes=session_timeout_minutes)
    
    def get_session(self, session_id: str) -> ConversationSession:
        """Get or create a session"""
        # Clean up expired sessions first
        self._cleanup_expired_sessions()
        
        # Get or create session
        if session_id not in self.sessions:
            self.sessions[session_id] = ConversationSession(session_id)
        
        return self.sessions[session_id]
    
    def delete_session(self, session_id: str):
        """Delete a session"""
        if session_id in self.sessions:
            del self.sessions[session_id]
    
    def _cleanup_expired_sessions(self):
        """Remove sessions that have expired"""
        now = datetime.now()
        expired_sessions = [
            sid for sid, session in self.sessions.items()
            if now - session.last_updated > self.session_timeout
        ]
        
        for sid in expired_sessions:
            del self.sessions[sid]
    
    def get_active_sessions_count(self) -> int:
        """Get count of active sessions"""
        self._cleanup_expired_sessions()
        return len(self.sessions)
    
    def reset_all_sessions(self):
        """Clear all sessions (use with caution)"""
        self.sessions.clear()


# Global session manager instance
session_manager = SessionManager(session_timeout_minutes=30)
