const { Sequelize } = require('sequelize');

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
        acquire: 30000,
        idle: 10000
    }
});

// Test the connection and setup models
const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('PostgreSQL connected successfully!');

        // Import models
        const User = require('./models/User');
        const Dependent = require('./models/Dependent');
        
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

        // Sync models in the correct order
        console.log('Syncing database models...');
        
        // Sync User first
        await User.sync({ alter: true });
        console.log('User model synced');
        
        // Then sync Dependent (which has foreign key to User)
        await Dependent.sync({ alter: true });
        console.log('Dependent model synced');
        
        console.log('Database synchronized successfully!');
        
    } catch (error) {
        console.error('Unable to connect to PostgreSQL:', error);
        process.exit(1);
    }
};

module.exports = { sequelize, connectDB };
