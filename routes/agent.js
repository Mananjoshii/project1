const express = require("express");
const router = express.Router();
const path = require("path");
const XLSX = require("xlsx");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
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
  const historyFile = path.join(__dirname, "../data/bookings_history.xlsx");
  let historyList = [];

  try {
    const workbook = XLSX.readFile(historyFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    historyList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    historyList = [];
  }

  const historyRow = {
    ...booking,
    Action: action,
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  };

  historyList.push(historyRow);

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(historyList);
  XLSX.utils.book_append_sheet(workbook, sheet, "History");
  XLSX.writeFile(workbook, historyFile);
}

// GET Agent Dashboard
router.get("/dashboard", isAgentLoggedIn, (req, res) => {
  const agentPhone = req.session.agentPhone;

  // Load sweets.xlsx
  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");
  const workbook = XLSX.readFile(sweetsFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sweetsList = XLSX.utils.sheet_to_json(sheet);

  // Load bookings.xlsx
  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
  let bookingsList = [];
  try {
    const bookingsWorkbook = XLSX.readFile(bookingsFile);
    const bookingsSheet =
      bookingsWorkbook.Sheets[bookingsWorkbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(bookingsSheet);
  } catch (err) {
    bookingsList = [];
  }

  // Map sweets to agent’s previous bookings
  const sweetsWithBooking = sweetsList.map((sweet) => {
    const bookedQty = bookingsList
      .filter(
        (b) =>
          b.AgentPhone === agentPhone &&
          b.SweetID === sweet.SweetID &&
          b.Status === "Active"
      )
      .reduce((sum, b) => sum + Number(b.Quantity), 0);

    return {
      ...sweet,
      bookedQty: bookedQty || 0,
    };
  });

  res.render("agent-dashboard", {
    agentName: req.session.agentName,
    agentPhone: req.session.agentPhone,
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

  if (!SweetID || Quantity === undefined) {
    return res.status(400).send("Invalid data");
  }

  const qty = Number(Quantity);
  if (isNaN(qty) || qty < 0) {
    return res.status(400).send("Quantity must be a number >= 0");
  }

  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
  let bookingsList = [];

  try {
    const workbook = XLSX.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    bookingsList = [];
  }

  // ✅ Declare existingBooking only once
  let existingBooking = bookingsList.find(
    (b) =>
      normalizePhone(b.CustomerPhone) === normCustomerPhone &&
      normalizeName(b.CustomerName) === normCustomerName &&
      b.SweetID === SweetID &&
      b.Status === "Active"
  );

  const now = new Date().toISOString();

  if (!existingBooking) {
    // Load sweet details if creating new booking
    const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");
    const workbook = XLSX.readFile(sweetsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sweetsList = XLSX.utils.sheet_to_json(sheet);
    const sweet = sweetsList.find((s) => s.SweetID === SweetID);
    if (!sweet) return res.status(404).send("Sweet not found");

    existingBooking = {
      BookingID: uuidv4(),
      AgentPhone: agentPhone,
      AgentName: agentName,
      CustomerPhone: customerPhone,
      CustomerName: customerName,
      SweetID: SweetID,
      SweetName: sweet.Name,
      Quantity: qty,
      PricePerUnit: sweet.PricePerUnit,
      TotalAmount: qty * Number(sweet.PricePerUnit),
      BookingDate: now,
      Status: "Active",
    };

    bookingsList.push(existingBooking);
    appendHistory(existingBooking, "Created", agentName);
  } else {
    // Update existing booking
    existingBooking.Quantity = qty;
    existingBooking.TotalAmount =
      qty * Number(existingBooking.PricePerUnit || 0);
    existingBooking.BookingDate = now;
    appendHistory(existingBooking, "Updated", agentName);
  }

  // Write back to Excel
  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(bookingsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Bookings");
  XLSX.writeFile(newWorkbook, bookingsFile);

  return res.status(200).json({ message: "Booking updated" });
});

// GET bookings quantity for agent
router.get("/bookings-qty", isAgentLoggedIn, (req, res) => {
  const agentNormName = normalizeName(req.session.agentName);
  const agentNormPhone = normalizePhone(req.session.agentPhone);

  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");
  const workbook = XLSX.readFile(sweetsFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const sweetsList = XLSX.utils.sheet_to_json(sheet);

  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
  let bookingsList = [];
  try {
    const wb = XLSX.readFile(bookingsFile);
    const sh = wb.Sheets[wb.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sh);
  } catch (err) {
    bookingsList = [];
  }

  const sweetsWithBooking = sweetsList.map((sweet) => {
    const bookedQty = bookingsList
      .filter(
        (b) =>
          normalizePhone(b.AgentPhone) === agentNormPhone &&
          normalizeName(b.AgentName) === agentNormName &&
          b.SweetID === sweet.SweetID &&
          b.Status === "Active"
      )
      .reduce((sum, b) => sum + Number(b.Quantity), 0);
    return { SweetID: sweet.SweetID, bookedQty };
  });

  res.json(sweetsWithBooking);
});

function getBookingsList() {
  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
  try {
    const wb = XLSX.readFile(bookingsFile);
    const sh = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sh);
  } catch (err) {
    return [];
  }
}

module.exports = router;
