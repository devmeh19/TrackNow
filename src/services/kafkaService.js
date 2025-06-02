const { 
    sendLocationUpdate, 
    sendChatMessage, 
    startLocationUpdatesConsumer, 
    startChatMessagesConsumer,
    TOPICS
} = require('../config/kafka');

class KafkaService {
    constructor() {
        this.locationHandlers = new Set();
        this.chatHandlers = new Set();
    }

    // Initialize Kafka consumers
    async initialize() {
        try {
            // Start location updates consumer
            await startLocationUpdatesConsumer();
            console.log('Location updates consumer started');

            // Start chat messages consumer
            await startChatMessagesConsumer();
            console.log('Chat messages consumer started');
        } catch (error) {
            console.error('Error initializing Kafka consumers:', error);
            throw error;
        }
    }

    // Register handlers for location updates
    onLocationUpdate(handler) {
        this.locationHandlers.add(handler);
    }

    // Register handlers for chat messages
    onChatMessage(handler) {
        this.chatHandlers.add(handler);
    }

    // Remove location update handler
    removeLocationHandler(handler) {
        this.locationHandlers.delete(handler);
    }

    // Remove chat message handler
    removeChatHandler(handler) {
        this.chatHandlers.delete(handler);
    }

    // Process location update
    async processLocationUpdate(data) {
        try {
            // Send to Kafka
            await sendLocationUpdate(data);

            // Notify all registered handlers
            this.locationHandlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in location update handler:', error);
                }
            });
        } catch (error) {
            console.error('Error processing location update:', error);
            throw error;
        }
    }

    // Process chat message
    async processChatMessage(data) {
        try {
            // Send to Kafka
            await sendChatMessage(data);

            // Notify all registered handlers
            this.chatHandlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Error in chat message handler:', error);
                }
            });
        } catch (error) {
            console.error('Error processing chat message:', error);
            throw error;
        }
    }

    // Example of how to use the service
    static async example() {
        const kafkaService = new KafkaService();

        // Register handlers
        kafkaService.onLocationUpdate((data) => {
            console.log('Location update received:', data);
            // Handle location update
        });

        kafkaService.onChatMessage((data) => {
            console.log('Chat message received:', data);
            // Handle chat message
        });

        // Initialize Kafka consumers
        await kafkaService.initialize();

        // Example: Process a location update
        await kafkaService.processLocationUpdate({
            volunteerId: 'vol123',
            eventId: 'event456',
            location: {
                lat: 40.7128,
                lng: -74.0060,
                timestamp: Date.now()
            }
        });

        // Example: Process a chat message
        await kafkaService.processChatMessage({
            eventId: 'event456',
            senderId: 'vol123',
            message: 'Hello everyone!',
            timestamp: Date.now()
        });
    }
}

module.exports = KafkaService; 