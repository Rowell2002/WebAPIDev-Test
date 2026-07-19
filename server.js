import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express basicAuth middleware
const basicAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Police API"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'basic') {
    res.setHeader('WWW-Authenticate', 'Basic realm="Police API"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let credentials;
  try {
    credentials = Buffer.from(parts[1], 'base64').toString('utf-8');
  } catch (err) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Police API"');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const [username, password] = credentials.split(':');
  if (username !== 'police' || password !== 'nibm2024') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

// Enable express.json() middleware
app.use(express.json());

// Root route returning status and session
app.get('/', basicAuth, (req, res) => {
  res.json({
    status: 'ok',
    session: 'N86007CEM S2'
  });
});

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Error: MONGODB_URI environment variable is not defined!');
  process.exit(1);
}
const client = new MongoClient(uri);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('WebAPI');
    console.log('Connected to MongoDB database successfully!');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}
await connectDB();

// Build deviceKeys dynamically from loaded vehicles in DB
const deviceKeys = {};
try {
  const vehicles = await db.collection('vehicles').find().toArray();
  vehicles.forEach(v => {
    const padId = String(v.id).padStart(2, '0');
    deviceKeys[`v-${padId}`] = `key_v${padId}`;
  });
} catch (err) {
  console.error('Failed to load device keys from DB:', err);
}

// Helper to find vehicle by id or registration number in MongoDB
const findVehicle = async (idOrReg) => {
  const parsedId = parseInt(idOrReg, 10);
  const query = {
    $or: [
      { id: parsedId },
      { register_number: idOrReg },
      { registration_number: idOrReg }
    ]
  };
  return await db.collection('vehicles').findOne(query);
};


