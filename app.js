const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

console.log("Starting app...");
// --- Middleware ---
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Session setup
app.use(
  session({
    secret: "your_secret_key_here",
    resave: false,
    saveUninitialized: true,
  })
);

// --- Routes ---
console.log("Requiring routes...");
const indexRoutes = require("./routes/index");
const agentRoutes = require("./routes/agent");
const adminRoutes = require("./routes/admin");

app.use("/", indexRoutes);
app.use("/agent", agentRoutes);
app.use("/admin", adminRoutes);

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
