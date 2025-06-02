// Check authentication
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login';
}

// Initialize map with a better default view
let map = L.map('map', {
    zoomControl: true,
    maxZoom: 19,
    minZoom: 2
}).setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

// Add heatmap toggle button
const heatmapButton = document.createElement('button');
heatmapButton.innerHTML = '🌡️';
heatmapButton.className = 'heatmap-toggle';
heatmapButton.title = 'Toggle Heatmap';
document.body.appendChild(heatmapButton);

// Initialize heatmap layer
let heatmapCircles = [];
let isHeatmapVisible = false;
let volunteerLocations = [];

// Simple heatmap data structure
let heatmapData = [];

// Function to update heatmap
function updateHeatmap() {
    if (!isHeatmapVisible) return;

    // Clear existing heatmap circles
    heatmapCircles.forEach(circle => map.removeLayer(circle));
    heatmapCircles = [];

    // Create new circles for each volunteer
    volunteers.forEach((volunteer, id) => {
        if (volunteer.location) {
            const circle = L.circle([volunteer.location.lat, volunteer.location.lng], {
                radius: 50,
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.3
            }).addTo(map);
            heatmapCircles.push(circle);
        }
    });
}

// Toggle heatmap visibility
function toggleHeatmap() {
    isHeatmapVisible = !isHeatmapVisible;
    heatmapButton.classList.toggle('active', isHeatmapVisible);
    
    if (isHeatmapVisible) {
        updateHeatmap();
    } else {
        // Remove all circles
        heatmapCircles.forEach(circle => map.removeLayer(circle));
        heatmapCircles = [];
    }
}

// Add click event listener to heatmap button
heatmapButton.addEventListener('click', toggleHeatmap);

