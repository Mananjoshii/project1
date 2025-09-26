const express = require("express");
const router = express.Router();
const path = require("path");
const XLSX = require("xlsx");
const bodyParser = require("body-parser");

const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");
const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");

// Admin password (for MVP, simple env var)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Middleware to check admin login
function isAdminLoggedIn(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.redirect("/admin/login");
  }
}

// --- Admin login page ---
router.get("/login", (req, res) => {
  res.render("admin-login", { error: null });
});

router.post("/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.render("admin-login", { error: "Incorrect password" });
  }
});

// --- Admin dashboard ---
router.get("/dashboard", isAdminLoggedIn, (req, res) => {
  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");
  let sweetsList = [];

  try {
    const workbook = XLSX.readFile(sweetsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sweetsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    sweetsList = [];
  }
  let bookingsList = [];
  try {
    const workbook = XLSX.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    bookingsList = [];
  }
  res.render("admin-dashboard", { sweets: sweetsList, bookings: bookingsList });
});

// --- Add new sweet ---
router.post("/sweets/add", isAdminLoggedIn, (req, res) => {
  const { SweetID, Name, PricePerUnit, Unit } = req.body;
  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");

  let sweetsList = [];
  try {
    const workbook = XLSX.readFile(sweetsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sweetsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    sweetsList = [];
  }

  sweetsList.push({
    SweetID,
    Name,
    PricePerUnit,
    Unit,
    Stock: 0,
    Active: "Y",
  });

  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(sweetsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sweets");
  XLSX.writeFile(newWorkbook, sweetsFile);

  res.redirect("/admin/dashboard");
});

// --- Download Excel ---
router.get("/download/:file", isAdminLoggedIn, (req, res) => {
  const fileMap = {
    sweets: "sweets.xlsx",
    bookings: "bookings.xlsx",
    customers: "customers.xlsx",
    agents: "agents.xlsx",
    history: "bookings_history.xlsx",
  };

  const filename = fileMap[req.params.file];
  if (!filename) return res.send("Invalid file");

  const filepath = path.join(__dirname, "../data", filename);
  res.download(filepath);
});

// --- Edit Sweet ---
router.post("/sweets/:id/edit", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const { Name, PricePerUnit, Unit, Stock, Active } = req.body;
  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");

  let sweetsList = [];
  try {
    const workbook = XLSX.readFile(sweetsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sweetsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    sweetsList = [];
  }

  const sweetIndex = sweetsList.findIndex((s) => s.SweetID === id);
  if (sweetIndex === -1) return res.send("Sweet not found");

  sweetsList[sweetIndex] = {
    ...sweetsList[sweetIndex],
    Name,
    PricePerUnit,
    Unit,
    Stock,
    Active,
  };

  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(sweetsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sweets");
  XLSX.writeFile(newWorkbook, sweetsFile);

  res.redirect("/admin/dashboard");
});

// --- Delete Sweet ---
router.post("/sweets/:id/delete", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const sweetsFile = path.join(__dirname, "../data/sweets.xlsx");

  let sweetsList = [];
  try {
    const workbook = XLSX.readFile(sweetsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    sweetsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    sweetsList = [];
  }

  sweetsList = sweetsList.filter((s) => s.SweetID !== id);

  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(sweetsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Sweets");
  XLSX.writeFile(newWorkbook, sweetsFile);

  res.redirect("/admin/dashboard");
});

// --- View Bookings ---
router.get("/bookings", isAdminLoggedIn, (req, res) => {
  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
  let bookingsList = [];

  try {
    const workbook = XLSX.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    bookingsList = [];
  }

  // Optional: filter query
  const { agentPhone, sweetName } = req.query;
  let filteredBookings = bookingsList;
  if (agentPhone)
    filteredBookings = filteredBookings.filter((b) =>
      b.AgentPhone.includes(agentPhone)
    );
  if (sweetName)
    filteredBookings = filteredBookings.filter((b) =>
      b.SweetName.toLowerCase().includes(sweetName.toLowerCase())
    );

  res.render("bookings-dashboard", {
    bookings: filteredBookings,
    agentPhone: agentPhone || "",
    sweetName: sweetName || "",
  });
});

// --- Update Booking Quantity ---
router.post("/bookings/:id/update", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const { Quantity, Status } = req.body;
  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");

  let bookingsList = [];
  try {
    const workbook = XLSX.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    bookingsList = [];
  }

  const bookingIndex = bookingsList.findIndex((b) => b.BookingID === id);
  if (bookingIndex === -1) return res.send("Booking not found");

  bookingsList[bookingIndex].Quantity = Number(Quantity);
  bookingsList[bookingIndex].Status = Status;
  bookingsList[bookingIndex].TotalAmount =
    Number(Quantity) * Number(bookingsList[bookingIndex].PricePerUnit);

  // Write back to Excel
  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(bookingsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Bookings");
  XLSX.writeFile(newWorkbook, bookingsFile);

  res.redirect("/admin/bookings");
});

// Update booking inline
router.post(
  "/api/bookings/update",
  isAdminLoggedIn,
  express.json(),
  (req, res) => {
    const { BookingID, field, value } = req.body;

    const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
    let bookingsList = [];

    try {
      const wb = XLSX.readFile(bookingsFile);
      const sh = wb.Sheets[wb.SheetNames[0]];
      bookingsList = XLSX.utils.sheet_to_json(sh);

      // find booking
      const booking = bookingsList.find((b) => b.BookingID == BookingID);
      if (!booking) {
        return res.status(404).json({ error: "Booking not found" });
      }

      // update field
      booking[field] = value;

      // recalc total if quantity changed
      if (field === "Quantity") {
        booking.TotalAmount =
          Number(booking.Quantity) * Number(booking.PricePerUnit);
      }

      // write back to Excel
      const ws = XLSX.utils.json_to_sheet(bookingsList);
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, ws, "Bookings");
      XLSX.writeFile(newWb, bookingsFile);

      res.json({ success: true, updated: booking });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update booking" });
    }
  }
);

// Update booking (inline edit → persist in Excel)
router.post("/update-booking/:id", (req, res) => {
  const bookingId = req.params.id;
  const { name, sweet, quantity } = req.body;

  try {
    // Load existing bookings.xlsx
    if (!fs.existsSync(bookingsFile)) {
      return res
        .status(500)
        .json({ success: false, message: "Bookings file not found" });
    }

    const workbook = xlsx.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Find the booking by ID
    const index = data.findIndex(
      (b) => String(b.BookingID) === String(bookingId)
    );
    if (index === -1) {
      return res.json({ success: false, message: "Booking not found" });
    }

    // Update fields
    data[index].Name = name;
    data[index].Sweet = sweet;
    data[index].Quantity = quantity;

    // Write back to Excel
    const newSheet = xlsx.utils.json_to_sheet(data);
    workbook.Sheets[workbook.SheetNames[0]] = newSheet;
    xlsx.writeFile(workbook, bookingsFile);

    res.json({ success: true });
  } catch (err) {
    console.error("Error updating booking:", err);
    res.status(500).json({ success: false, message: "Error updating booking" });
  }
});

// --- Delete Booking ---
// Delete booking by ID
router.post("/bookings/:id/delete", isAdminLoggedIn, (req, res) => {
  const { id } = req.params;
  const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");

  let bookingsList = [];
  try {
    const workbook = XLSX.readFile(bookingsFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    bookingsList = XLSX.utils.sheet_to_json(sheet);
  } catch (err) {
    bookingsList = [];
  }

  bookingsList = bookingsList.filter((b) => b.BookingID !== id);

  const newWorkbook = XLSX.utils.book_new();
  const newSheet = XLSX.utils.json_to_sheet(bookingsList);
  XLSX.utils.book_append_sheet(newWorkbook, newSheet, "Bookings");
  XLSX.writeFile(newWorkbook, bookingsFile);

  res.redirect("/admin/bookings");
});

router.post(
  "/api/bookings/update",
  isAdminLoggedIn,
  express.json(),
  (req, res) => {
    const { BookingID, field, value } = req.body;

    const bookingsFile = path.join(__dirname, "../data/bookings.xlsx");
    let bookingsList = [];

    try {
      const wb = XLSX.readFile(bookingsFile);
      const sh = wb.Sheets[wb.SheetNames[0]];
      bookingsList = XLSX.utils.sheet_to_json(sh);

      // find booking
      const booking = bookingsList.find((b) => b.BookingID == BookingID);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      // update field
      booking[field] = value;

      // recalc total if quantity changed
      if (field === "Quantity") {
        booking.TotalAmount =
          Number(booking.Quantity) * Number(booking.PricePerUnit);
      }

      // REMOVE rows where Quantity or TotalAmount is 0
      bookingsList = bookingsList.filter(
        (b) => Number(b.Quantity) !== 0 && Number(b.TotalAmount) !== 0
      );

      // write back to Excel
      const ws = XLSX.utils.json_to_sheet(bookingsList);
      const newWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWb, ws, "Bookings");
      XLSX.writeFile(newWb, bookingsFile);

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update booking" });
    }
  }
);

module.exports = router;
