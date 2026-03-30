const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check for booking conflicts (duration-aware)
const checkForConflict = async (doctorId, newAppointmentDate, newDuration, appointmentId = null) => {
    const newStartTime = new Date(newAppointmentDate);
    const newEndTime = new Date(newStartTime.getTime() + newDuration * 60000);
    const dayStart = new Date(newStartTime).setHours(0, 0, 0, 0);
    const dayEnd = new Date(newStartTime).setHours(23, 59, 59, 999);
    const existingAppointments = await prisma.appointment.findMany({
        where: {
            doctorId: doctorId,
            status: { not: 'Cancelled' },
            appointmentDate: { gte: new Date(dayStart), lte: new Date(dayEnd) },
            id: appointmentId ? { not: appointmentId } : undefined
        }
    });
    for (const existing of existingAppointments) {
        const existingStartTime = new Date(existing.appointmentDate);
        const existingEndTime = new Date(existingStartTime.getTime() + existing.durationInMinutes * 60000);
        if (existingStartTime < newEndTime && existingEndTime > newStartTime) {
            return existing; 
        }
    }
    return null;
};

// GET /api/appointments - Get appointments based on user role
router.get('/', async (req, res) => {
    try {
        let appointments;
        if (req.user.role === 'ADMIN') {
            appointments = await prisma.appointment.findMany({ include: { patient: true, doctor: true }, orderBy: { appointmentDate: 'asc' } });
        } else if (req.user.role === 'PATIENT') {
            const patientProfile = await prisma.patient.findUnique({ where: { userId: req.user.id } });
            if (!patientProfile) return res.json([]); 
            appointments = await prisma.appointment.findMany({ where: { patientId: patientProfile.id }, include: { patient: true, doctor: true }, orderBy: { appointmentDate: 'asc' } });
        }
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ msg: "Server error while fetching appointments." });
    }
});

// POST /api/appointments - Create a new appointment
router.post('/', async (req, res) => {
    const { patient, doctorId, appointmentDate, reasonForVisit, durationInMinutes = 30 } = req.body;
    if (!doctorId || !appointmentDate || !reasonForVisit) {
        return res.status(400).json({ msg: 'Doctor, date, and reason are required.' });
    }
    try {
        let patientRecord;
        let nameInfo = null;
        
        // Check if this is a chatbot request (no req.user) or authenticated request
        const isChatbotRequest = !req.user;
        
        if (isChatbotRequest) {
            // Chatbot request - find or create patient by phone
            if (!patient || !patient.phone) {
                return res.status(400).json({ msg: 'Patient phone number is required.' });
            }
            
            patientRecord = await prisma.patient.findUnique({ where: { phone: patient.phone } });
            
            if (!patientRecord) {
                // Create a new patient record for chatbot bookings
                // Note: This creates a patient WITHOUT a userId (no login)
                patientRecord = await prisma.patient.create({
                    data: {
                        name: patient.name,
                        phone: patient.phone,
                        email: patient.email || `${patient.phone}@temp.com`,
                        // userId is optional, so we don't set it
                    }
                });
            }
        } else if (req.user.role === 'ADMIN') {
            if (!patient || !patient.phone) return res.status(400).json({ msg: 'Patient phone number is required.' });
            patientRecord = await prisma.patient.findUnique({ where: { phone: patient.phone } });
            if (!patientRecord) {
                return res.status(404).json({ 
                    msg: `No patient found with phone number ${patient.phone}. Please register them first.`,
                    errorCode: 'PATIENT_NOT_FOUND'
                });
            }
            // If name provided is different from registered name, add info to response
            if (patient.name && patientRecord.name && patient.name.trim() !== patientRecord.name.trim()) {
                nameInfo = {
                    info: true,
                    msg: `A patient with this phone number is already registered as "${patientRecord.name}". Please inform the person that this name is linked with this phone number.`,
                    existingPatientName: patientRecord.name
                };
            }
        } else if (req.user.role === 'PATIENT') {
            patientRecord = await prisma.patient.findUnique({ where: { userId: req.user.id } });
            if (!patientRecord) return res.status(404).json({ msg: 'Could not find a patient profile for the logged-in user.' });
        }
        
        const conflict = await checkForConflict(doctorId, appointmentDate, durationInMinutes);
        if (conflict) return res.status(409).json({ msg: `This time slot conflicts with an existing appointment.` });
        
        const newAppointment = await prisma.appointment.create({
            data: {
                appointmentDate: new Date(appointmentDate),
                reasonForVisit,
                durationInMinutes: parseInt(durationInMinutes),
                patientId: patientRecord.id,
                doctorId: doctorId,
            },
            include: { patient: true, doctor: true },
        });
        // If nameInfo exists, include it in the response
        if (nameInfo) {
            res.status(201).json({ ...newAppointment, nameInfo });
        } else {
            res.status(201).json(newAppointment);
        }
    } catch (error) {
        console.error("Error creating appointment:", error);
        // Log request body for debugging
        console.error("Request body:", JSON.stringify(req.body, null, 2));
        // If Prisma error, log meta info
        if (error instanceof Error && error.meta) {
            console.error("Prisma error meta:", error.meta);
        }
        res.status(500).json({ msg: 'Server error while creating appointment.', error: error.message, stack: error.stack });
    }
});

