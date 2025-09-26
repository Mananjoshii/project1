// seed.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Path to database
const dbPath = path.join(dataDir, "sahakar.db");

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) return console.error("DB connection error:", err);
  console.log("Connected to SQLite database at", dbPath);
});

// Wrap everything in serialize to run sequentially
db.serialize(() => {
  // 1️⃣ Create sweets table
  db.run(`
    CREATE TABLE IF NOT EXISTS sweets (
      SweetID TEXT PRIMARY KEY,
      Name TEXT NOT NULL,
      PricePerUnit REAL NOT NULL,
      Unit TEXT NOT NULL,
      Stock INTEGER DEFAULT 0,
      Active TEXT DEFAULT 'Y'
    )
  `);

  // 2️⃣ Create bookings table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      BookingID TEXT PRIMARY KEY,
      AgentName TEXT,
      AgentPhone TEXT,
      CustomerName TEXT,
      CustomerPhone TEXT,
      SweetID TEXT,
      SweetName TEXT,
      Quantity INTEGER,
      PricePerUnit REAL,
      TotalAmount REAL,
      BookingDate TEXT,
      Status TEXT DEFAULT 'Active',
      FOREIGN KEY (SweetID) REFERENCES sweets(SweetID)
    )
  `);

  // 3️⃣ Create bookings_history table
  db.run(`
    CREATE TABLE IF NOT EXISTS bookings_history (
      HistoryID INTEGER PRIMARY KEY AUTOINCREMENT,
      BookingID TEXT,
      AgentName TEXT,
      AgentPhone TEXT,
      CustomerName TEXT,
      CustomerPhone TEXT,
      SweetID TEXT,
      SweetName TEXT,
      Quantity INTEGER,
      PricePerUnit REAL,
      TotalAmount REAL,
      BookingDate TEXT,
      Status TEXT,
      Action TEXT,
      ActionBy TEXT,
      ActionDate TEXT,
      FOREIGN KEY (SweetID) REFERENCES sweets(SweetID)
    )
  `);

  // 4️⃣ Insert sample sweets
  const sampleSweets = [
    {
      SweetID: "s1",
      Name: "Gulab Jamun",
      PricePerUnit: 50,
      Unit: "pcs",
      Stock: 100,
      Active: "Y",
    },
    {
      SweetID: "s2",
      Name: "Rasgulla",
      PricePerUnit: 40,
      Unit: "pcs",
      Stock: 100,
      Active: "Y",
    },
    {
      SweetID: "s3",
      Name: "Kaju Katli",
      PricePerUnit: 200,
      Unit: "kg",
      Stock: 50,
      Active: "Y",
    },
  ];

  const stmt = db.prepare(
    "INSERT OR IGNORE INTO sweets (SweetID, Name, PricePerUnit, Unit, Stock, Active) VALUES (?, ?, ?, ?, ?, ?)"
  );

  sampleSweets.forEach((s) => {
    stmt.run(s.SweetID, s.Name, s.PricePerUnit, s.Unit, s.Stock, s.Active);
  });

  stmt.finalize();

  console.log("Database seeded with sample sweets.");
});

// Close the database
db.close((err) => {
  if (err) console.error(err.message);
  else console.log("Database connection closed.");
});
