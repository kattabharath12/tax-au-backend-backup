const { Sequelize } = require('sequelize');

// Validate required environment variables
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
}

// Initialize Sequelize with PostgreSQL
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
        } : false
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
        max: 5,
        min: 0,
        acquire: 60000, // Increased timeout
        idle: 10000
    },
    retry: {
        max: 5
    }
});

// Test the connection and setup models
const connectDB = async () => {
    let retries = 5;
    
    while (retries > 0) {
        try {
            console.log(`🔄 Attempting to connect to PostgreSQL (${6 - retries}/5)...`);
            
            await sequelize.authenticate();
            console.log('✅ PostgreSQL connected successfully!');
            
            // Import models
            const User = require('./models/User');
            const Dependent = require('./models/Dependent');
            
            console.log('📦 Models imported');
            
            // Set up associations AFTER models are defined
            User.hasMany(Dependent, { 
                foreignKey: 'userId', 
                as: 'dependents',
                onDelete: 'CASCADE'
            });
            Dependent.belongsTo(User, { 
                foreignKey: 'userId', 
                as: 'user'
            });
            
            console.log('🔗 Model associations set up');

            // Sync models in the correct order with alter: true for production safety
            console.log('🔄 Syncing database models...');
            
            // First sync User model
            await User.sync({ alter: process.env.NODE_ENV === 'production' });
            console.log('✅ User model synced');
            
            // Then sync Dependent model (depends on User)
            await Dependent.sync({ alter: process.env.NODE_ENV === 'production' });
            console.log('✅ Dependent model synced');
            
            console.log('🎉 Database synchronized successfully!');
            return;
            
        } catch (error) {
            console.error(`❌ Database connection attempt ${6 - retries} failed:`, error.message);
            retries--;
            
            if (retries === 0) {
                console.error('💥 All database connection attempts failed');
                throw error;
            }
            
            console.log(`⏳ Retrying in 5 seconds... (${retries} attempts remaining)`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
};

module.exports = { sequelize, connectDB };
