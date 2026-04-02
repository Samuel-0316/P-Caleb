import React, { useState, useEffect, useRef } from 'react';
import './Chatbot.css';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBodyRef = useRef(null);
  const [initialMessageShown, setInitialMessageShown] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [sessionId, setSessionId] = useState(null);
  const [lastUserId, setLastUserId] = useState(null);

  const quickReplyOptions = [
    { label: "1️⃣ Find Doctors", value: "Show me all available doctors" },
    { label: "2️⃣ Check Availability", value: "Check doctor availability" },
    { label: "3️⃣ Book Appointment", value: "I want to book an appointment" },
    { label: "4️⃣ My Appointments", value: "Show my appointments" }
  ];

  // Generate unique session ID and detect logout on chat open
  useEffect(() => {
    if (isOpen && !initialMessageShown && !isMinimized) {
      // Check current user from localStorage
      const userDataStr = localStorage.getItem('user');
      let currentUserId = null;
      
      if (userDataStr) {
        try {
          const parsedData = JSON.parse(userDataStr);
          currentUserId = parsedData.id || parsedData.patientId;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // If user changed (logout then login, or login as different user), clear chat history
      if (lastUserId && lastUserId !== currentUserId) {
        setMessages([]);
        setInitialMessageShown(false);
      }
      
      setLastUserId(currentUserId);
      
      // Generate a new unique session ID for this conversation
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setSessionId(newSessionId);
      
      // Show welcome message
      setMessages([{ text: "Hello! 👋 How can I help you with your appointments today?", sender: "bot" }]);
      setInitialMessageShown(true);
    }
  }, [isOpen, initialMessageShown, isMinimized, lastUserId]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setIsMinimized(false); // Expand when opening
    }
  };

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Format bot response with proper markdown-like formatting
  const formatBotMessage = (text) => {
    // Safety check - ensure text is a string
    if (typeof text !== 'string') {
      console.error('formatBotMessage received non-string:', text);
      return '<p>Error: Invalid message format</p>';
    }
    
    let formatted = text;
    
    // Split into lines
    const lines = formatted.split('\n');
    let html = '';
    let inList = false;
    
    lines.forEach((line, index) => {
      // Skip empty lines at start
      if (!line.trim() && html === '') return;
      
      // Check for numbered list items (e.g., "1. **Finding Doctors**:" or "1. Finding Doctors")
      const numberedMatch = line.match(/^(\d+)\.\s+(\*\*(.+?)\*\*:?)\s*(.*)$/);
      if (numberedMatch) {
        if (!inList) {
          html += '<ol class="bot-list">';
          inList = 'ol';
        }
        const boldText = numberedMatch[3];
        const restText = numberedMatch[4];
        html += `<li><strong>${boldText}</strong>${restText ? ': ' + restText : ''}</li>`;
        return;
      }
      
      // Check for bullet points (e.g., "* **Doctor**: Dr. Name" or "- Item")
      const bulletMatch = line.match(/^[\*\-]\s+(\*\*(.+?)\*\*:?)\s*(.*)$/);
      if (bulletMatch) {
        if (!inList) {
          html += '<ul class="bot-list">';
          inList = 'ul';
        }
        const boldText = bulletMatch[2];
        const restText = bulletMatch[3];
        html += `<li><strong>${boldText}</strong>${restText ? ': ' + restText : ''}</li>`;
        return;
      }
      
      // Close list if we were in one
      if (inList && line.trim() && !line.match(/^[\d\*\-]\./)) {
        html += inList === 'ol' ? '</ol>' : '</ul>';
        inList = false;
      }
      
      // Convert inline bold
      let processedLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      
      // Add paragraph for regular text
      if (processedLine.trim()) {
        html += `<p class="bot-paragraph">${processedLine}</p>`;
      } else if (html !== '') {
        // Add spacing for empty lines (but not at the start)
        html += '<div class="bot-spacing"></div>';
      }
    });
    
    // Close list if still open
    if (inList) {
      html += inList === 'ol' ? '</ol>' : '</ul>';
    }
    
    return html || '<p>...</p>';
  };

  const handleSend = async (messageText = null) => {
    // Guard against React click/keyboard events being passed as the first argument.
    const normalizedMessage = typeof messageText === 'string' ? messageText : null;
    const userMessage = normalizedMessage || input.trim();
    
    if (userMessage) {
      // Hide quick replies when user starts chatting
      if (messages.length === 1) {
        setShowQuickReplies(false);
      }
      
      // Add user message to chat immediately
      setMessages(prevMessages => [...prevMessages, { text: userMessage, sender: 'user' }]);
      setInput('');
      setIsLoading(true); // Show typing indicator
      
      try {
        // Get user data from localStorage - check 'user' key first based on screenshot
        const userDataStr = localStorage.getItem('user') || localStorage.getItem('userData');
        let patientInfo = {};
        
        if (userDataStr) {
          try {
            const parsedData = JSON.parse(userDataStr);
            patientInfo = {
              id: parsedData.patientId || parsedData.patient?.id || parsedData.id || '',
              name: parsedData.name || parsedData.patient?.name || '',
              email: parsedData.email || parsedData.patient?.email || '',
              role: parsedData.role || ''
            };
            console.log('Using patient data from localStorage:', patientInfo);
          } catch (e) {
            console.error('Error parsing userData from localStorage:', e);
          }
        } else {
          console.warn('No user data found in localStorage');
        }
        
        // Send message to Python agent backend with unique session ID
        const chatbotUrl = import.meta.env.VITE_CHATBOT_URL || 'http://localhost:8000/api/chatbot';
        const response = await fetch(chatbotUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: userMessage,
            session_id: sessionId || 'anonymous',
            patient_info: patientInfo
          }),
        });
        
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        
        const data = await response.json();
        
        // Ensure we're getting a string response
        const botReply = typeof data.reply === 'string' ? data.reply : JSON.stringify(data.reply);
        
        // Add bot response to chat
        setMessages(prevMessages => [...prevMessages, { text: botReply, sender: 'bot' }]);
        
        // Scroll happens automatically via useEffect
      } catch (error) {
        console.error('Error communicating with chatbot API:', error);
        // Add error message to chat
        setMessages(prevMessages => [
          ...prevMessages, 
          { text: 'Sorry, I encountered an error. Please try again later.', sender: 'bot' }
        ]);
      } finally {
        setIsLoading(false); // Hide loading indicator
      }
    }
  };

  return (
    <div className="chatbot-container">
      <div className={`chat-window ${isOpen ? 'open' : ''} ${isMinimized ? 'minimized' : ''}`}>
        <div className="chat-header">
          <div className="chat-header-title">
            <div className="bot-avatar">🤖</div>
            <h2>Agentic Chatbot</h2>
          </div>
          <div className="chat-header-actions">
            <button onClick={toggleMinimize} className="minimize-btn" title={isMinimized ? "Expand" : "Minimize"}>
              {isMinimized ? '⬆' : '⬇'}
            </button>
            <button onClick={toggleChat} className="close-btn" title="Close">&times;</button>
          </div>
        </div>
        <div className="chat-body" ref={chatBodyRef}>
          {messages.length === 0 && !initialMessageShown ? (
            <div className="empty-chat-message">
              <p>Your conversation will appear here</p>
            </div>
          ) : (
            <>
              {messages.map((msg, index) => (
                <div key={index} className={`chat-message ${msg.sender}`}>
                  <div 
                    className="message-content"
                    onClick={(e) => {
                      // Prevent clicks on links or other elements from doing anything
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    dangerouslySetInnerHTML={
                      msg.sender === 'bot' 
                        ? { __html: formatBotMessage(msg.text) }
                        : { __html: `<p>${typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}</p>` }
                    }
                  />
                </div>
              ))}
              {isLoading && (
                <div className="chat-message bot">
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Quick Reply Buttons */}
              {showQuickReplies && messages.length === 1 && !isLoading && (
                <div className="quick-replies">
                  <p className="quick-replies-label">Quick actions:</p>
                  {quickReplyOptions.map((option, idx) => (
                    <button
                      key={idx}
                      className="quick-reply-btn"
                      onClick={() => handleSend(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <div className="chat-footer">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
          />
          <button onClick={() => handleSend()}>Send</button>
        </div>
      </div>
      <button onClick={toggleChat} className="fab">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      </button>
    </div>
  );
};

export default Chatbot;