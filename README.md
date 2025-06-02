# TrackNow - Real-Time Volunteer Tracking System

TrackNow is a comprehensive real-time tracking and management system designed for coordinating volunteers during events and emergency situations. The system provides real-time location tracking, geofencing, chat functionality, and distance measurements between volunteers.

## Features

### Real-Time Location Tracking
- Live tracking of volunteer locations on an interactive map
- Custom markers with volunteer names and status
- Heatmap visualization of volunteer density
- Automatic location updates with high accuracy

### Geofencing System
- Create circular geofences on the map
- Set up inclusion/exclusion zones
- Real-time alerts when volunteers enter/exit geofences
- Customizable alert messages and actions

### Communication Tools
- Real-time chat system for event coordination
- System notifications for important events
- Visual alerts for geofence breaches
- Status updates for all volunteers

### Distance Measurement
- Measure distances between selected volunteers
- Visual distance lines on the map
- Real-time distance updates
- Multiple volunteer selection for group measurements

### User Interface
- Clean and intuitive map interface
- Easy-to-use controls for all features
- Responsive design for various screen sizes
- Custom markers and visual indicators

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with PostGIS for geospatial queries
- **Real-time Communication**: Socket.IO
- **Maps**: Leaflet.js with OpenStreetMap
- **Authentication**: JWT-based authentication

## Setup Instructions

1. Clone the repository:
```bash
git clone [repository-url]
cd tracknow
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=3000
```

4. Start the server:
```bash
npm run dev
```

5. Access the application:
Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Login/Register**: Create an account or login to access the system
2. **Join Event**: Enter your name and event ID to join a tracking session
3. **Track Volunteers**: View real-time locations of all volunteers on the map
4. **Create Geofences**: Use the drawing tools to create geofences
5. **Measure Distances**: Click on volunteers to measure distances between them
6. **Chat**: Use the chat system to communicate with other volunteers

## Security Features

- JWT-based authentication
- Secure WebSocket connections
- Input validation and sanitization
- Rate limiting for API endpoints
- Secure password hashing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository or contact the development team. 