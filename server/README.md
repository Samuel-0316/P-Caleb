# Python Agent Server Setup Instructions

This file contains instructions for setting up and running the Python agent server that powers the clinic chatbot.

## Prerequisites

- Python 3.8 or higher
- Virtual environment (optional but recommended)
- Ollama installed and running (https://ollama.com/)

## Setup Steps

1. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Make sure Ollama is running and has downloaded the required model:
   ```
   ollama run phi3.5:latest
   ```
   
   If you don't have the model downloaded, run:
   ```
   ollama pull phi3.5:latest
   ```

3. Create a `.env` file in the server directory with your database connection string:
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/clinic_db
   ```

## Running the Server

Start the FastAPI server with:

```
uvicorn agent_server:app --reload --port 8000
```

The server will be available at http://localhost:8000.

## API Endpoints

- GET `/`: Health check endpoint to verify the server is running
- POST `/api/chatbot`: Main endpoint for chatbot interactions
  - Request body: 
    ```json
    {
      "message": "User message here",
      "session_id": "unique-session-id"
    }
    ```
  - Response:
    ```json
    {
      "reply": "Agent's response"
    }
    ```

## Features

The agent can help with:
- Checking doctor availability
- Booking appointments
- Retrieving patient appointments

## Roadmap

Future enhancements:
- Integrate full LangChain agent executor for more intelligent responses
- Add conversation history for more context-aware responses
- Implement authentication for real patient identification