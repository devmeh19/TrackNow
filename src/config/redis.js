const Redis = require('ioredis');

// Create Redis publisher client
const publisher = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

// Create Redis subscriber client
const subscriber = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

// Subscribe to channels
const subscribeToChannels = (channels) => {
    channels.forEach(channel => {
        subscriber.subscribe(channel, (err) => {
            if (err) {
                console.error(`Failed to subscribe to ${channel}:`, err);
            } else {
                console.log(`Subscribed to ${channel}`);
            }
        });
    });
};

// Publish message to channel
const publishMessage = async (channel, message) => {
    try {
        await publisher.publish(channel, JSON.stringify(message));
        return true;
    } catch (error) {
        console.error('Publish error:', error);
        return false;
    }
};

// Handle incoming messages
subscriber.on('message', (channel, message) => {
    console.log(`Received message from ${channel}:`, message);
    // Add your message handling logic here
});

module.exports = {
    publisher,
    subscriber,
    subscribeToChannels,
    publishMessage
}; 