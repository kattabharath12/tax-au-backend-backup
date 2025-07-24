const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables first
dotenv.config();

const app = express();

// Basic middleware
app.use(cors({
    origin: ['https://tax-au-frontend-production.up.railway.app', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check routes (before database connection)
app.get('/', (req, res) => {
    res.json({ 
        message: 'Tax Filing API is running!',
        database: 'PostgreSQL',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        status: 'healthy'
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Initialize database connection and models
let dbReady = false;

const initializeDatabase = async () => {
    try {
        console.log('🔄 Initializing database connection...');
        
        const { connectDB } = require('./database');
        await connectDB();
        
        console.log('✅ Database connected and models synced');
        dbReady = true;
        
        // Load routes after database is ready
        app.use('/api/auth', require('./routes/auth'));
        app.use('/api/dashboard', require('./routes/dashboard'));
        
        console.log('✅ Routes loaded successfully');
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        // Don't exit - let health checks work but log the error
        dbReady = false;
    }
};

// Middleware to check database readiness for API routes
app.use('/api/*', (req, res, next) => {
    if (!dbReady) {
        return res.status(503).json({
            success: false,
            message: 'Database not ready. Please try again in a moment.',
            status: 'initializing'
        });
    }
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    
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
            field: err.errors?.[0]?.path
        });
    }
    
    if (err.name === 'SequelizeDatabaseError') {
        return res.status(500).json({
            success: false,
            message: 'Database error'
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Start server
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server starting on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize database after server starts
    initializeDatabase();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

module.exports = app;
