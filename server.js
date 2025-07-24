const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./database');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database and models
const initializeApp = async () => {
    try {
        // Connect to database and sync models
        await connectDB();
        
        console.log('✅ Database and models initialized successfully');
        
        // Start server after database is ready
        const PORT = process.env.PORT || 8080;
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📡 API Base URL: https://tax-au-backend-production.up.railway.app/api`);
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        process.exit(1);
    }
};

// Routes (loaded after database initialization)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Health check route
app.get('/', (req, res) => {
    res.json({ 
        message: 'Tax Filing API is running!',
        database: 'PostgreSQL',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Health check for Railway
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: err.errors
        });
    }
    
    if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
            success: false,
            message: 'Duplicate entry',
            field: err.errors[0]?.path
        });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
        return res.status(500).json({
            success: false,
            message: 'Database error',
            error: process.env.NODE_ENV === 'development' ? err.message : 'Database operation failed'
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Initialize the application
initializeApp();

module.exports = app;
