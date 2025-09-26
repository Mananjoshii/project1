const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data", "sahakar.db");
const db = new Database(dbPath);

// Initialize tables if they don't exist
db.prepare(
  `CREATE TABLE IF NOT EXISTS sweets (
  SweetID TEXT PRIMARY KEY,
  Name TEXT,
  PricePerUnit REAL,
  Unit TEXT,
  Stock INTEGER,
  Active TEXT
)`
).run();

db.prepare(
  `CREATE TABLE IF NOT EXISTS bookings (
  BookingID TEXT PRIMARY KEY,
  CustomerName TEXT,
  CustomerPhone TEXT,
  AgentName TEXT,
  AgentPhone TEXT,
  SweetName TEXT,
  Quantity INTEGER,
  PricePerUnit REAL,
  TotalAmount REAL,
  Status TEXT
)`
).run();

module.exports = db;
