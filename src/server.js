const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');
const Event = require('./models/Event');
const Volunteer = require('./models/Volunteer');
const authRoutes = require('./routes/auth');
const auth = require('./middleware/auth');
const GeoFenceService = require('./services/geoFenceService');
const GeoFence = require('./models/GeoFence');
require('dotenv').config();

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);

// Protected routes
app.get('/api/protected', auth, (req, res) => {
    res.json({ message: 'This is a protected route', user: req.user });
});

// Serve static files
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'signup.html'));
});

app.get('/', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store active events and their participants
const activeEvents = new Map();

// Initialize GeoFence service
const geoFenceService = new GeoFenceService(io);
geoFenceService.initialize().catch(console.error);

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log('New client connected:', socket.id);

  // Join event room
  socket.on('joinEvent', async ({ eventId, name }) => {
    try {
      // Create or update volunteer in database
      let volunteer = await Volunteer.findOne({ socketId: socket.id });
      if (!volunteer) {
        volunteer = new Volunteer({
          socketId: socket.id,
          name: name,
          status: 'active'
        });
      } else {
        volunteer.name = name;
        volunteer.status = 'active';
      }
      await volunteer.save();

      // Join socket room
      socket.join(eventId);
      socket.currentEventId = eventId; // Store current event ID
      console.log(`Client ${socket.id} joined event ${eventId}`);

      // Get or create event
      let event = await Event.findOne({ eventId });
      if (!event) {
        event = new Event({
          eventId,
          name: `Event ${eventId}`,
          status: 'active'
        });
        await event.save();
      }

      // Add volunteer to event
      if (!event.volunteers.includes(volunteer._id)) {
        event.volunteers.push(volunteer._id);
        await event.save();
      }

      // Update volunteer's current event
      volunteer.currentEvent = event._id;
      await volunteer.save();

      // Get all volunteers in the event
      const volunteers = await Volunteer.find({
        _id: { $in: event.volunteers }
      }).select('name status lastSeen');

      // Send current volunteers list to the new participant
      socket.emit('volunteersList', volunteers);

      // Notify others in the room
      socket.to(eventId).emit('volunteerJoined', {
        id: socket.id,
        name: name
      });
    } catch (error) {
      console.error('Error joining event:', error);
    }
  });

  // Handle chat messages
  socket.on('chatMessage', async ({ eventId, message }) => {
    try {
      console.log('Chat message received:', { eventId, message, socketId: socket.id });
      const volunteer = await Volunteer.findOne({ socketId: socket.id });
      if (volunteer && socket.currentEventId === eventId) {
        const chatData = {
          userId: socket.id,
          name: volunteer.name,
          message: message,
          timestamp: Date.now()
        };
        console.log('Broadcasting chat message:', chatData);
        io.to(eventId).emit('chatMessage', chatData);
      }
    } catch (error) {
      console.error('Error sending chat message:', error);
    }
  });

  // Handle location updates
  socket.on('locationUpdate', async ({ eventId, location, name }) => {
    try {
      // Update volunteer's location in database
      const volunteer = await Volunteer.findOne({ socketId: socket.id });
      if (volunteer) {
        volunteer.location = {
          lat: location.lat,
          lng: location.lng,
          lastUpdate: new Date()
        };
        volunteer.lastSeen = new Date();
        await volunteer.save();

        // Broadcast location to others in the room
        socket.to(eventId).emit('locationUpdate', {
          userId: socket.id,
          location: location,
          name: name
        });
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('Client disconnected:', socket.id);
    if (socket.currentEventId) {
      await leaveEvent(socket, socket.currentEventId);
    }
  });
});

// Helper function to remove volunteer from event
async function leaveEvent(socket, eventId) {
  try {
    const volunteer = await Volunteer.findOne({ socketId: socket.id });
    if (volunteer) {
      volunteer.status = 'inactive';
      volunteer.lastSeen = new Date();
      await volunteer.save();

      const event = await Event.findOne({ eventId });
      if (event) {
        event.volunteers = event.volunteers.filter(v => v.toString() !== volunteer._id.toString());
        await event.save();

        // Notify others in the room
        socket.to(eventId).emit('volunteerLeft', {
          id: socket.id,
          name: volunteer.name,
          timestamp: Date.now()
        });

        console.log(`Client ${socket.id} left event ${eventId}`);
      }
    }
  } catch (error) {
    console.error('Error leaving event:', error);
  }
}

// Add geofence API endpoints
app.post('/api/geofences', async (req, res) => {
    try {
        const fence = await geoFenceService.addFence(req.body);
        res.json(fence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/geofences/:id', async (req, res) => {
    try {
        const fence = await geoFenceService.updateFence(req.params.id, req.body);
        res.json(fence);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/geofences/:id', async (req, res) => {
    try {
        await geoFenceService.deleteFence(req.params.id);
        res.json({ message: 'Geofence deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/geofences/event/:eventId', async (req, res) => {
    try {
        const fences = await GeoFence.find({ 
            eventId: req.params.eventId,
            isActive: true 
        });
        res.json(fences);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 