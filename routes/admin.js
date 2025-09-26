const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const db = require("../db"); // SQLite DB connection
const bodyParser = require("body-parser");

// Admin password (MVP)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Middleware to check admin login
function isAdminLoggedIn(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.redirect("/");
  }
}

// --- Admin login page ---
router.get("/login", (req, res) => {
  res.render("agent-login", { error: null });
});

router.post("/agent-login", (req, res) => {
  const { agentPhone } = req.body;
  if (agentPhone === "7014787403") {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.render("agent-login", { error: "Incorrect password" });
  }
});

// --- Admin dashboard ---
router.get("/dashboard", isAdminLoggedIn, (req, res) => {
  const sweets = db.prepare(`SELECT * FROM sweets`).all();
  const bookings = db.prepare(`SELECT * FROM bookings`).all();
  res.render("admin-dashboard", { sweets, bookings });
});

// --- Add new sweet ---
router.post("/sweets/add", isAdminLoggedIn, (req, res) => {
  const { SweetID, Name, PricePerUnit, Unit } = req.body;
  db.prepare(
    `INSERT INTO sweets (SweetID, Name, PricePerUnit, Unit, Stock, Active) VALUES (?, ?, ?, ?, 0, 'Y')`
  ).run(SweetID, Name, PricePerUnit, Unit);
  res.redirect("/admin/dashboard");
});

// --- Edit sweet ---
router.post("/sweets/:id/edit", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const { Name, PricePerUnit, Unit, Stock, Active } = req.body;

  db.prepare(
    `UPDATE sweets SET Name=?, PricePerUnit=?, Unit=?, Stock=?, Active=? WHERE SweetID=?`
  ).run(Name, PricePerUnit, Unit, Stock, Active, id);

  res.redirect("/admin/dashboard");
});

// --- Delete sweet ---
router.post("/sweets/:id/delete", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM sweets WHERE SweetID=?`).run(id);
  res.redirect("/admin/dashboard");
});

// --- View bookings ---
router.get("/bookings", isAdminLoggedIn, (req, res) => {
  const { agentPhone, sweetName } = req.query;
  let bookings = db.prepare(`SELECT * FROM bookings`).all();

  if (agentPhone)
    bookings = bookings.filter((b) => b.AgentPhone.includes(agentPhone));
  if (sweetName)
    bookings = bookings.filter((b) =>
      b.SweetName.toLowerCase().includes(sweetName.toLowerCase())
    );

  res.render("bookings-dashboard", {
    bookings,
    agentPhone: agentPhone || "",
    sweetName: sweetName || "",
  });
});

// --- Update booking (form submit) ---
router.post("/bookings/:id/update", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const { Quantity, Status } = req.body;

  const booking = db
    .prepare(`SELECT * FROM bookings WHERE BookingID=?`)
    .get(id);
  if (!booking) return res.send("Booking not found");

  const qty = Number(Quantity);
  const total = qty * booking.PricePerUnit;

  if (qty === 0 || total === 0) {
    db.prepare(`DELETE FROM bookings WHERE BookingID=?`).run(id);
  } else {
    db.prepare(
      `UPDATE bookings SET Quantity=?, TotalAmount=?, Status=? WHERE BookingID=?`
    ).run(qty, total, Status, id);
  }

  res.redirect("/admin/bookings");
});

// --- Delete booking ---
router.post("/bookings/:id/delete", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  db.prepare(`DELETE FROM bookings WHERE BookingID=?`).run(id);
  res.redirect("/admin/bookings");
});

// --- Inline update booking API ---
router.post(
  "/api/bookings/update",
  isAdminLoggedIn,
  express.json(),
  (req, res) => {
    const { BookingID, field, value } = req.body;
    const booking = db
      .prepare(`SELECT * FROM bookings WHERE BookingID=?`)
      .get(BookingID);

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const updates = {};
    updates[field] = value;

    if (field === "Quantity") {
      const qty = Number(value);
      const total = qty * booking.PricePerUnit;

      if (qty === 0 || total === 0) {
        db.prepare(`DELETE FROM bookings WHERE BookingID=?`).run(BookingID);
        return res.json({ success: true, removed: true });
      } else {
        updates.TotalAmount = total;
      }
    }

    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setStr = keys.map((k) => `${k}=?`).join(",");
    db.prepare(`UPDATE bookings SET ${setStr} WHERE BookingID=?`).run(
      ...values,
      BookingID
    );

    const updated = db
      .prepare(`SELECT * FROM bookings WHERE BookingID=?`)
      .get(BookingID);
    res.json({ success: true, updated });
  }
);

// --- Download Excel (from SQLite data) ---
router.get("/download/:file", isAdminLoggedIn, (req, res) => {
  const XLSX = require("xlsx");
  const fileMap = {
    sweets: "sweets.xlsx",
    bookings: "bookings.xlsx",
    customers: "customers.xlsx",
    agents: "agents.xlsx",
    history: "bookings_history.xlsx",
  };
  const filename = fileMap[req.params.file];
  if (!filename) return res.send("Invalid file");

  let data = [];
  if (req.params.file === "sweets")
    data = db.prepare("SELECT * FROM sweets").all();
  else if (req.params.file === "bookings")
    data = db.prepare("SELECT * FROM bookings").all();

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, filename.split(".")[0]);

  const filePath = path.join(__dirname, "../data", filename);
  XLSX.writeFile(wb, filePath);
  res.download(filePath);
});

module.exports = router;
