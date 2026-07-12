const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Helper to find vehicle by id or registration number
const findVehicle = (idOrReg) => {
  const parsedId = parseInt(idOrReg, 10);
  return data.vehicles.find(v => 
    (v.id === parsedId) || 
    (v.register_number === idOrReg) || 
    (v.registration_number === idOrReg)
  );
};

// GET /vehicles/:id - Retrieve a specific vehicle by id (with last_ping composite)
app.get('/vehicles/:id', (req, res) => {
  const vehicle = findVehicle(req.params.id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // Find last_ping: filter pings where vehicle_id matches, sort by timestamp descending, take [0]
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

  // Sort by timestamp descending
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
