// Importiert die notwendigen Pakete und Modelle
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Unser User-Modell

const router = express.Router();

// ---- ROUTE: POST /api/auth/register ----
// Dient der Registrierung eines neuen Benutzers.
router.post('/register', async (req, res) => {
  try {
    const { displayName, email, password } = req.body;

    // 1. Überprüfen, ob alle Felder ausgefüllt sind
    if (!displayName || !email || !password) {
      return res.status(400).json({ msg: 'Bitte füllen Sie alle Felder aus.' });
    }

    // 2. Überprüfen, ob der Benutzer bereits existiert
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ msg: 'Ein Benutzer mit dieser E-Mail existiert bereits.' });
    }

    // 3. Passwort hashen
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Neuen Benutzer in der Datenbank erstellen
    const newUser = await User.create({
      displayName,
      email,
      password: hashedPassword,
    });

    res.status(201).json({ msg: 'Benutzer erfolgreich registriert.', userId: newUser.id });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ---- ROUTE: POST /api/auth/login ----
// Dient dem Einloggen eines bestehenden Benutzers.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Überprüfen, ob alle Felder ausgefüllt sind
    if (!email || !password) {
      return res.status(400).json({ msg: 'Bitte füllen Sie alle Felder aus.' });
    }

    // 2. Benutzer in der Datenbank suchen
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ msg: 'Ungültige Anmeldedaten.' });
    }

    // 3. Passwörter vergleichen
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Ungültige Anmeldedaten.' });
    }

    // KORREKTUR: Fallback für den Anzeigenamen hinzufügen, falls er bei alten Benutzern fehlt.
    const displayName = user.displayName || user.email;

    // 4. JSON Web Token (JWT) erstellen
    const payload = {
      id: user.id,
      email: user.email,
      displayName: displayName, // Den (möglicherweise Fallback-)Namen verwenden
    };
    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, displayName: displayName } // Anzeigename auch hier hinzufügen
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
