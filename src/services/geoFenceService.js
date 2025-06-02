const GeoFence = require('../models/GeoFence');
let kafkaProducer;

try {
    const { sendLocationUpdate } = require('../config/kafka');
    kafkaProducer = sendLocationUpdate;
} catch (error) {
    console.log('Kafka integration is not available, running without Kafka');
    kafkaProducer = null;
}

class GeoFenceService {
    constructor(io) {
        this.io = io;
        this.activeFences = new Map(); // Cache for active fences
    }

    // Initialize service and load active fences
    async initialize() {
        try {
            const fences = await GeoFence.find({ isActive: true });
            fences.forEach(fence => {
                this.activeFences.set(fence._id.toString(), fence);
            });
            console.log(`Loaded ${fences.length} active geofences`);
        } catch (error) {
            console.error('Error initializing GeoFence service:', error);
            throw error;
        }
    }

    // Check if a point is inside a circle
    isPointInCircle(point, center, radius) {
        const dx = point[0] - center.lng;
        const dy = point[1] - center.lat;
        return (dx * dx + dy * dy) <= (radius * radius);
    }

    // Evaluate rules for a location update
    async evaluateRules(volunteerId, eventId, location) {
        try {
            const point = [location.lng, location.lat];
            const eventFences = Array.from(this.activeFences.values())
                .filter(fence => fence.eventId === eventId);

            for (const fence of eventFences) {
                const isInside = this.isPointInCircle(point, fence, fence.radius);
                
                // Evaluate each rule
                for (const rule of fence.rules) {
                    let shouldTrigger = false;
                    
                    switch (rule.condition) {
                        case 'ENTER':
                            shouldTrigger = isInside;
                            break;
                        case 'EXIT':
                            shouldTrigger = !isInside;
                            break;
                        case 'INSIDE':
                            shouldTrigger = isInside;
                            break;
                        case 'OUTSIDE':
                            shouldTrigger = !isInside;
                            break;
                    }

                    if (shouldTrigger) {
                        await this.handleRuleAction(rule, volunteerId, eventId, fence);
                    }
                }
            }
        } catch (error) {
            console.error('Error evaluating geofence rules:', error);
            throw error;
        }
    }

    // Handle rule actions
    async handleRuleAction(rule, volunteerId, eventId, fence) {
        try {
            const alertData = {
                type: rule.action,
                message: rule.message,
                volunteerId,
                eventId,
                fenceId: fence._id,
                fenceName: fence.name,
                timestamp: Date.now()
            };

            // Send to Kafka if available
            if (kafkaProducer) {
                try {
                    await kafkaProducer({
                        topic: 'geofence-alerts',
                        data: alertData
                    });
                } catch (kafkaError) {
                    console.warn('Failed to send to Kafka:', kafkaError);
                }
            }

            // Emit real-time notification
            this.io.to(eventId).emit('geofenceAlert', alertData);

            // Log the alert
            console.log('Geofence Alert:', alertData);
        } catch (error) {
            console.error('Error handling rule action:', error);
            throw error;
        }
    }

    // Add a new geofence
    async addFence(fenceData) {
        try {
            const fence = new GeoFence(fenceData);
            await fence.save();
            this.activeFences.set(fence._id.toString(), fence);
            return fence;
        } catch (error) {
            console.error('Error adding geofence:', error);
            throw error;
        }
    }

    // Update an existing geofence
    async updateFence(fenceId, updateData) {
        try {
            const fence = await GeoFence.findByIdAndUpdate(
                fenceId,
                updateData,
                { new: true }
            );
            if (fence.isActive) {
                this.activeFences.set(fence._id.toString(), fence);
            } else {
                this.activeFences.delete(fence._id.toString());
            }
            return fence;
        } catch (error) {
            console.error('Error updating geofence:', error);
            throw error;
        }
    }

    // Delete a geofence
    async deleteFence(fenceId) {
        try {
            await GeoFence.findByIdAndDelete(fenceId);
            this.activeFences.delete(fenceId);
        } catch (error) {
            console.error('Error deleting geofence:', error);
            throw error;
        }
    }
}

module.exports = GeoFenceService; 