// Importiert die notwendigen Pakete und Modelle
const express = require('express');
const User = require('../models/User');
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware');

const router = express.Router();

// ---- ROUTE: GET /api/users ----
// Ruft alle Benutzer ab (nur für Admins).
// Wird verwendet, damit ein Admin einen Benutzer auswählen kann, für den er ein Event erstellt.
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'displayName', 'email'], // Nur relevante Infos senden
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
