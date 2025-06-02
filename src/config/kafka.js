const { Kafka } = require('kafkajs');

// Kafka configuration
const kafka = new Kafka({
    clientId: 'tracknow-app',
    brokers: ['localhost:9092'],
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});

// Create producer
const producer = kafka.producer({
    allowAutoTopicCreation: true,
    transactionTimeout: 30000
});

// Create consumer
const consumer = kafka.consumer({
    groupId: 'tracknow-group',
    maxWaitTimeInMs: 5000,
    maxBytes: 1048576, // 1MB
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});

// Example topics
const TOPICS = {
    LOCATION_UPDATES: 'location-updates',
    CHAT_MESSAGES: 'chat-messages',
    VOLUNTEER_EVENTS: 'volunteer-events',
    EVENT_UPDATES: 'event-updates'
};

// Example message schemas
const MESSAGE_SCHEMAS = {
    locationUpdate: {
        type: 'object',
        properties: {
            volunteerId: { type: 'string' },
            eventId: { type: 'string' },
            location: {
                type: 'object',
                properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                    timestamp: { type: 'number' }
                }
            }
        }
    },
    chatMessage: {
        type: 'object',
        properties: {
            eventId: { type: 'string' },
            senderId: { type: 'string' },
            message: { type: 'string' },
            timestamp: { type: 'number' }
        }
    },
    volunteerEvent: {
        type: 'object',
        properties: {
            eventId: { type: 'string' },
            volunteerId: { type: 'string' },
            action: { type: 'string', enum: ['JOIN', 'LEAVE'] },
            timestamp: { type: 'number' }
        }
    }
};

// Example producer functions
async function sendLocationUpdate(data) {
    try {
        await producer.connect();
        await producer.send({
            topic: TOPICS.LOCATION_UPDATES,
            messages: [
                {
                    key: data.volunteerId,
                    value: JSON.stringify(data),
                    timestamp: Date.now()
                }
            ]
        });
    } catch (error) {
        console.error('Error sending location update:', error);
        throw error;
    } finally {
        await producer.disconnect();
    }
}

async function sendChatMessage(data) {
    try {
        await producer.connect();
        await producer.send({
            topic: TOPICS.CHAT_MESSAGES,
            messages: [
                {
                    key: data.eventId,
                    value: JSON.stringify(data),
                    timestamp: Date.now()
                }
            ]
        });
    } catch (error) {
        console.error('Error sending chat message:', error);
        throw error;
    } finally {
        await producer.disconnect();
    }
}

// Example consumer functions
async function startLocationUpdatesConsumer() {
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: TOPICS.LOCATION_UPDATES, fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const data = JSON.parse(message.value.toString());
                console.log('Received location update:', data);
                // Process location update
            }
        });
    } catch (error) {
        console.error('Error in location updates consumer:', error);
        throw error;
    }
}

async function startChatMessagesConsumer() {
    try {
        await consumer.connect();
        await consumer.subscribe({ topic: TOPICS.CHAT_MESSAGES, fromBeginning: true });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const data = JSON.parse(message.value.toString());
                console.log('Received chat message:', data);
                // Process chat message
            }
        });
    } catch (error) {
        console.error('Error in chat messages consumer:', error);
        throw error;
    }
}

// Example usage
async function example() {
    // Send a location update
    await sendLocationUpdate({
        volunteerId: 'vol123',
        eventId: 'event456',
        location: {
            lat: 40.7128,
            lng: -74.0060,
            timestamp: Date.now()
        }
    });

    // Send a chat message
    await sendChatMessage({
        eventId: 'event456',
        senderId: 'vol123',
        message: 'Hello everyone!',
        timestamp: Date.now()
    });

    // Start consumers
    await startLocationUpdatesConsumer();
    await startChatMessagesConsumer();
}

module.exports = {
    kafka,
    producer,
    consumer,
    TOPICS,
    MESSAGE_SCHEMAS,
    sendLocationUpdate,
    sendChatMessage,
    startLocationUpdatesConsumer,
    startChatMessagesConsumer,
    example
}; 