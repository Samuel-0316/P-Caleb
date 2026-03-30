"""
FastAPI Chatbot Server
Main entry point for the Gemini-powered medical clinic chatbot
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import logging
from datetime import datetime

from gemini_config import get_gemini_model, format_function_response
from session_manager import session_manager
from function_tools import FUNCTION_MAP

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Medical Clinic Chatbot API",
    description="AI-powered chatbot for medical clinic appointment management",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # React app URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== REQUEST/RESPONSE MODELS ====================

class ChatRequest(BaseModel):
    message: str
    session_id: str
    patient_info: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    metadata: Optional[Dict[str, Any]] = None


# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "online",
        "service": "Medical Clinic Chatbot",
        "version": "1.0.0",
        "active_sessions": session_manager.get_active_sessions_count()
    }


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_sessions": session_manager.get_active_sessions_count()
    }


@app.get("/test-gemini")
async def test_gemini():
    """Test endpoint to verify Gemini API is working"""
    try:
        model = get_gemini_model()
        response = model.generate_content("Say 'Hello, I am working!' in one sentence.")
        return {
            "status": "success",
            "message": "Gemini API is working",
            "response": response.text if hasattr(response, 'text') else str(response)
        }
    except Exception as e:
        logger.error(f"Gemini test failed: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e)
        }


@app.post("/api/chatbot", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main chatbot endpoint
    Processes user messages and returns AI responses
    """
    try:
        logger.info(f"Received chat request - Session: {request.session_id}, Message: {request.message}")
        
        # Get or create session
        session = session_manager.get_session(request.session_id)
        logger.info(f"Session retrieved/created for {request.session_id}")
        
        # Update patient info if provided
        if request.patient_info:
            session.update_context(
                patient_id=request.patient_info.get('id'),
                patient_name=request.patient_info.get('name'),
                patient_email=request.patient_info.get('email'),
            )
            logger.info(f"Patient info updated: {request.patient_info.get('name')}")
        
        logger.info(f"Session {request.session_id}: User message: {request.message}")
        
        # Initialize Gemini model
        logger.info("Initializing Gemini model...")
        model = get_gemini_model()
        logger.info("Gemini model initialized successfully")
        
        # Start or continue chat with history
        logger.info(f"Starting chat with {len(session.history)} history items")
        chat = model.start_chat(history=session.history)
        logger.info("Chat started successfully")
        
        # Prepare message with context
        user_message = request.message
        
        # Add context info for first message in session
        if len(session.history) == 0 and session.context.get('patient_name'):
            context_prefix = f"[Patient Context: ID={session.context.get('patient_id')}, Name={session.context.get('patient_name')}, Email={session.context.get('patient_email')}]\n\n"
            user_message = context_prefix + user_message
            logger.info("Added patient context to first message")
        
        # Send user message
        logger.info(f"Sending message to Gemini: {request.message}")
        response = chat.send_message(user_message)
        logger.info("Received response from Gemini")
        
        # Add user message to session history
        session.add_message('user', request.message)
        
        # Process response
        logger.info("Processing Gemini response...")
        final_response = await process_gemini_response(response, chat, session)
        logger.info(f"Final response generated: {final_response[:100]}...")
        
        # Add assistant response to session history
        session.add_message('model', final_response)
        
        logger.info(f"Session {request.session_id}: Bot response: {final_response[:100]}...")
        
        return ChatResponse(
            reply=final_response,
            session_id=request.session_id,
            metadata={
                'context': session.context,
                'message_count': len(session.history)
            }
        )
    
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


