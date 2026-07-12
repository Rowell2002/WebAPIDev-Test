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

// GET /provinces/:provinceId - Retrieve a specific province by id
app.get('/provinces/:provinceId', (req, res) => {
  const id = parseInt(req.params.provinceId, 10);
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

// GET /districts/:districtId - Retrieve a specific district by id
app.get('/districts/:districtId', (req, res) => {
  const id = parseInt(req.params.districtId, 10);
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

// GET /stations/:stationId - Retrieve a specific station by id
app.get('/stations/:stationId', (req, res) => {
  const id = parseInt(req.params.stationId, 10);
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
    reg_number: v.registration_number,
    device_id: v.device_id,
    station_id: v.station_id
  }));
  res.json(mapped);
});

// GET /vehicles/:vehicleId - Retrieve a specific vehicle by id (with last_ping composite)
app.get('/vehicles/:vehicleId', (req, res) => {
  const id = parseInt(req.params.vehicleId, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  // Find last_ping: filter pings where vehicle_id matches, sort by timestamp descending, take [0]
  const vehiclePings = data.pings.filter(p => p.vehicle_id === id);
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
    reg_number: vehicle.registration_number,
    device_id: vehicle.device_id,
    station_id: vehicle.station_id,
    last_ping: lastPing
  });
});

// GET /vehicles/:vehicleId/pings - Retrieve pings for a specific vehicle by id
app.get('/vehicles/:vehicleId/pings', (req, res) => {
  const id = parseInt(req.params.vehicleId, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }
  const vehiclePings = data.pings
    .filter(p => p.vehicle_id === id)
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

// GET /vehicles/:vehicleId/last-position - Retrieve most recent position only (no vehicle metadata)
app.get('/vehicles/:vehicleId/last-position', (req, res) => {
  const id = parseInt(req.params.vehicleId, 10);
  const vehicle = data.vehicles.find(v => v.id === id);
  if (!vehicle) {
    return res.status(404).json({ error: 'Vehicle not found' });
  }

  const vehiclePings = data.pings.filter(p => p.vehicle_id === id);
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
