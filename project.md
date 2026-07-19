# Police & Vehicle Location Tracking API

An Express.js Web API built to track police vehicles, stations, districts, and provinces dynamically using MongoDB Atlas and Node.js (ES Modules).

---

## 1. Getting Started

### Local Setup
1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   MONGODB_URI="your_mongodb_atlas_connection_string"
   PORT=3000
   ```
3. **Run the server**:
   ```bash
   npm run dev
   ```

### Seeding the Database
If you need to seed or re-seed your database using `seed.json`:
```bash
node seed-db.js
```
*(Note: `seed-db.js` is ignored by Git to prevent connection credentials leaks).*

---

## 2. Authentication & Security

### GET Endpoints
All GET endpoints are secured with **Basic Access Authentication**:
* **Realm**: `Police API`
* **Username**: `police`
* **Password**: `nibm2024`

Provide these in the `Authorization` header (`Authorization: Basic cG9saWNlOm5pYm0yMDI0`).

### POST Endpoint
The POST ping creation route is secured using **API Keys**:
* **Header Required**: `X-API-Key`
* **Matching**: Dynamic device keys are loaded from MongoDB at startup:
  * Key format: `key_v<padded_id>` (e.g. `key_v01` for vehicle `1`, `key_v20` for vehicle `20`).

---

## 3. API Reference

All requests must use JSON format. Member lookups accept either a numeric `id` or a registration string (e.g., `HB-6168`).

### Provinces
* **`GET /provinces`**: Returns a list of all provinces.
  * Response: `[{ province_id, name }]`
* **`GET /provinces/:id`**: Returns a specific province.
  * Response: `{ province_id, name }`
  * Error: `404` if not found.

### Districts
* **`GET /districts`**: Returns a list of all districts.
  * Response: `[{ district_id, name, province_id }]`
* **`GET /districts/:id`**: Returns a specific district.
  * Response: `{ district_id, name, province_id }`
  * Error: `404` if not found.

### Stations
* **`GET /stations`**: Returns a list of all police stations.
  * Response: `[{ station_id, name, district_id }]`
* **`GET /stations/:id`**: Returns a specific police station.
  * Response: `{ station_id, name, district_id }`
  * Error: `404` if not found.

### Vehicles
* **`GET /vehicles`**: Returns a list of all vehicles.
  * Response: `[{ vehicle_id, reg_number, device_id, station_id }]`
* **`POST /vehicles`**: Registers a new vehicle in the system.
  * Authentication: Basic Auth (Administrative)
  * Body parameters: `register_number`, `device_id`, `station_id`
  * Response: `201 Created`
  * Response Headers:
    * `Location`: `/vehicles/:id`
  * Response Body: `{ vehicle_id, reg_number, device_id, station_id }`
* **`GET /vehicles/:id`**: Returns a specific vehicle along with its most recent position (`last_ping`).
  * Response: `{ vehicle_id, reg_number, device_id, station_id, last_ping: { ping_id, vehicle_id, timestamp, lat, lng, speed } }`
  * Error: `404` if not found.
* **`GET /vehicles/:id/pings`**: Returns all pings recorded for a specific vehicle.
  * Response: `[{ ping_id, vehicle_id, timestamp, lat, lng, speed }]`
  * Error: `404` if vehicle is not found. Returns `[]` if vehicle has no pings.
* **`GET /vehicles/:id/last-position`**: Returns only the most recent coordinates and timestamp of the vehicle.
  * Response: `{ vehicle_id, timestamp, lat, lng, speed }`
  * Error: `404` if vehicle not found or has no pings.

### Ping Creation
* **`POST /vehicles/:vehicleId/pings`**: Creates a new ping record.
  * Required Headers: `X-API-Key`
  * Body parameters: `latitude`, `longitude`, `speed`
  * Response: `201 Created`
  * Response Headers:
    * `Location`: `/vehicles/:vehicleId/pings/:pingId`
    * `ETag` & `Last-Modified`
  * Response Body: `{ ping_id, vehicle_id, timestamp, lat, lng, speed }`

---

## 4. Deployment on Vercel

Ensure the `MONGODB_URI` environment variable is configured in the Vercel Dashboard (Settings > Environment Variables) before deploying. The server automatically routes requests serverlessly via [vercel.json](file:///Users/chethanarowell/Documents/NIBM/WebAPIDev-Test/vercel.json).
