const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const db = require("../db.js"); // SQLite connection
const { normalizeName, normalizePhone } = require("../utils/normalize");

// Middleware to check if agent is logged in
function isAgentLoggedIn(req, res, next) {
  if (req.session.agentName && req.session.agentPhone) {
    next();
  } else {
    res.redirect("/");
  }
}

// Helper: append history
function appendHistory(booking, action, actionBy) {
  db.prepare(
    `INSERT INTO bookings_history 
    (BookingID, AgentPhone, AgentName, CustomerPhone, CustomerName, SweetID, SweetName, Quantity, PricePerUnit, TotalAmount, BookingDate, Status, Action, ActionBy, ActionDate) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    booking.BookingID,
    booking.AgentPhone,
    booking.AgentName,
    booking.CustomerPhone,
    booking.CustomerName,
    booking.SweetID,
    booking.SweetName,
    booking.Quantity,
    booking.PricePerUnit,
    booking.TotalAmount,
    booking.BookingDate,
    booking.Status,
    action,
    actionBy,
    new Date().toISOString()
  );
}

// GET Agent Dashboard
router.get("/dashboard", isAgentLoggedIn, (req, res) => {
  const agentPhone = req.session.agentPhone;
  const agentName = req.session.agentName;

  const sweetsList = db.prepare(`SELECT * FROM sweets WHERE Active='Y'`).all();
  const bookingsList = db
    .prepare(`SELECT * FROM bookings WHERE AgentPhone=? AND Status='Active'`)
    .all(agentPhone);

  const sweetsWithBooking = sweetsList.map((sweet) => {
    const bookedQty = bookingsList
      .filter((b) => b.SweetID === sweet.SweetID)
      .reduce((sum, b) => sum + Number(b.Quantity), 0);
    return { ...sweet, bookedQty };
  });
  console.log("Sweets with booking:", sweetsWithBooking);
  res.render("agent-dashboard", {
    agentName,
    agentPhone,
    sweets: sweetsWithBooking,
  });
});

// POST /agent/book → create/update booking
router.post("/book", isAgentLoggedIn, express.json(), (req, res) => {
  const agentName = req.session.agentName;
  const agentPhone = req.session.agentPhone;
  const { SweetID, Quantity, CustomerName, CustomerPhone } = req.body;

  const customerName = CustomerName || agentName;
  const customerPhone = CustomerPhone || agentPhone;

  const normCustomerName = normalizeName(customerName);
  const normCustomerPhone = normalizePhone(customerPhone);

  const qty = Number(Quantity);
  if (!SweetID || isNaN(qty) || qty < 0)
    return res.status(400).send("Invalid data");

  // Check existing booking
  let existingBooking = db
    .prepare(
      `SELECT * FROM bookings WHERE CustomerPhone=? AND CustomerName=? AND SweetID=? AND Status='Active'`
    )
    .get(normCustomerPhone, normCustomerName, SweetID);

  const sweet = db.prepare(`SELECT * FROM sweets WHERE SweetID=?`).get(SweetID);
  if (!sweet) return res.status(404).send("Sweet not found");

  const now = new Date().toISOString();

  if (!existingBooking) {
    const newBooking = {
      BookingID: uuidv4(),
      AgentPhone: agentPhone,
      AgentName: agentName,
      CustomerPhone: customerPhone,
      CustomerName: customerName,
      SweetID,
      SweetName: sweet.Name,
      Quantity: qty,
      PricePerUnit: sweet.PricePerUnit,
      TotalAmount: qty * Number(sweet.PricePerUnit),
      BookingDate: now,
      Status: "Active",
    };

    db.prepare(
      `INSERT INTO bookings 
      (BookingID, AgentPhone, AgentName, CustomerPhone, CustomerName, SweetID, SweetName, Quantity, PricePerUnit, TotalAmount, BookingDate, Status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      newBooking.BookingID,
      newBooking.AgentPhone,
      newBooking.AgentName,
      newBooking.CustomerPhone,
      newBooking.CustomerName,
      newBooking.SweetID,
      newBooking.SweetName,
      newBooking.Quantity,
      newBooking.PricePerUnit,
      newBooking.TotalAmount,
      newBooking.BookingDate,
      newBooking.Status
    );

    appendHistory(newBooking, "Created", agentName);
  } else {
    const total = qty * Number(existingBooking.PricePerUnit);
    if (qty === 0 || total === 0) {
      db.prepare(`DELETE FROM bookings WHERE BookingID=?`).run(
        existingBooking.BookingID
      );
      appendHistory(existingBooking, "Deleted", agentName);
    } else {
      db.prepare(
        `UPDATE bookings SET Quantity=?, TotalAmount=?, BookingDate=? WHERE BookingID=?`
      ).run(qty, total, now, existingBooking.BookingID);
      appendHistory(
        { ...existingBooking, Quantity: qty, TotalAmount: total },
        "Updated",
        agentName
      );
    }
  }

  return res.status(200).json({ message: "Booking updated" });
});

// GET bookings quantity for agent (polling)
router.get("/bookings-qty", isAgentLoggedIn, (req, res) => {
  const agentPhone = req.session.agentPhone;
  const agentName = req.session.agentName;

  const sweetsList = db.prepare(`SELECT * FROM sweets`).all();
  const bookingsList = db
    .prepare(`SELECT * FROM bookings WHERE AgentPhone=? AND Status='Active'`)
    .all(agentPhone);

  const sweetsWithBooking = sweetsList.map((sweet) => {
    const bookedQty = bookingsList
      .filter((b) => b.SweetID === sweet.SweetID)
      .reduce((sum, b) => sum + Number(b.Quantity), 0);
    return { SweetID: sweet.SweetID, bookedQty };
  });

  res.json(sweetsWithBooking);
});

module.exports = router;
