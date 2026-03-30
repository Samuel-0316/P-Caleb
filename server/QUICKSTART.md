# 🚀 Quick Start Guide - Gemini Chatbot

Follow these steps to get your chatbot running in 5 minutes!

## Step 1: Install Python Dependencies

```bash
cd server
pip install -r requirements.txt
```

## Step 2: Get Your Gemini API Key

1. Go to **[Google AI Studio](https://makersuite.google.com/app/apikey)**
2. Click "Create API Key"
3. Copy your API key

## Step 3: Configure Environment

Edit the `.env.chatbot` file (already created) and add your API key:

```env
GOOGLE_API_KEY=paste_your_key_here
NODE_API_URL=http://localhost:5000/api
```

## Step 4: Verify Setup

Run the setup checker:

```bash
python setup_chatbot.py
```

This will verify:
- ✅ All dependencies are installed
- ✅ Environment is configured
- ✅ Gemini API connection works

## Step 5: Start the Servers

**Terminal 1 - Node.js Server (Main API):**
```bash
cd server
npm start
```

**Terminal 2 - Chatbot Server:**
```bash
cd server
python chatbot_server.py
```

Or use uvicorn directly:
```bash
python -m uvicorn chatbot_server:app --reload --port 8000
```

## Step 6: Test It!

Open your browser and go to: **http://localhost:5173**

The chatbot should appear in the bottom right corner. Try saying:
- "Hi"
- "Show me all doctors"
- "I need a cardiologist"
- "Book an appointment"

---

## 🎯 What Each File Does

| File | Purpose |
|------|---------|
| `chatbot_server.py` | Main FastAPI server - handles HTTP requests |
| `gemini_config.py` | Configures Gemini AI with instructions |
| `function_tools.py` | Defines functions Gemini can call (doctors, appointments) |
| `session_manager.py` | Manages conversation memory |
| `requirements.txt` | Python packages needed |
| `.env.chatbot` | Your API keys (keep secret!) |

---

## 🐛 Troubleshooting

**"Module not found" errors?**
```bash
pip install -r requirements.txt
```

**"GOOGLE_API_KEY not found"?**
- Check `.env.chatbot` file exists
- Make sure you pasted your API key
- No quotes needed around the key

**Chatbot not responding?**
- Check both servers are running
- Look at terminal logs for errors
- Verify Node.js server is on port 5000

**"Connection refused"?**
- Start Node.js server FIRST
- Then start chatbot server
- Check ports aren't already in use

---

## 📊 Success Indicators

When everything is working, you should see:

**Chatbot Server Terminal:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     🚀 Medical Clinic Chatbot Server starting up...
INFO:     ✅ Gemini API configured
INFO:     ✅ Ready to accept requests
```

**Frontend Console (browser):**
```
Using patient data from localStorage: {id: 123, name: "...", ...}
```

---

## 🎨 Customization

Want to change the chatbot's personality? Edit the `SYSTEM_INSTRUCTION` in `gemini_config.py`

Want to add more functions? See "Extending the Chatbot" in `README_CHATBOT.md`

---

**Need more help?** Check `README_CHATBOT.md` for detailed documentation!
