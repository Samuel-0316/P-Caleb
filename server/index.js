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
const corsOptions = {
    origin: 'http://localhost:5173', 
    optionsSuccessStatus: 200 
};
app.use(cors(corsOptions));

// Middleware to parse JSON bodies
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes); // Public auth routes

// Protected Routes
app.use('/api/appointments', authMiddleware, appointmentRoutes);
app.use('/api/doctors', authMiddleware, doctorRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// ADMIN_SECRET_KEY="your_super_secret_admin_password"