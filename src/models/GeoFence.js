const mongoose = require('mongoose');

const geoFenceSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: 'INCLUSION',
        enum: ['INCLUSION']
    },
    lat: {
        type: Number,
        required: true
    },
    lng: {
        type: Number,
        required: true
    },
    radius: {
        type: Number,
        required: true
    },
    rules: [{
        condition: {
            type: String,
            enum: ['ENTER', 'EXIT', 'INSIDE', 'OUTSIDE'],
            required: true
        },
        action: {
            type: String,
            enum: ['ALERT', 'NOTIFY', 'LOG'],
            required: true
        },
        message: {
            type: String,
            required: true
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add 2d index for basic location queries
geoFenceSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('GeoFence', geoFenceSchema); 