// PUT /api/appointments/:id - Update an appointment
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { appointmentDate, doctorId, durationInMinutes } = req.body;
    try {
        const appointmentToUpdate = await prisma.appointment.findUnique({ where: { id }, include: { patient: true } });
        if (!appointmentToUpdate) return res.status(404).json({ msg: 'Appointment not found.' });
        if (req.user.role === 'PATIENT' && appointmentToUpdate.patient.userId !== req.user.id) {
            return res.status(403).json({ msg: 'Forbidden: You do not have permission to edit this appointment.' });
        }
        if (appointmentDate && doctorId && durationInMinutes) {
             const conflict = await checkForConflict(doctorId, appointmentDate, durationInMinutes, id);
             if (conflict) return res.status(409).json({ msg: 'This new time slot conflicts with an existing appointment.' });
        }
        const updatedAppointment = await prisma.appointment.update({
            where: { id: id },
            data: {
                appointmentDate: req.body.appointmentDate ? new Date(req.body.appointmentDate) : undefined,
                durationInMinutes: req.body.durationInMinutes ? parseInt(req.body.durationInMinutes) : undefined,
                reasonForVisit: req.body.reasonForVisit,
                status: req.body.status,
                doctorId: req.body.doctorId,
            },
            include: { patient: true, doctor: true },
        });
        res.json(updatedAppointment);
    } catch (error) {
        res.status(500).json({ msg: 'Server error while updating appointment.' });
    }
});

// DELETE /api/appointments/:id - Cancel an appointment
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const appointmentToDelete = await prisma.appointment.findUnique({ where: { id }, include: { patient: true } });
        if (!appointmentToDelete) return res.status(404).json({ msg: 'Appointment not found.' });
        if (req.user.role === 'PATIENT' && appointmentToDelete.patient.userId !== req.user.id) {
            return res.status(403).json({ msg: 'Forbidden.' });
        }
        const cancelledAppointment = await prisma.appointment.update({ where: { id }, data: { status: 'Cancelled' } });
        res.json({ msg: 'Appointment cancelled successfully.', appointment: cancelledAppointment });
    } catch (error) {
        res.status(500).json({ msg: 'Server error.' });
    }
});

// GET /api/appointments/patient/:patientId - Get appointments for a specific patient (for chatbot)
// This is a public endpoint used by the chatbot - no auth required
router.get('/patient/:patientId', async (req, res) => {
    const { patientId } = req.params;
    try {
        // First, try to find by patient record ID
        let appointments = await prisma.appointment.findMany({
            where: { patientId: patientId },
            include: { patient: true, doctor: true },
            orderBy: { appointmentDate: 'asc' }
        });
        
        // If not found, try to find by userId (in case patientId is actually userId)
        if (appointments.length === 0) {
            const patientProfile = await prisma.patient.findUnique({ 
                where: { userId: patientId } 
            });
            if (patientProfile) {
                appointments = await prisma.appointment.findMany({
                    where: { patientId: patientProfile.id },
                    include: { patient: true, doctor: true },
                    orderBy: { appointmentDate: 'asc' }
                });
            }
        }
        
        res.json(appointments);
    } catch (error) {
        console.error("Error fetching patient appointments:", error);
        res.status(500).json({ msg: "Server error while fetching appointments." });
    }
});

module.exports = router;