// GET /provinces - Retrieve all provinces
app.get('/provinces', basicAuth, async (req, res) => {
  try {
    const provinces = await db.collection('provinces').find().toArray();
    const mapped = provinces.map(p => ({
      province_id: p.id,
      name: p.name
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /provinces/:id - Retrieve a specific province by id
app.get('/provinces/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const province = await db.collection('provinces').findOne({ id });
    if (!province) {
      return res.status(404).json({ error: 'Province not found' });
    }
    res.json({
      province_id: province.id,
      name: province.name
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /districts - Retrieve all districts
app.get('/districts', basicAuth, async (req, res) => {
  try {
    const districts = await db.collection('districts').find().toArray();
    const mapped = districts.map(d => ({
      district_id: d.id,
      name: d.name,
      province_id: d.province_id
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /districts/:id - Retrieve a specific district by id
app.get('/districts/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const district = await db.collection('districts').findOne({ id });
    if (!district) {
      return res.status(404).json({ error: 'District not found' });
    }
    res.json({
      district_id: district.id,
      name: district.name,
      province_id: district.province_id
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /stations - Retrieve all stations
app.get('/stations', basicAuth, async (req, res) => {
  try {
    const stations = await db.collection('stations').find().toArray();
    const mapped = stations.map(s => ({
      station_id: s.id,
      name: s.name,
      district_id: s.district_id
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /stations/:id - Retrieve a specific station by id
app.get('/stations/:id', basicAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const station = await db.collection('stations').findOne({ id });
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    res.json({
      station_id: station.id,
      name: station.name,
      district_id: station.district_id
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles - Retrieve all vehicles
app.get('/vehicles', basicAuth, async (req, res) => {
  try {
    const vehicles = await db.collection('vehicles').find().toArray();
    const mapped = vehicles.map(v => ({
      vehicle_id: v.id,
      reg_number: v.register_number || v.registration_number,
      device_id: v.device_id,
      station_id: v.station_id
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /vehicles - Register a new vehicle
app.post('/vehicles', basicAuth, async (req, res) => {
  try {
    const register_number = req.body.register_number || req.body.reg_number;
    const { device_id, station_id } = req.body;
    if (!register_number || !device_id || station_id === undefined || station_id === null) {
      return res.status(400).json({ error: 'Bad Request: Missing register_number (or reg_number), device_id, or station_id' });
    }

    // Validate referenced station_id exists in the database
    const stationIdNum = parseInt(station_id, 10);
    const station = await db.collection('stations').findOne({ id: stationIdNum });
    if (!station) {
      return res.status(400).json({ error: 'Bad Request: Referenced station_id does not exist' });
    }

    // Check if vehicle with same register_number or device_id already exists
    const existingVehicle = await db.collection('vehicles').findOne({
      $or: [
        { register_number },
        { registration_number: register_number },
        { device_id }
      ]
    });
    if (existingVehicle) {
      return res.status(409).json({ error: 'Conflict: Vehicle or device already registered' });
    }

    // Determine vehicle ID: use client-supplied ID if provided, otherwise generate next ID dynamically
    let vehicleId = parseInt(req.body.vehicle_id || req.body.id, 10);
    if (!isNaN(vehicleId)) {
      // If client supplied an ID, make sure it is not already taken
      const idConflict = await db.collection('vehicles').findOne({ id: vehicleId });
      if (idConflict) {
        return res.status(409).json({ error: `Conflict: Vehicle ID ${vehicleId} is already in use` });
      }
    } else {
      const maxVehicleDoc = await db.collection('vehicles')
        .find()
        .sort({ id: -1 })
        .limit(1)
        .next();
      vehicleId = maxVehicleDoc ? maxVehicleDoc.id + 1 : 1;
    }

    const newVehicle = {
      id: vehicleId,
      register_number,
      device_id,
      station_id: stationIdNum
    };

    // Insert new vehicle
    await db.collection('vehicles').insertOne(newVehicle);

    // Register corresponding device key in memory immediately
    const padId = String(vehicleId).padStart(2, '0');
    deviceKeys[`v-${padId}`] = `key_v${padId}`;

    // Set Location header
    res.setHeader('Location', `/vehicles/${vehicleId}`);

    // Return created vehicle
    res.status(201).json({
      vehicle_id: newVehicle.id,
      reg_number: newVehicle.register_number,
      device_id: newVehicle.device_id,
      station_id: newVehicle.station_id
    });
  } catch (err) {
    console.error('Error registering new vehicle:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:id - Retrieve a specific vehicle by id (with last_ping composite)
app.get('/vehicles/:id', basicAuth, async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const lastPingDoc = await db.collection('pings')
      .find({ vehicle_id: vehicle.id })
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    let lastPing = null;
    if (lastPingDoc) {
      lastPing = {
        ping_id: lastPingDoc.id,
        vehicle_id: lastPingDoc.vehicle_id,
        timestamp: lastPingDoc.timestamp,
        lat: lastPingDoc.latitude,
        lng: lastPingDoc.longitude,
        speed: lastPingDoc.speed !== undefined ? lastPingDoc.speed : 0
      };
    }

    res.json({
      vehicle_id: vehicle.id,
      reg_number: vehicle.register_number || vehicle.registration_number,
      device_id: vehicle.device_id,
      station_id: vehicle.station_id,
      last_ping: lastPing
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:id/pings - Retrieve pings for a specific vehicle by id
app.get('/vehicles/:id/pings', basicAuth, async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    const pings = await db.collection('pings')
      .find({ vehicle_id: vehicle.id })
      .toArray();

    const mapped = pings.map(p => ({
      ping_id: p.id,
      vehicle_id: p.vehicle_id,
      timestamp: p.timestamp,
      lat: p.latitude,
      lng: p.longitude,
      speed: p.speed !== undefined ? p.speed : 0
    }));
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /vehicles/:id/last-position - Retrieve most recent position only (no vehicle metadata)
app.get('/vehicles/:id/last-position', basicAuth, async (req, res) => {
  try {
    const vehicle = await findVehicle(req.params.id);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const lastPingDoc = await db.collection('pings')
      .find({ vehicle_id: vehicle.id })
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    if (!lastPingDoc) {
      return res.status(404).json({ error: 'No pings found for this vehicle' });
    }

    res.json({
      vehicle_id: lastPingDoc.vehicle_id,
      timestamp: lastPingDoc.timestamp,
      lat: lastPingDoc.latitude,
      lng: lastPingDoc.longitude,
      speed: lastPingDoc.speed !== undefined ? lastPingDoc.speed : 0
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /vehicles/:vehicleId/pings - Create a new ping record for a vehicle
app.post('/vehicles/:vehicleId/pings', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({ error: 'Unauthorized: X-API-Key header is missing' });
    }

    const vehicle = await findVehicle(req.params.vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const padId = String(vehicle.id).padStart(2, '0');
    const deviceKey = `v-${padId}`;
    const expectedKey = deviceKeys[deviceKey];

    if (apiKey !== expectedKey) {
      return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }

    const { latitude, longitude, speed } = req.body;
    if (
      latitude === undefined || latitude === null ||
      longitude === undefined || longitude === null ||
      speed === undefined || speed === null
    ) {
      return res.status(400).json({ error: 'Bad Request: Missing latitude, longitude, or speed' });
    }

    const timestamp = new Date().toISOString();

    const maxPingDoc = await db.collection('pings')
      .find()
      .sort({ id: -1 })
      .limit(1)
      .next();
    const pingId = maxPingDoc ? maxPingDoc.id + 1 : 1;

    const newPing = {
      id: pingId,
      vehicle_id: vehicle.id,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      speed: parseFloat(speed),
      timestamp: timestamp
    };

    await db.collection('pings').insertOne(newPing);

    res.setHeader('Location', `/vehicles/${vehicle.id}/pings/${pingId}`);

    const pingStr = JSON.stringify(newPing);
    const etag = crypto.createHash('md5').update(pingStr).digest('hex');
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Last-Modified', new Date(timestamp).toUTCString());

    res.status(201).json({
      ping_id: newPing.id,
      vehicle_id: newPing.vehicle_id,
      timestamp: newPing.timestamp,
      lat: newPing.latitude,
      lng: newPing.longitude,
      speed: newPing.speed
    });
  } catch (err) {
    console.error('Error inserting new ping:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;
