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
        acquire: 60000,
        idle: 10000
    },
    retry: {
        max: 3
    }
});

// Import models once at module level to prevent re-importing
const User = require('./models/User');
const Dependent = require('./models/Dependent');

// Set up associations once at module level
let associationsSet = false;

const setupAssociations = () => {
    if (associationsSet) return;
    
    console.log('🔗 Setting up model associations...');
    
    // Clear any existing associations
    User.associations = {};
    Dependent.associations = {};
    
    // Set up new associations
    User.hasMany(Dependent, { 
        foreignKey: 'userId', 
        as: 'userDependents', // Changed alias to be unique
        onDelete: 'CASCADE'
    });
    
    Dependent.belongsTo(User, { 
        foreignKey: 'userId', 
        as: 'dependentUser' // Changed alias to be unique
    });
    
    associationsSet = true;
    console.log('✅ Model associations set up successfully');
};

const connectDB = async () => {
    try {
        console.log('🔄 Connecting to PostgreSQL...');
        
        // Test connection
        await sequelize.authenticate();
        console.log('✅ PostgreSQL connected successfully!');
        
        console.log('📦 Models imported');
        
        // Set up associations
        setupAssociations();
        
        // Sync all models together (Sequelize handles dependency order)
        console.log('🔄 Syncing all database models...');
        
        await sequelize.sync({ 
            alter: process.env.NODE_ENV === 'production',
            force: false // Never force in production
        });
        
        console.log('🎉 All models synchronized successfully!');
        
        // Verify tables exist
        const [userCount] = await sequelize.query("SELECT COUNT(*) as count FROM \"Users\"");
        const [depCount] = await sequelize.query("SELECT COUNT(*) as count FROM \"Dependents\"");
        
        console.log(`📊 Users table: ${userCount[0].count} records`);
        console.log(`📊 Dependents table: ${depCount[0].count} records`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Database connection/sync failed:', error.message);
        
        // If it's a table doesn't exist error, try force sync once
        if (error.message.includes('does not exist') && process.env.NODE_ENV === 'production') {
            console.log('🔄 Attempting force sync to create missing tables...');
            try {
                await sequelize.sync({ force: true });
                console.log('✅ Force sync completed successfully!');
                return true;
            } catch (forceError) {
                console.error('❌ Force sync also failed:', forceError.message);
                throw forceError;
            }
        }
        
        throw error;
    }
};

module.exports = { sequelize, connectDB, User, Dependent };
