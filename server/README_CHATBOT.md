# Gemini-Powered Medical Clinic Chatbot

A modern, AI-powered chatbot for medical clinic appointment management using Google's Gemini 1.5 Flash API.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

Create a `.env.chatbot` file in the server directory:

```env
GOOGLE_API_KEY=your_google_gemini_api_key_here
NODE_API_URL=http://localhost:5000/api
```

**Get your Gemini API key:**
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste it into `.env.chatbot`

### 3. Start the Servers

**Terminal 1 - Start Node.js Server (must be running first):**
```bash
cd server
npm start
```

**Terminal 2 - Start Chatbot Server:**
```bash
cd server
python -m uvicorn chatbot_server:app --reload --port 8000
```

The chatbot will be available at `http://localhost:8000`

## 📁 File Structure

```
server/
├── chatbot_server.py          # Main FastAPI application
├── gemini_config.py            # Gemini API configuration
├── function_tools.py           # Function definitions for Gemini
├── session_manager.py          # Conversation state management
├── requirements.txt            # Python dependencies
├── .env.chatbot               # Configuration (create this)
└── README_CHATBOT.md          # This file
```

## 🔧 How It Works

### Architecture Flow

```
Frontend (React) 
    ↓ POST /api/chatbot
Chatbot Server (Python/FastAPI)
    ↓
Gemini 1.5 Flash API
    ↓
Function Calling (if needed)
    ↓
Node.js API (via HTTP)
    ↓
PostgreSQL Database
```

### Key Components

1. **chatbot_server.py** - FastAPI server that handles HTTP requests from frontend
2. **gemini_config.py** - Configures Gemini with system instructions and function tools
3. **function_tools.py** - Defines 6 functions that Gemini can call:
   - `get_all_doctors()` - List all doctors
   - `find_doctors_by_specialization()` - Find doctors by specialty
   - `find_doctor_by_name()` - Search doctor by name
   - `check_doctor_availability()` - Check available time slots
   - `book_appointment()` - Create new appointment
   - `get_patient_appointments()` - View patient's appointments
4. **session_manager.py** - Manages conversation context in-memory (30-min timeout)

### Conversation Flow Example

```
User: "I need to see a cardiologist"
    ↓
Gemini calls: find_doctors_by_specialization("Cardiologist")
    ↓
Function returns: [Dr. Smith - Cardiologist]
    ↓
Gemini: "I found Dr. Smith, a cardiologist. Would you like to book an appointment?"

User: "Yes, tomorrow at 2 PM"
    ↓
Gemini: "I'll need some information. What's your phone number?"
    ↓
[Collects: name, phone, email, reason]
    ↓
Gemini calls: book_appointment(...)
    ↓
Gemini: "✓ Appointment booked with Dr. Smith tomorrow at 2 PM!"
```

## 🛠️ API Endpoints

### POST /api/chatbot
Main chatbot endpoint

**Request:**
```json
{
  "message": "I want to book an appointment",
  "session_id": "unique-session-id",
  "patient_info": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

**Response:**
```json
{
  "reply": "I'd be happy to help you book an appointment. Which doctor would you like to see?",
  "session_id": "unique-session-id",
  "metadata": {
    "context": {...},
    "message_count": 2
  }
}
```

### GET /
Health check endpoint

### GET /health
Detailed health status

### GET /api/chatbot/sessions/count
Get active session count

### DELETE /api/chatbot/session/{session_id}
Clear a conversation session

## 🎯 Features

✅ **Natural Conversation** - Gemini understands context and intent  
✅ **Function Calling** - Automatically calls backend APIs when needed  
✅ **Session Management** - Maintains conversation context (30 min timeout)  
✅ **Multi-turn Dialogs** - Handles complex booking flows  
✅ **Error Handling** - Graceful failure with helpful messages  
✅ **CORS Enabled** - Works with React frontend  
✅ **Logging** - Full conversation logging for debugging  

## 🔐 Security Notes

- API keys are stored in `.env.chatbot` (never commit this file!)
- Add `.env.chatbot` to `.gitignore`
- In production, use environment variables
- Consider adding rate limiting for API protection

## 📊 Monitoring

Check active sessions:
```bash
curl http://localhost:8000/api/chatbot/sessions/count
```

Check server health:
```bash
curl http://localhost:8000/health
```

## 🐛 Troubleshooting

**"Import google.generativeai could not be resolved"**
- Run: `pip install google-generativeai`

**"GOOGLE_API_KEY not found"**
- Create `.env.chatbot` file with your API key

**"Connection Error to Node.js API"**
- Make sure Node.js server is running on port 5000
- Check `NODE_API_URL` in `.env.chatbot`

**"Function call failed"**
- Check Node.js API logs
- Verify database connection
- Check function parameters

## 🚀 Deployment

For production deployment:

1. Use environment variables instead of `.env.chatbot`
2. Add rate limiting (e.g., SlowAPI)
3. Use Redis for session storage
4. Enable HTTPS
5. Set up monitoring (e.g., Sentry)
6. Configure logging to file/cloud

## 📝 Extending the Chatbot

### Add a New Function

1. **Define function in `function_tools.py`:**
```python
async def my_new_function(param: str) -> Dict:
    # Your logic here
    return result
```

2. **Add to FUNCTION_DECLARATIONS:**
```python
{
    "name": "my_new_function",
    "description": "What this function does",
    "parameters": {...}
}
```

3. **Add to FUNCTION_MAP:**
```python
FUNCTION_MAP = {
    ...
    "my_new_function": my_new_function
}
```

Gemini will automatically know when to call it!

## 📚 Resources

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Function Calling Guide](https://ai.google.dev/docs/function_calling)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

## 💡 Tips

- Test the chatbot with various phrasings
- Check logs for function call details
- Use session context to maintain state
- Keep system instructions clear and specific
- Monitor API usage in Google AI Studio

---

**Built with ❤️ using Google Gemini 1.5 Flash**
