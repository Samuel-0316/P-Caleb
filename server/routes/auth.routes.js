const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// @route   POST /api/auth/register
// @desc    Register a new patient user and their profile
// @access  Public
router.post('/register', async (req, res) => {
    const { name, email, password, phone, dob } = req.body;

    if (!name || !email || !password || !phone || !dob) {
        return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    try {
        // Check if a user with this email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with this email already exists.' });
        }

        // Hash the password for security
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create the new user and their associated patient profile in a single database transaction
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                // The patient profile is created and automatically linked here
                patient: {
                    create: {
                        name,
                        phone,
                        email,
                        dob: new Date(dob),
                    },
                },
            },
            include: {
                patient: true, // Include the new patient profile in the response
            },
        });
        
        // Create a JWT token to log them in immediately
        const token = jwt.sign(
            { id: newUser.id, role: newUser.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Token expires in 1 day
        );

        res.status(201).json({
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                patientId: newUser.patient.id,
            },
        });

    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ msg: 'Server error during registration.' });
    }
});


// @route   POST /api/auth/login
// @desc    Authenticate a patient user and return their token
// @access  Public
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ msg: 'Please enter all fields.' });
    }

    try {
        // Find the user by their unique email
        const user = await prisma.user.findUnique({ 
            where: { email },
            include: { patient: true } // Include patient profile
        });

        // Use a generic error message for security
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        // Compare the submitted password with the hashed password in the database
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials.' });
        }

        // If credentials are correct, create and send a JWT token
         const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                patientId: user.patient?.id,
            },
        });

    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ msg: 'Server error during login.' });
    }
});


// @route   POST /api/auth/admin-login
// @desc    Authenticate an admin using a secret key
// @access  Public
router.post('/admin-login', (req, res) => {
    const { secretKey } = req.body;

    if (!secretKey) {
        return res.status(400).json({ msg: 'Secret key is required.' });
    }

    // Compare the submitted key with the one stored securely in our .env file
    if (secretKey === process.env.ADMIN_SECRET_KEY) {
        // If the key is correct, create a special token with the ADMIN role
        const adminPayload = {
            id: 'admin_user', // This can be a generic ID for the admin role
            role: 'ADMIN',
        };
        
        const token = jwt.sign(
            adminPayload,
            process.env.JWT_SECRET,
            { expiresIn: '8h' } // Admin session can be shorter, e.g., a standard workday
        );

        res.json({
            token,
            user: {
                id: 'admin_user',
                name: 'Clinic Administrator',
                role: 'ADMIN',
            },
        });
    } else {
        // If the keys do not match, deny access
        return res.status(401).json({ msg: 'Invalid secret key.' });
    }
});


module.exports = router;