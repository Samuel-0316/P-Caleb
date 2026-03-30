"""
Function Tools for Gemini
Defines the functions that Gemini can call to interact with the clinic system
"""

import httpx
from typing import List, Dict, Optional
from datetime import datetime
import os
from dotenv import load_dotenv
import logging

# Set up logger
logger = logging.getLogger(__name__)

load_dotenv('.env.chatbot')

API_BASE_URL = os.getenv('NODE_API_URL', 'http://localhost:5000/api')
logger.info(f"API_BASE_URL loaded: {API_BASE_URL}")


# ==================== API CALL FUNCTIONS ====================

async def call_api(endpoint: str, method: str = 'GET', data: Dict = None, params: Dict = None) -> Dict:
    """
    Generic API caller
    """
    url = f"{API_BASE_URL}/{endpoint}"
    logger.info(f"Calling API: {method} {url}")
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if method == 'GET':
                response = await client.get(url, params=params)
            elif method == 'POST':
                response = await client.post(url, json=data)
            elif method == 'PUT':
                response = await client.put(url, json=data)
            elif method == 'DELETE':
                response = await client.delete(url)
            
            response.raise_for_status()
            return response.json()
    
    except httpx.HTTPStatusError as e:
        return {'error': f'API Error: {e.response.status_code}', 'detail': str(e)}
    except httpx.RequestError as e:
        return {'error': 'Connection Error', 'detail': str(e)}
    except Exception as e:
        return {'error': 'Unexpected Error', 'detail': str(e)}


# ==================== DOCTOR FUNCTIONS ====================

async def get_all_doctors() -> List[Dict]:
    """
    Get list of all available doctors in the clinic
    
    Returns:
        List of doctors with their details (id, name, specialization, phone, email)
    """
    result = await call_api('doctors')
    
    if 'error' in result:
        return []
    
    return result


async def find_doctors_by_specialization(specialization: str) -> List[Dict]:
    """
    Find doctors by their specialization
    
    Args:
        specialization: Medical specialization (e.g., "Cardiologist", "Pediatrician")
    
    Returns:
        List of doctors matching the specialization
    """
    all_doctors = await get_all_doctors()
    
    # Filter by specialization (case-insensitive)
    matching_doctors = [
        doc for doc in all_doctors
        if specialization.lower() in doc.get('specialization', '').lower()
    ]
    
    return matching_doctors


async def find_doctor_by_name(name: str) -> Optional[Dict]:
    """
    Find a doctor by name
    
    Args:
        name: Doctor's name (full or partial)
    
    Returns:
        Doctor details if found, None otherwise
    """
    all_doctors = await get_all_doctors()
    
    # Search by name (case-insensitive)
    for doctor in all_doctors:
        if name.lower() in doctor.get('name', '').lower():
            return doctor
    
    return None


# ==================== APPOINTMENT FUNCTIONS ====================

async def get_patient_appointments(patient_id: str) -> List[Dict]:
    """
    Get all appointments for a specific patient
    
    Args:
        patient_id: Patient's ID in the system
    
    Returns:
        List of appointments with details
    """
    # Note: This would need a new endpoint or direct DB access
    # For now, returning a placeholder
    result = await call_api(f'appointments/patient/{patient_id}')
    
    if 'error' in result:
        return []
    
    return result


async def book_appointment(
    patient_phone: str,
    patient_name: str,
    patient_email: str,
    doctor_id: str,
    appointment_date: str,
    reason_for_visit: str,
    duration_minutes: int = 30
) -> Dict:
    """
    Book a new appointment for a patient
    
    Args:
        patient_phone: Patient's phone number
        patient_name: Patient's full name
        patient_email: Patient's email
        doctor_id: ID of the doctor (string cuid)
        appointment_date: Date and time in ISO format (e.g., "2024-11-05T10:00:00")
        reason_for_visit: Reason for the appointment
        duration_minutes: Duration in minutes (default 30)
    
    Returns:
        Created appointment details or error
    """
    appointment_data = {
        'patient': {
            'phone': patient_phone,
            'name': patient_name,
            'email': patient_email,
        },
        'doctorId': str(doctor_id),  # Ensure it's a string
        'appointmentDate': appointment_date,
        'reasonForVisit': reason_for_visit,
        'durationInMinutes': duration_minutes,
    }
    
    result = await call_api('appointments', method='POST', data=appointment_data)
    return result