async def process_gemini_response(response, chat, session):
    """
    Process Gemini response, handle function calls if needed
    
    Args:
        response: Initial Gemini response
        chat: Gemini chat instance
        session: Current conversation session
    
    Returns:
        Final text response for the user
    """
    # Check if Gemini wants to call a function
    has_function_call = False
    try:
        if (response.candidates and 
            len(response.candidates) > 0 and
            response.candidates[0].content.parts and
            len(response.candidates[0].content.parts) > 0):
            # Check if ANY part has a function call
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'function_call') and part.function_call:
                    has_function_call = True
                    break
    except (AttributeError, IndexError) as e:
        logger.warning(f"Error checking for function call: {e}")
        has_function_call = False
    
    if has_function_call:
        function_calls = []
        
        # Collect all function calls from the response
        for part in response.candidates[0].content.parts:
            if hasattr(part, 'function_call') and part.function_call:
                function_calls.append(part.function_call)
        
        # Execute each function call
        function_responses = []
        
        for function_call in function_calls:
            function_name = function_call.name
            function_args = dict(function_call.args)
            
            # Auto-inject patient context for certain functions
            if function_name == 'get_patient_appointments':
                # Use patient_id from session context if not provided
                if 'patient_id' not in function_args and session.context.get('patient_id'):
                    function_args['patient_id'] = session.context.get('patient_id')
                    logger.info(f"Auto-injected patient_id from context: {function_args['patient_id']}")
            
            elif function_name == 'book_appointment':
                # Auto-inject patient info from session context if not provided
                if 'patient_name' not in function_args and session.context.get('patient_name'):
                    function_args['patient_name'] = session.context.get('patient_name')
                if 'patient_email' not in function_args and session.context.get('patient_email'):
                    function_args['patient_email'] = session.context.get('patient_email')
                logger.info(f"Auto-injected patient info from context")
            
            logger.info(f"Executing function: {function_name} with args: {function_args}")
            
            # Get the function from our function map
            if function_name in FUNCTION_MAP:
                function_to_call = FUNCTION_MAP[function_name]
                
                try:
                    # Execute the function
                    result = await function_to_call(**function_args)
                    
                    logger.info(f"Function {function_name} result: {result}")
                    
                    # Ensure result is a dict for Gemini (wrap lists/primitives)
                    if isinstance(result, list):
                        result = {'data': result, 'count': len(result)}
                    elif not isinstance(result, dict):
                        result = {'value': result}
                    
                    # Create function response
                    function_response = {
                        'function_name': function_name,
                        'response': result
                    }
                    
                    function_responses.append(function_response)
                    
                except Exception as e:
                    logger.error(f"Error executing function {function_name}: {str(e)}")
                    function_responses.append({
                        'function_name': function_name,
                        'response': {'error': str(e)}
                    })
        
        # Send function results back to Gemini to get natural language response
        if function_responses:
            # Format function response for Gemini
            parts = []
            for fr in function_responses:
                parts.append({
                    'function_response': {
                        'name': fr['function_name'],
                        'response': fr['response']
                    }
                })
            
            # Send function responses to Gemini
            follow_up_response = chat.send_message(parts)
            
            # Recursively process the response (it might contain more function calls!)
            return await process_gemini_response(follow_up_response, chat, session)
    
    # No function call, return text response directly
    try:
        return response.text
    except (AttributeError, ValueError) as e:
        logger.error(f"Error getting response text: {e}")
        # Try to get text from candidates manually
        if response.candidates and len(response.candidates) > 0:
            parts = response.candidates[0].content.parts
            if parts and len(parts) > 0:
                # Look for a text part
                for part in parts:
                    if hasattr(part, 'text') and part.text:
                        return part.text
        logger.error("Could not extract text from response")
        return "I apologize, but I'm having trouble formulating a response. Please try again."


@app.delete("/api/chatbot/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a conversation session"""
    session_manager.delete_session(session_id)
    return {"message": f"Session {session_id} deleted"}


@app.get("/api/chatbot/sessions/count")
async def get_sessions_count():
    """Get count of active sessions"""
    return {"active_sessions": session_manager.get_active_sessions_count()}


# ==================== STARTUP/SHUTDOWN ====================

@app.on_event("startup")
async def startup_event():
    """Run on server startup"""
    logger.info("🚀 Medical Clinic Chatbot Server starting up...")
    logger.info("✅ Gemini API configured")
    logger.info("✅ Session manager initialized")
    logger.info("✅ Ready to accept requests")


@app.on_event("shutdown")
async def shutdown_event():
    """Run on server shutdown"""
    logger.info("👋 Shutting down chatbot server...")
    session_manager.reset_all_sessions()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "chatbot_server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
