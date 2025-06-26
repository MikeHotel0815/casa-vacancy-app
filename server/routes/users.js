const express = require('express');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware'); // Middleware zum Schutz von Routen

const router = express.Router();

// ---- ROUTE: PUT /api/users/profile ----
// Dient der Aktualisierung des Profils des authentifizierten Benutzers (z.B. displayName)
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { displayName } = req.body;
    const userId = req.user.id; // Kommt vom authMiddleware

    if (!displayName || displayName.trim() === '') {
      return res.status(400).json({ msg: 'Anzeigename darf nicht leer sein.' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ msg: 'Benutzer nicht gefunden.' });
    }

    user.displayName = displayName;
    await user.save();

    // Sende das aktualisierte Benutzerobjekt zurück (ohne Passwort)
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      // Weitere Felder können hier bei Bedarf hinzugefügt werden
    });

  } catch (error) {
    console.error("Fehler beim Aktualisieren des Profils:", error);
    res.status(500).json({ error: error.message || 'Serverfehler beim Aktualisieren des Profils.' });
  }
});

module.exports = router;
