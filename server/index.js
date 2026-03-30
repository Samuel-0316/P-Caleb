require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Import routes
const appointmentRoutes = require('./routes/appointments.routes');
const doctorRoutes = require('./routes/doctors.routes');
const authRoutes = require('./routes/auth.routes.js');
const patientRoutes = require('./routes/patients.routes.js');

// Import the middleware
const authMiddleware = require('./middleware/authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173', // For local development
    'http://localhost:3000',  // Alternative local dev
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []) // Production URLs from env
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// API Routes

app.use('/api/auth', authRoutes); // Public auth routes

// Public chatbot endpoints (no auth required)
// These are used by the chatbot service to access data
app.use('/api/chatbot/appointments', appointmentRoutes); 
app.use('/api/chatbot/doctors', doctorRoutes);

// Protected Routes (require authentication)
app.use('/api/appointments', authMiddleware, appointmentRoutes);
app.use('/api/doctors', authMiddleware, doctorRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// ADMIN_SECRET_KEY="your_super_secret_admin_password"