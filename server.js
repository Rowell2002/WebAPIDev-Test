import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable express.json() middleware
app.use(express.json());

// Root route returning status and session
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    session: 'N86007CEM S2'
  });
});

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Load seed.json into memory at startup
const seedPath = path.join(__dirname, 'seed.json');
let data = { provinces: [], districts: [], stations: [], vehicles: [], pings: [] };

try {
  const fileContent = fs.readFileSync(seedPath, 'utf8');
  data = JSON.parse(fileContent);
} catch (err) {
  console.error('Error loading seed.json:', err);
}

// Build deviceKeys dynamically from loaded vehicles
const deviceKeys = {};
data.vehicles.forEach(v => {
  const padId = String(v.id).padStart(2, '0');
  deviceKeys[`v-${padId}`] = `key_v${padId}`;
});

// Helper to find vehicle by id or registration number
const findVehicle = (idOrReg) => {
  const parsedId = parseInt(idOrReg, 10);
  return data.vehicles.find(v => 
    (v.id === parsedId) || 
    (v.register_number === idOrReg) || 
    (v.registration_number === idOrReg)
  );
};

// GET /provinces - Retrieve all provinces
app.get('/provinces', (req, res) => {
  const mapped = data.provinces.map(p => ({
    province_id: p.id,
    name: p.name
  }));
  res.json(mapped);
});

// GET /provinces/:id - Retrieve a specific province by id
app.get('/provinces/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const province = data.provinces.find(p => p.id === id);
  if (!province) {
    return res.status(404).json({ error: 'Province not found' });
  }
  res.json({
    province_id: province.id,
    name: province.name
  });
});

// GET /districts - Retrieve all districts
app.get('/districts', (req, res) => {
  const mapped = data.districts.map(d => ({
    district_id: d.id,
    name: d.name,
    province_id: d.province_id
  }));
  res.json(mapped);
});

// GET /districts/:id - Retrieve a specific district by id
app.get('/districts/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const district = data.districts.find(d => d.id === id);
  if (!district) {
    return res.status(404).json({ error: 'District not found' });
  }
  res.json({
    district_id: district.id,
    name: district.name,
    province_id: district.province_id
  });
});

// GET /stations - Retrieve all stations
app.get('/stations', (req, res) => {
  const mapped = data.stations.map(s => ({
    station_id: s.id,
    name: s.name,
    district_id: s.district_id
  }));
  res.json(mapped);
});

// GET /stations/:id - Retrieve a specific station by id
app.get('/stations/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const station = data.stations.find(s => s.id === id);
  if (!station) {
    return res.status(404).json({ error: 'Station not found' });
  }
  res.json({
    station_id: station.id,
    name: station.name,
    district_id: station.district_id
  });
});

// GET /vehicles - Retrieve all vehicles
app.get('/vehicles', (req, res) => {
  const mapped = data.vehicles.map(v => ({
    vehicle_id: v.id,
    reg_number: v.register_number || v.registration_number,
    device_id: v.device_id,
    station_id: v.station_id
  }));
  res.json(mapped);
});

// GET /vehicles/:id - Retrieve a specific vehicle by id (with last_ping composite)
app.get('/vehicles/:id', (req, res) => {
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  const vehiclePings = data.pings.filter(p => p.vehicle_id === vehicle.id);
  let lastPing = null;
  if (vehiclePings.length > 0) {
    vehiclePings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const lp = vehiclePings[0];
    lastPing = {
      ping_id: lp.id,
      vehicle_id: lp.vehicle_id,
      timestamp: lp.timestamp,
      lat: lp.latitude,
      lng: lp.longitude,
      speed: lp.speed !== undefined ? lp.speed : 0
    };
  }

  res.json({
    vehicle_id: vehicle.id,
    reg_number: vehicle.register_number || vehicle.registration_number,
    device_id: vehicle.device_id,
    station_id: vehicle.station_id,
    last_ping: lastPing
  });
});

// GET /vehicles/:id/pings - Retrieve pings for a specific vehicle by id
app.get('/vehicles/:id/pings', (req, res) => {
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const vehiclePings = data.pings
    .filter(p => p.vehicle_id === vehicle.id)
    .map(p => ({
      ping_id: p.id,
      vehicle_id: p.vehicle_id,
      timestamp: p.timestamp,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed !== undefined ? p.speed : 0
    }));
  res.json(vehiclePings);
});

// GET /vehicles/:id/last-position - Retrieve most recent position only (no vehicle metadata)
app.get('/vehicles/:id/last-position', (req, res) => {
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  const vehiclePings = data.pings.filter(p => p.vehicle_id === vehicle.id);
  if (vehiclePings.length === 0) {
    return res.status(404).json({ error: 'No pings found for this vehicle' });
  }

  vehiclePings.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const lp = vehiclePings[0];

  res.json({
    vehicle_id: lp.vehicle_id,
    timestamp: lp.timestamp,
    lat: lp.latitude,
    lng: lp.longitude,
    speed: lp.speed !== undefined ? lp.speed : 0
  });
});

// POST /vehicles/:vehicleId/pings - Create a new ping record for a vehicle
app.post('/vehicles/:vehicleId/pings', (req, res) => {
  // 1. Require X-API-Key header. 401 if header is absent
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Unauthorized: X-API-Key header is missing' });
  }

  // 2. 404 if vehicleId not in vehicles array
  const vehicle = findVehicle(req.params.vehicleId);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // 3. 403 if key does not match deviceKeys[vehicleId]
  const padId = String(vehicle.id).padStart(2, '0');
  const deviceKey = `v-${padId}`;
  const expectedKey = deviceKeys[deviceKey];

  if (apiKey !== expectedKey) {
    return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
  }

  // 4. 400 if body missing latitude, longitude, or speed
  const { latitude, longitude, speed } = req.body;
  if (
    latitude === undefined || latitude === null ||
    longitude === undefined || longitude === null ||
    speed === undefined || speed === null
  ) {
    return res.status(400).json({ error: 'Bad Request: Missing latitude, longitude, or speed' });
  }

  // 5. Server sets timestamp and creates ping
  const timestamp = new Date().toISOString();
  const pingId = data.pings.length > 0 ? Math.max(...data.pings.map(p => p.id)) + 1 : 1;

  const newPing = {
    id: pingId,
    vehicle_id: vehicle.id,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    speed: parseFloat(speed),
    timestamp: timestamp
  };

  // Push ping to array
  data.pings.push(newPing);

  // Set Location header: /vehicles/:vehicleId/pings/:pingId
  res.setHeader('Location', `/vehicles/${vehicle.id}/pings/${pingId}`);

  // Set ETag and Last-Modified headers
  const pingStr = JSON.stringify(newPing);
  const etag = crypto.createHash('md5').update(pingStr).digest('hex');
  res.setHeader('ETag', `"${etag}"`);
  res.setHeader('Last-Modified', new Date(timestamp).toUTCString());

  // Return 201 and the ping matching requested shape
  res.status(201).json({
    ping_id: newPing.id,
    vehicle_id: newPing.vehicle_id,
    timestamp: newPing.timestamp,
    lat: newPing.latitude,
    lng: newPing.longitude,
    speed: newPing.speed
  });
});

// Only listen when run directly (local development)
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
  });
}

export default app;
