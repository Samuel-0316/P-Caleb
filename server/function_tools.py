"""
Function Tools for Gemini
Defines the functions that Gemini can call to interact with the clinic system
"""

import httpx
import logging
import os
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Set up logger
logger = logging.getLogger(__name__)

load_dotenv('.env.chatbot')
load_dotenv('.env', override=False)

API_BASE_URL = os.getenv('NODE_API_URL')
DATABASE_URL = os.getenv('DATABASE_URL')

if API_BASE_URL:
    logger.info(f"API_BASE_URL loaded: {API_BASE_URL}")
else:
    logger.warning("NODE_API_URL is not set. HTTP fallbacks will be unavailable.")

if not DATABASE_URL:
    logger.warning("DATABASE_URL is not set. Direct database queries will be unavailable.")


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _serialize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {key: _serialize_value(value) for key, value in record.items()}


def _get_db_connection():
    if not DATABASE_URL:
        raise RuntimeError('DATABASE_URL is not configured')
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def _fetch_doctors_from_db(name_filter: Optional[str] = None, specialization_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    query = 'SELECT id, name, specialization, phone, email, "createdAt", "updatedAt" FROM "Doctor"'
    conditions = []
    parameters: List[Any] = []

    if name_filter:
        conditions.append('LOWER(name) LIKE %s')
        parameters.append(f'%{name_filter.lower()}%')

    if specialization_filter:
        conditions.append('LOWER(specialization) LIKE %s')
        parameters.append(f'%{specialization_filter.lower()}%')

    if conditions:
        query += ' WHERE ' + ' AND '.join(conditions)

    query += ' ORDER BY name ASC'

    with _get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, parameters)
            return [_serialize_record(dict(row)) for row in cursor.fetchall()]


def _fetch_patient_appointments_from_db(patient_id: str) -> List[Dict[str, Any]]:
    with _get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                '''
                SELECT
                    a.id,
                    a."appointmentDate",
                    a."reasonForVisit",
                    a."durationInMinutes",
                    a.status,
                    a."createdAt",
                    a."updatedAt",
                    p.id AS "patientId",
                    p.name AS "patientName",
                    p.phone AS "patientPhone",
                    p.email AS "patientEmail",
                    p.dob AS "patientDob",
                    d.id AS "doctorId",
                    d.name AS "doctorName",
                    d.specialization AS "doctorSpecialization",
                    d.phone AS "doctorPhone",
                    d.email AS "doctorEmail"
                FROM "Appointment" a
                INNER JOIN "Patient" p ON p.id = a."patientId"
                INNER JOIN "Doctor" d ON d.id = a."doctorId"
                WHERE a."patientId" = %s
                ORDER BY a."appointmentDate" ASC
                ''',
                (patient_id,),
            )
            return [_serialize_record(dict(row)) for row in cursor.fetchall()]


# ==================== API CALL FUNCTIONS ====================

async def call_api(endpoint: str, method: str = 'GET', data: Dict = None, params: Dict = None) -> Dict:
    """
    Generic API caller
    """
    if not API_BASE_URL:
        return {'error': 'Configuration Error', 'detail': 'NODE_API_URL is not configured'}

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
    try:
        return _fetch_doctors_from_db()
    except Exception as db_error:
        logger.warning(f"Direct database doctor lookup failed, falling back to API: {db_error}")
        result = await call_api('doctors')

        if 'error' in result:
            logger.error(f"Doctor lookup failed via API too: {result}")
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
    try:
        return _fetch_doctors_from_db(specialization_filter=specialization)
    except Exception as db_error:
        logger.warning(f"Specialization lookup failed via DB, falling back to in-memory filter: {db_error}")
        all_doctors = await get_all_doctors()

        return [
            doc for doc in all_doctors
            if specialization.lower() in doc.get('specialization', '').lower()
        ]


async def find_doctor_by_name(name: str) -> Optional[Dict]:
    """
    Find a doctor by name
    
    Args:
        name: Doctor's name (full or partial)
    
    Returns:
        Doctor details if found, None otherwise
    """
    try:
        doctors = _fetch_doctors_from_db(name_filter=name)
        return doctors[0] if doctors else None
    except Exception as db_error:
        logger.warning(f"Name lookup failed via DB, falling back to in-memory search: {db_error}")
        all_doctors = await get_all_doctors()

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
    try:
        appointments = _fetch_patient_appointments_from_db(patient_id)

        # If the provided ID is actually a userId, look up the linked patient profile.
        if not appointments:
            with _get_db_connection() as connection:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT id FROM "Patient" WHERE "userId" = %s LIMIT 1', (patient_id,))
                    patient_row = cursor.fetchone()

            if patient_row:
                appointments = _fetch_patient_appointments_from_db(patient_row['id'])

        return appointments
    except Exception as db_error:
        logger.warning(f"Patient appointment lookup failed via DB, falling back to API: {db_error}")
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