async def check_doctor_availability(doctor_id: str, date: str) -> Dict:
    """
    Check if a doctor has availability on a specific date
    
    Args:
        doctor_id: Doctor's ID
        date: Date to check (YYYY-MM-DD format)
    
    Returns:
        Availability information
    """
    # This is a simplified check - in reality you'd query appointments
    # and calculate free slots
    
    # For now, we'll assume doctors are available 9 AM - 5 PM
    # with 30-minute slots
    
    return {
        'available': True,
        'date': date,
        'suggested_times': [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
        ],
        'note': 'These are general available hours. Specific slots may be booked.'
    }


async def cancel_appointment(appointment_id: int) -> Dict:
    """
    Cancel an existing appointment
    
    Args:
        appointment_id: ID of the appointment to cancel
    
    Returns:
        Cancellation confirmation or error
    """
    result = await call_api(f'appointments/{appointment_id}', method='DELETE')
    return result


# ==================== FUNCTION DECLARATIONS FOR GEMINI ====================

# These declarations tell Gemini what functions are available and how to use them
FUNCTION_DECLARATIONS = [
    {
        "name": "get_all_doctors",
        "description": "Get a list of all available doctors in the clinic with their specializations and contact information. Use this when a patient asks to see all doctors or wants to browse available doctors.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        }
    },
    {
        "name": "find_doctors_by_specialization",
        "description": "Find doctors who specialize in a specific medical field. Use this when a patient is looking for a specific type of doctor (e.g., cardiologist, pediatrician, dermatologist).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "specialization": {
                    "type": "STRING",
                    "description": "The medical specialization to search for (e.g., 'Cardiologist', 'Pediatrician', 'Orthopedist')"
                }
            },
            "required": ["specialization"]
        }
    },
    {
        "name": "find_doctor_by_name",
        "description": "Find a specific doctor by their name. Use this when a patient mentions a doctor's name or asks about a specific doctor.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "name": {
                    "type": "STRING",
                    "description": "The doctor's name (full or partial)"
                }
            },
            "required": ["name"]
        }
    },
    {
        "name": "check_doctor_availability",
        "description": "Check if a doctor has available appointment slots on a specific date. Use this when a patient wants to know if a doctor is available on a particular day.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "doctor_id": {
                    "type": "STRING",
                    "description": "The ID of the doctor (string cuid format)"
                },
                "date": {
                    "type": "STRING",
                    "description": "The date to check availability in YYYY-MM-DD format (e.g., '2024-11-05')"
                }
            },
            "required": ["doctor_id", "date"]
        }
    },
    {
        "name": "book_appointment",
        "description": "Book a new appointment for the logged-in patient with a specific doctor. The patient's name and email will be automatically filled from the session context. You only need to ask for: which doctor, phone number, preferred date/time, and reason for visit.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "patient_phone": {
                    "type": "STRING",
                    "description": "Patient's phone number (required)"
                },
                "patient_name": {
                    "type": "STRING",
                    "description": "Patient's full name (automatically filled from session context)"
                },
                "patient_email": {
                    "type": "STRING",
                    "description": "Patient's email address (automatically filled from session context)"
                },
                "doctor_id": {
                    "type": "STRING",
                    "description": "The ID of the doctor for the appointment (string cuid format)"
                },
                "appointment_date": {
                    "type": "STRING",
                    "description": "Date and time of appointment in ISO 8601 format (e.g., '2024-11-05T10:00:00')"
                },
                "reason_for_visit": {
                    "type": "STRING",
                    "description": "The reason or purpose of the visit"
                },
                "duration_minutes": {
                    "type": "INTEGER",
                    "description": "Duration of appointment in minutes (default 30)"
                }
            },
            "required": ["patient_phone", "patient_name", "patient_email", "doctor_id", "appointment_date", "reason_for_visit"]
        }
    },
    {
        "name": "get_patient_appointments",
        "description": "Get all appointments for the logged-in patient. Use this when a patient wants to see their scheduled appointments. The patient_id will be automatically provided from the session context, so you don't need to ask for it.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "patient_id": {
                    "type": "STRING",
                    "description": "The patient's ID (automatically filled from session context, string cuid format)"
                }
            },
            "required": []
        }
    }
]


# Function mapping for execution
FUNCTION_MAP = {
    "get_all_doctors": get_all_doctors,
    "find_doctors_by_specialization": find_doctors_by_specialization,
    "find_doctor_by_name": find_doctor_by_name,
    "check_doctor_availability": check_doctor_availability,
    "book_appointment": book_appointment,
    "get_patient_appointments": get_patient_appointments,
}
