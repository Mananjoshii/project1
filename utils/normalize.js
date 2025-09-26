// normalize.js
function normalizeName(name) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); // Remove non-digit characters
}

module.exports = { normalizeName, normalizePhone };