const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// A middleware to ensure only Admins can access these routes
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).json({ msg: 'Forbidden: Admin access required.' });
    }
};

// @route   POST /api/patients/admin-create
// @desc    Admin creates a new User and Patient profile
// @access  Private (Admin Only)
router.post('/admin-create', isAdmin, async (req, res) => {
    const { name, email, phone, dob } = req.body;
    if (!name || !email || !phone || !dob) {
        return res.status(400).json({ msg: 'All patient fields are required.' });
    }

    try {

        // Check if user already exists by email
        const existingUser = await prisma.user.findFirst({
            where: { email }
        });
        if (existingUser) {
            return res.status(409).json({ msg: 'A user with this email already exists.' });
        }

        // Check if patient already exists by phone
        const existingPatient = await prisma.patient.findFirst({
            where: { phone }
        });
        if (existingPatient) {
            return res.status(409).json({
                msg: 'A patient with this phone number already exists.',
                existingPatientName: existingPatient.name
            });
        }

        const salt = await bcrypt.genSalt(10);
        const tempPassword = `clinicpass_${Math.random().toString(36).substring(2, 10)}`;
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        console.log(`
        ===================================================================
        ADMIN ACTION: Creating new user for ${email}
        TEMPORARY PASSWORD: ${tempPassword}
        ===================================================================
        `);

        const newUser = await prisma.user.create({
            data: {
                name, email, password: hashedPassword,
                patient: {
                    create: { name, phone, email, dob: new Date(dob) }
                }
            },
            include: { patient: true }
        });

        res.status(201).json(newUser.patient);
    } catch (error) {
        console.error("Admin create patient error:", error);
        res.status(500).json({ msg: 'Server error while creating patient.' });
    }
});

module.exports = router;
// GET /api/patients/:id - Get patient profile by ID (for patient dashboard)
router.get('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const patient = await prisma.patient.findUnique({ where: { id } });
        if (!patient) return res.status(404).json({ msg: 'Patient not found.' });
        res.json(patient);
    } catch (error) {
        console.error('Error fetching patient by ID:', error);
        res.status(500).json({ msg: 'Server error while fetching patient.' });
    }
});