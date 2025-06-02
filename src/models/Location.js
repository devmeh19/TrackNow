const { pool } = require('../config/postgis');

class Location {
    static async createTable() {
        const query = `
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                volunteer_id VARCHAR(255) NOT NULL,
                event_id VARCHAR(255) NOT NULL,
                location GEOMETRY(Point, 4326) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_locations_location ON locations USING GIST (location);
        `;
        await pool.query(query);
    }

    static async addLocation(volunteerId, eventId, latitude, longitude) {
        const query = `
            INSERT INTO locations (volunteer_id, event_id, location)
            VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))
            RETURNING *;
        `;
        const result = await pool.query(query, [volunteerId, eventId, longitude, latitude]);
        return result.rows[0];
    }

    static async getNearbyVolunteers(eventId, latitude, longitude, radiusInMeters) {
        const query = `
            SELECT 
                volunteer_id,
                ST_Distance(
                    location::geography,
                    ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
                ) as distance
            FROM locations
            WHERE event_id = $3
            AND ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
                $4
            )
            ORDER BY distance;
        `;
        const result = await pool.query(query, [longitude, latitude, eventId, radiusInMeters]);
        return result.rows;
    }

    static async getVolunteerLocations(eventId) {
        const query = `
            SELECT 
                volunteer_id,
                ST_X(location::geometry) as longitude,
                ST_Y(location::geometry) as latitude,
                created_at
            FROM locations
            WHERE event_id = $1
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(query, [eventId]);
        return result.rows;
    }
}

module.exports = Location; 