const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/*
* @route   GET /api/doctors
* @desc    Get all doctors
* @access  Public
*/
router.get('/', async (req, res) => {
    try {
        const doctors = await prisma.doctor.findMany();
        res.json(doctors);
    } catch (error)
    {
        console.error("Error fetching doctors:", error);
        res.status(500).json({ msg: 'Server error while fetching doctors.' });
    }
});

/*
* @route   POST /api/doctors
* @desc    Add a new doctor
* @access  Public (in a real app, this would be protected)
*/
router.post('/', async (req, res) => {
    const { name, specialization, phone, email } = req.body;

    // Basic validation
    if (!name || !specialization || !phone) {
        return res.status(400).json({ msg: 'Please provide name, specialization, and phone.' });
    }

    try {
        const newDoctor = await prisma.doctor.create({
            data: {
                name,
                specialization,
                phone,
                email: email || null,
            },
        });
        res.status(201).json(newDoctor);
    } catch (error) {
        // Handle potential unique constraint errors (e.g., duplicate phone)
        if (error.code === 'P2002') {
            return res.status(409).json({ msg: `A doctor with that ${error.meta.target.join(', ')} already exists.` });
        }
        console.error("Error creating doctor:", error);
        res.status(500).json({ msg: 'Server error while creating doctor.' });
    }
});


module.exports = router;