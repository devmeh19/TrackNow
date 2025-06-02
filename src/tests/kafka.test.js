const KafkaService = require('../services/kafkaService');

// Example test function
async function testKafkaService() {
    try {
        console.log('Starting Kafka service test...');

        // Create Kafka service instance
        const kafkaService = new KafkaService();

        // Register test handlers
        kafkaService.onLocationUpdate((data) => {
            console.log('Test: Location update received:', data);
            // Add your test assertions here
        });

        kafkaService.onChatMessage((data) => {
            console.log('Test: Chat message received:', data);
            // Add your test assertions here
        });

        // Initialize Kafka consumers
        await kafkaService.initialize();
        console.log('Kafka consumers initialized');

        // Test location updates
        console.log('\nTesting location updates...');
        const locationData = {
            volunteerId: 'test-vol-123',
            eventId: 'test-event-456',
            location: {
                lat: 40.7128,
                lng: -74.0060,
                timestamp: Date.now()
            }
        };
        await kafkaService.processLocationUpdate(locationData);
        console.log('Location update sent successfully');

        // Test chat messages
        console.log('\nTesting chat messages...');
        const chatData = {
            eventId: 'test-event-456',
            senderId: 'test-vol-123',
            message: 'This is a test message',
            timestamp: Date.now()
        };
        await kafkaService.processChatMessage(chatData);
        console.log('Chat message sent successfully');

        // Clean up handlers
        kafkaService.removeLocationHandler(null);
        kafkaService.removeChatHandler(null);
        console.log('\nTest completed successfully');

    } catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}

// Run the test
testKafkaService().catch(console.error); 