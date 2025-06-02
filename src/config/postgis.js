const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || 'postgres',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.POSTGRES_DB || 'tracknow',
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT || 5432,
});

// Enable PostGIS extension
const enablePostGIS = async () => {
    try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
        console.log('PostGIS extension enabled');
    } catch (error) {
        console.error('Error enabling PostGIS:', error);
    }
};

module.exports = {
    pool,
    enablePostGIS
}; 