// Custom marker icons with name display
const createVolunteerIcon = (name, isSelected = false, isCurrentUser = false, showName = false) => L.divIcon({
    className: `volunteer-marker ${isSelected ? 'selected' : ''} ${isCurrentUser ? 'current-user' : ''}`,
    html: `
        <div class="marker-pulse"></div>
        ${showName ? `<div class="marker-name">${name}</div>` : ''}
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

// Socket.IO connection
const socket = io({
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
});

// Store volunteers and their markers
const volunteers = new Map();
let currentEventId = null;
let selectedVolunteers = new Set();
let distanceLines = {};
let userLocation = null;
let userName = null;
let userMarker = null;
let markers = {};

// DOM elements
const volunteerNameInput = document.getElementById('volunteerName');
const eventIdInput = document.getElementById('eventId');
const joinButton = document.getElementById('joinEvent');
const leaveButton = document.getElementById('leaveEvent');
const volunteersList = document.getElementById('volunteersList');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-message');

// Calculate distance between two points in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of the earth in meters
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in meters
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Update distances between selected volunteers
function updateDistances() {
    // Clear existing distance lines
    Object.values(distanceLines).forEach(({ line, label }) => {
        line.remove();
        label.remove();
    });
    distanceLines = {};

    // Get all selected volunteer locations
    const selectedVolunteerLocations = Array.from(selectedVolunteers)
        .filter(id => volunteers.has(id) && volunteers.get(id).location)
        .map(id => ({
            id,
            location: volunteers.get(id).location,
            name: volunteers.get(id).name
        }));

    // Calculate and display distances
    for (let i = 0; i < selectedVolunteerLocations.length; i++) {
        for (let j = i + 1; j < selectedVolunteerLocations.length; j++) {
            const v1 = selectedVolunteerLocations[i];
            const v2 = selectedVolunteerLocations[j];
            
            const distance = calculateDistance(
                v1.location.lat, v1.location.lng,
                v2.location.lat, v2.location.lng
            );

            // Create line between volunteers
            const line = L.polyline([
                [v1.location.lat, v1.location.lng],
                [v2.location.lat, v2.location.lng]
            ], {
                color: '#3498db',
                weight: 2,
                opacity: 0.6,
                dashArray: '5, 10'
            }).addTo(map);

            // Add distance label
            const midPoint = [
                (v1.location.lat + v2.location.lat) / 2,
                (v1.location.lng + v2.location.lng) / 2
            ];
            
            const label = L.marker(midPoint, {
                icon: L.divIcon({
                    className: 'distance-label',
                    html: `<div>${v1.name} to ${v2.name}: ${distance.toFixed(0)} m</div>`,
                    iconSize: [150, 20],
                    iconAnchor: [75, 10]
                })
            }).addTo(map);

            distanceLines[`${v1.id}-${v2.id}`] = { line, label };
        }
    }

    // Fit map to show selected volunteers
    if (selectedVolunteerLocations.length > 0) {
        const bounds = L.latLngBounds(
            selectedVolunteerLocations.map(v => [v.location.lat, v.location.lng])
        );
        map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 15
        });
    }
}

// Request location access immediately when page loads
function requestLocationAccess() {
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                showNotification('Location access granted', 'success');
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                userLocation = location;
                
                // Create or update user marker
                if (userMarker) {
                    userMarker.setLatLng([location.lat, location.lng]);
                } else {
                    userMarker = L.marker([location.lat, location.lng], {
                        icon: createVolunteerIcon('You', false, true)
                    }).addTo(map);
                    
                    // Add click handler for user marker
                    userMarker.on('click', (e) => {
                        e.originalEvent.stopPropagation();
                        userMarker.setIcon(createVolunteerIcon('You', false, true, true));
                        setTimeout(() => {
                            userMarker.setIcon(createVolunteerIcon('You', false, true));
                        }, 1000);
                    });
                }
                
                // Center map on user's location
                map.setView([location.lat, location.lng], 15);
                
                // Start watching position
                startLocationTracking();
            },
            (error) => {
                showNotification('Please allow location access to use the map', 'error');
                console.error('Location error:', error);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            }
        );
    } else {
        showNotification('Geolocation is not supported by your browser', 'error');
    }
}

// Start location tracking
function startLocationTracking() {
    if ('geolocation' in navigator) {
        navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                userLocation = location;
                
                // Update user marker
                if (userMarker) {
                    userMarker.setLatLng([location.lat, location.lng]);
                }
                
                if (currentEventId) {
                    socket.emit('locationUpdate', {
                        eventId: currentEventId,
                        location,
                        name: userName
                    });
                }
            },
            (error) => {
                showNotification('Error getting location: ' + error.message, 'error');
                console.error('Location tracking error:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 5000
            }
        );
    }
}

// Request location access when page loads
document.addEventListener('DOMContentLoaded', () => {
    requestLocationAccess();
});

// Join event handler
joinButton.addEventListener('click', () => {
    const name = volunteerNameInput.value.trim();
    const eventId = eventIdInput.value.trim();
    
    if (!name) {
        showNotification('Please enter your name', 'error');
        return;
    }
    if (!eventId) {
        showNotification('Please enter an Event ID', 'error');
        return;
    }

    // Leave previous event if any
    if (currentEventId) {
        leaveEvent();
    }

    userName = name;
    // Join new event
    socket.emit('joinEvent', { eventId, name });
    currentEventId = eventId;
    showNotification(`Joined event ${eventId}`, 'success');
});

// Leave event handler
leaveButton.addEventListener('click', () => {
    if (currentEventId) {
        leaveEvent();
    }
});

function leaveEvent() {
    if (currentEventId) {
        socket.emit('leaveEvent', currentEventId);
        clearVolunteersList();
        clearChat();
        currentEventId = null;
        showNotification('Left the event', 'info');
    }
}

// Update marker on map
function updateMarker(volunteerId, location, name) {
    if (!volunteers.has(volunteerId)) {
        const marker = L.marker([location.lat, location.lng], { 
            icon: createVolunteerIcon(name, selectedVolunteers.has(volunteerId))
        }).addTo(map);
        
        marker.bindPopup(`<b>${name}</b><br>Last seen: Just now`);
        
        // Add click handler for distance measurement
        marker.on('click', (e) => {
            e.originalEvent.stopPropagation(); // Prevent map click event
            
            // Show name temporarily
            marker.setIcon(createVolunteerIcon(name, selectedVolunteers.has(volunteerId), false, true));
            setTimeout(() => {
                marker.setIcon(createVolunteerIcon(name, selectedVolunteers.has(volunteerId)));
            }, 1000);
            
            if (selectedVolunteers.has(volunteerId)) {
                selectedVolunteers.delete(volunteerId);
                marker.setIcon(createVolunteerIcon(name, false));
            } else {
                selectedVolunteers.add(volunteerId);
                marker.setIcon(createVolunteerIcon(name, true));
            }
            updateDistances();
        });
        
        volunteers.set(volunteerId, { name, marker, location, lastUpdate: Date.now() });
    } else {
        const volunteer = volunteers.get(volunteerId);
        volunteer.marker.setLatLng([location.lat, location.lng]);
        volunteer.location = location;
        volunteer.lastUpdate = Date.now();
        volunteers.set(volunteerId, volunteer);
    }

    // Update distances if volunteers are selected
    if (selectedVolunteers.size > 0) {
        updateDistances();
    }
}

// Update volunteers list
function updateVolunteersList(volunteersData) {
    clearVolunteersList();
    volunteersData.forEach(volunteer => {
        const listItem = document.createElement('div');
        listItem.className = 'volunteer-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'volunteer-name';
        nameSpan.textContent = volunteer.name;
        
        const statusSpan = document.createElement('span');
        statusSpan.className = `volunteer-status ${volunteer.status}`;
        statusSpan.textContent = volunteer.status;
        
        const lastSeenSpan = document.createElement('span');
        lastSeenSpan.className = 'volunteer-last-seen';
        lastSeenSpan.textContent = `Last seen: ${formatTime(volunteer.lastSeen)}`;
        
        listItem.appendChild(nameSpan);
        listItem.appendChild(statusSpan);
        listItem.appendChild(lastSeenSpan);
        
        volunteersList.appendChild(listItem);
    });
}

// Clear volunteers list
function clearVolunteersList() {
    volunteersList.innerHTML = '';
    volunteers.clear();
    selectedVolunteers.clear();
    map.eachLayer((layer) => {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });
    distanceLines = {};
}

// Clear chat
function clearChat() {
    chatMessages.innerHTML = '';
}

// Format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Click on map to deselect volunteers
map.on('click', (e) => {
    // Only deselect if clicking on the map (not on a marker)
    if (e.originalEvent.target === map._container) {
        if (selectedVolunteers.size > 0) {
            selectedVolunteers.clear();
            volunteers.forEach(volunteer => {
                volunteer.marker.setIcon(createVolunteerIcon(volunteer.name, false));
            });
            updateDistances();
        }
    }
});

// Socket event handlers
socket.on('connect', () => {
    showNotification('Connected to server', 'success');
});

socket.on('disconnect', () => {
    showNotification('Disconnected from server', 'error');
});

socket.on('volunteersList', (volunteersData) => {
    updateVolunteersList(volunteersData);
});

socket.on('volunteerJoined', (data) => {
    showNotification(`${data.name} joined the event`, 'info');
});

socket.on('volunteerLeft', (data) => {
    showNotification(`${data.name} left the event`, 'info');
    if (volunteers.has(data.id)) {
        const volunteer = volunteers.get(data.id);
        map.removeLayer(volunteer.marker);
        volunteers.delete(data.id);
        selectedVolunteers.delete(data.id);
        updateDistances();
    }
});

socket.on('locationUpdate', (data) => {
    updateMarker(data.userId, data.location, data.name);

    // Update heatmap if visible
    if (isHeatmapVisible) {
        updateHeatmap();
    }
});

// Chat message handling
function addChatMessage(data) {
    console.log('Adding chat message:', data);
    const messageElement = document.createElement('div');
    messageElement.className = 'message';
    
    const senderElement = document.createElement('div');
    senderElement.className = 'message-sender';
    senderElement.textContent = data.name;
    
    const contentElement = document.createElement('div');
    contentElement.className = 'message-content';
    contentElement.textContent = data.message;
    
    const timeElement = document.createElement('div');
    timeElement.className = 'message-time';
    timeElement.textContent = formatTime(data.timestamp);
    
    messageElement.appendChild(senderElement);
    messageElement.appendChild(contentElement);
    messageElement.appendChild(timeElement);
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send chat message
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message && currentEventId) {
        console.log('Sending chat message:', { eventId: currentEventId, message });
        socket.emit('chatMessage', {
            eventId: currentEventId,
            message: message
        });
        chatInput.value = '';
    }
}

// Add event listeners for chat
sendButton.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

// Socket event handlers
socket.on('chatMessage', (data) => {
    console.log('Received chat message:', data);
    addChatMessage(data);
});

// Update volunteer location
function updateVolunteerLocation(socketId, data) {
    if (markers[socketId]) {
        markers[socketId].setLatLng([data.latitude, data.longitude]);
    } else {
        const marker = createVolunteerIcon(data.name);
        markers[socketId] = L.marker([data.latitude, data.longitude], { icon: marker }).addTo(map);
    }

    // Update volunteer locations array for heatmap
    const existingIndex = volunteerLocations.findIndex(loc => loc.socketId === socketId);
    if (existingIndex !== -1) {
        volunteerLocations[existingIndex] = { ...data, socketId };
    } else {
        volunteerLocations.push({ ...data, socketId });
    }

    // Update heatmap if visible
    if (isHeatmapVisible && heatmapCircles.length > 0) {
        updateHeatmap();
    }
}

// Remove volunteer
function removeVolunteer(socketId) {
    if (markers[socketId]) {
        map.removeLayer(markers[socketId]);
        delete markers[socketId];
    }

    // Remove from volunteer locations array
    volunteerLocations = volunteerLocations.filter(loc => loc.socketId !== socketId);

    // Update heatmap if visible
    if (isHeatmapVisible && heatmapCircles.length > 0) {
        updateHeatmap();
    }
}

// Add logout functionality
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login';
}

// Add logout button to the UI
const logoutButton = document.createElement('button');
logoutButton.textContent = 'Logout';
logoutButton.className = 'logout-button';
logoutButton.onclick = logout;

// Find the header element and append the logout button
const header = document.querySelector('header');
if (header) {
    header.appendChild(logoutButton);
} else {
    console.warn('Header element not found, logout button not added');
}

// Handle geofence alerts
socket.on('geofenceAlert', (data) => {
    console.log('Geofence Alert:', data);
    
    // Show notification
    showNotification(data.message, data.type.toLowerCase());
    
    // Add alert to chat
    addChatMessage({
        name: 'System',
        message: data.message,
        timestamp: data.timestamp
    });
});

// Add geofence drawing functionality
let drawingMode = false;
let currentCircle = null;
let drawingPoints = [];

// Add geofence controls
const geofenceControls = document.createElement('div');
geofenceControls.className = 'geofence-controls';
geofenceControls.innerHTML = `
    <button id="drawCircle" class="geofence-button">Draw Circle</button>
    <button id="saveGeofence" class="geofence-button" style="display: none;">Save Geofence</button>
    <button id="cancelDrawing" class="geofence-button" style="display: none;">Cancel</button>
`;
document.body.appendChild(geofenceControls);

// Add geofence styles
const style = document.createElement('style');
style.textContent = `
    .geofence-controls {
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 1000;
        display: flex;
        gap: 10px;
    }
    
    .geofence-button {
        background: white;
        border: 2px solid #ccc;
        border-radius: 4px;
        padding: 8px 12px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s ease;
    }
    
    .geofence-button:hover {
        background: #f0f0f0;
        border-color: #999;
    }
    
    .geofence-button.active {
        background: #4CAF50;
        color: white;
        border-color: #45a049;
    }
`;
document.head.appendChild(style);

// Handle circle drawing
document.getElementById('drawCircle').addEventListener('click', () => {
    drawingMode = 'circle';
    document.getElementById('drawCircle').classList.add('active');
    document.getElementById('saveGeofence').style.display = 'block';
    document.getElementById('cancelDrawing').style.display = 'block';
    
    // Clear any existing drawing
    if (currentCircle) {
        map.removeLayer(currentCircle);
        currentCircle = null;
    }
    drawingPoints = [];
});

// Handle map clicks for drawing
map.on('click', (e) => {
    if (!drawingMode) return;
    
    if (drawingMode === 'circle') {
        if (drawingPoints.length === 0) {
            drawingPoints.push([e.latlng.lat, e.latlng.lng]);
        } else {
            const center = drawingPoints[0];
            const radius = calculateDistance(
                center[0], center[1],
                e.latlng.lat, e.latlng.lng
            );
            
            if (currentCircle) {
                map.removeLayer(currentCircle);
            }
            
            currentCircle = L.circle(center, {
                radius: radius,
                color: 'red',
                fillColor: '#f03',
                fillOpacity: 0.3
            }).addTo(map);
        }
    }
});

// Handle save geofence
document.getElementById('saveGeofence').addEventListener('click', async () => {
    if (!currentEventId) {
        showNotification('Please join an event first', 'error');
        return;
    }
    
    const name = prompt('Enter geofence name:');
    if (!name) return;
    
    try {
        if (!currentCircle) {
            showNotification('Please draw a circle first', 'error');
            return;
        }

        const center = currentCircle.getLatLng();
        const radius = currentCircle.getRadius();

        const fenceData = {
            eventId: currentEventId,
            name,
            type: 'INCLUSION',
            lat: center.lat,
            lng: center.lng,
            radius: radius,
            rules: [{
                condition: 'ENTER',
                action: 'ALERT',
                message: `Volunteer entered ${name}`
            }]
        };
        
        console.log('Sending geofence data:', fenceData);
        
        const response = await fetch('/api/geofences', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fenceData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Geofence created successfully', 'success');
            resetDrawing();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Failed to create geofence');
        }
    } catch (error) {
        console.error('Error creating geofence:', error);
        showNotification(error.message || 'Failed to create geofence', 'error');
    }
});

// Handle cancel drawing
document.getElementById('cancelDrawing').addEventListener('click', resetDrawing);

// Reset drawing state
function resetDrawing() {
    drawingMode = false;
    if (currentCircle) {
        map.removeLayer(currentCircle);
        currentCircle = null;
    }
    drawingPoints = [];
    
    document.getElementById('drawCircle').classList.remove('active');
    document.getElementById('saveGeofence').style.display = 'none';
    document.getElementById('cancelDrawing').style.display = 'none';
} 