const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
    socketId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    location: {
        lat: Number,
        lng: Number,
        lastUpdate: Date
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    currentEvent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event'
    },
    lastSeen: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Volunteer', volunteerSchema); 