const express = require("express");
const router = express.Router();

// GET home page (agent login)
router.get("/", (req, res) => {
  res.render("index", { error: null });
});

// POST agent login
router.post("/agent-login", (req, res) => {
  const { agentName, agentPhone } = req.body;

  if (!agentName || !agentPhone) {
    return res.render("index", {
      error: "Please enter both name and phone number.",
    });
  }

  // Save agent info in session
  req.session.agentName = agentName;
  req.session.agentPhone = agentPhone;

  // Redirect to agent dashboard
  res.redirect("/agent/dashboard");
});

module.exports = router;
