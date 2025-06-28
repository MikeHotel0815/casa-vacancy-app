const express = require('express');
const router = express.Router();
const Meter = require('../models/Meter');
const MeterReading = require('../models/MeterReading');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// --- Helper Middleware für Admin Check ---
// Diese Middleware bleibt im Prinzip gleich, da sie User.findByPk verwendet, was Sequelize ist.
const adminOnly = async (req, res, next) => {
  try {
    let user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ msg: 'Authentifizierung erforderlich.' });
    }
    if (user.isAdmin === true) { // Direkt aus dem Token, wenn authMiddleware es setzt
        return next();
    }
    // Fallback: User-Objekt aus DB laden
    const userFromDb = await User.findByPk(user.id);
    if (userFromDb && userFromDb.isAdmin) {
      req.user.isAdmin = true;
      return next();
    }
    return res.status(403).json({ msg: 'Zugriff verweigert. Nur für Administratoren.' });
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ msg: 'Fehler bei der Berechtigungsprüfung.' });
  }
};

// === Zähler (Meters) Routen ===

// POST /api/meters - Neuen Zähler erstellen (Admin only)
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, unit } = req.body;
    // Validierung durch das Modell (allowNull: false, validate)
    const newMeter = await Meter.create({
      name,
      unit,
      userId: req.user.id, // Fremdschlüssel für den Ersteller
    });
    // Um den Ersteller direkt mitzusenden (optional, wenn das Frontend es braucht)
    const meterWithCreator = await Meter.findByPk(newMeter.id, {
        include: [{ model: User, as: 'createdBy', attributes: ['id', 'displayName', 'email'] }]
    });
    res.status(201).json(meterWithCreator);
  } catch (error) {
    console.error('Error creating meter:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Zählers.' });
  }
});

// GET /api/meters - Alle Zähler abrufen (Admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meters = await Meter.findAll({
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'displayName', 'email'] }],
      order: [['name', 'ASC']]
    });
    res.json(meters);
  } catch (error) {
    console.error('Error fetching meters:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Zähler.' });
  }
});

// GET /api/meters/:id - Einen spezifischen Zähler abrufen (Admin only)
router.get('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id, {
      include: [{ model: User, as: 'createdBy', attributes: ['id', 'displayName', 'email'] }]
    });
    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }
    res.json(meter);
  } catch (error) {
    console.error('Error fetching meter:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Zählers.' });
  }
});

// PUT /api/meters/:id - Einen Zähler aktualisieren (Admin only)
router.put('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, unit } = req.body;
    const meter = await Meter.findByPk(req.params.id);

    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    meter.name = name || meter.name;
    meter.unit = unit || meter.unit;
    // userId (createdBy) sollte hier nicht geändert werden.

    await meter.save();
    const updatedMeterWithCreator = await Meter.findByPk(meter.id, {
        include: [{ model: User, as: 'createdBy', attributes: ['id', 'displayName', 'email'] }]
    });
    res.json(updatedMeterWithCreator);
  } catch (error) {
    console.error('Error updating meter:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Zählers.' });
  }
});

// DELETE /api/meters/:id - Einen Zähler löschen (Admin only)
// onDelete: 'CASCADE' in MeterReading (bezogen auf Meter) sollte Zählerstände automatisch löschen.
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meter = await Meter.findByPk(req.params.id);
    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }
    await meter.destroy(); // Dies löst onDelete: CASCADE für MeterReadings aus
    res.json({ msg: 'Zähler und zugehörige Zählerstände erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Error deleting meter:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Zählers.' });
  }
});


// === Zählerstände (MeterReadings) Routen ===

// POST /api/meters/:meterId/readings - Neuen Zählerstand erfassen (Admin only)
router.post('/:meterId/readings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { value, date, photoUrl, notes } = req.body;
    const meterIdParam = req.params.meterId;

    // Validierung der Eingaben (teilweise vom Modell abgedeckt)
    if (value === undefined || value === null || !date) {
      return res.status(400).json({ msg: 'Zählerstand (value) und Datum sind erforderlich.' });
    }

    const meterExists = await Meter.findByPk(meterIdParam);
    if (!meterExists) {
      return res.status(404).json({ msg: 'Zugehöriger Zähler nicht gefunden.' });
    }

    const newReading = await MeterReading.create({
      meterId: meterIdParam, // Fremdschlüssel
      value,
      date, // Sequelize DATEONLY akzeptiert 'YYYY-MM-DD'
      photoUrl: photoUrl || null, // Leeren String in null umwandeln
      notes,
      recordedByUserId: req.user.id, // Fremdschlüssel für den Erfasser
    });

    // Den neu erstellten Zählerstand mit zugehörigen Daten zurückgeben
    const readingWithDetails = await MeterReading.findByPk(newReading.id, {
        include: [
            { model: User, as: 'recordedBy', attributes: ['id', 'displayName', 'email'] },
            { model: Meter, as: 'meter', attributes: ['id', 'name', 'unit'] } // Geändert zu 'meter' gemäß Alias
        ]
    });

    res.status(201).json(readingWithDetails);
  } catch (error) {
    console.error('Error creating meter reading:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: 'Serverfehler beim Erfassen des Zählerstands.' });
  }
});

// GET /api/meters/:meterId/readings - Alle Zählerstände für einen Zähler abrufen (Admin only)
router.get('/:meterId/readings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meterIdParam = req.params.meterId;
    const meterExists = await Meter.findByPk(meterIdParam);
    if (!meterExists) {
      // Wichtig: Nicht 404 senden, wenn der Zähler existiert, aber keine Readings hat.
      // Sende leeres Array, wenn Zähler existiert, aber keine Readings.
      // Dieser Check ist eher, ob der Zähler selbst existiert.
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    const readings = await MeterReading.findAll({
      where: { meterId: meterIdParam },
      include: [
        { model: User, as: 'recordedBy', attributes: ['id', 'displayName', 'email'] },
        // { model: Meter, as: 'meter', attributes: ['id', 'name', 'unit'] } // Meter-Details sind hier nicht unbedingt nötig, da nach meterId gefiltert wird
      ],
      order: [['date', 'DESC']],
    });
    res.json(readings);
  } catch (error) {
    console.error('Error fetching meter readings:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Zählerstände.' });
  }
});

// GET /api/meters/reading/:readingId - Einen spezifischen Zählerstand abrufen (Admin only)
router.get('/reading/:readingId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reading = await MeterReading.findByPk(req.params.readingId, {
      include: [
        { model: User, as: 'recordedBy', attributes: ['id', 'displayName', 'email'] },
        { model: Meter, as: 'meter', attributes: ['id', 'name', 'unit'] }
      ]
    });
    if (!reading) {
      return res.status(404).json({ msg: 'Zählerstand nicht gefunden.' });
    }
    res.json(reading);
  } catch (error) {
    console.error('Error fetching meter reading:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen des Zählerstands.' });
  }
});


// PUT /api/meters/reading/:readingId - Einen Zählerstand aktualisieren (Admin only)
router.put('/reading/:readingId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { value, date, photoUrl, notes } = req.body;
    const reading = await MeterReading.findByPk(req.params.readingId);

    if (!reading) {
      return res.status(404).json({ msg: 'Zählerstand nicht gefunden.' });
    }

    // Nur der Admin, der es erstellt hat, oder ein "Super-Admin" darf bearbeiten?
    // Aktuell: Jeder Admin darf jeden Zählerstand bearbeiten.
    // if (reading.recordedByUserId !== req.user.id && !req.user.isSuperAdmin) { // Annahme: isSuperAdmin existiert
    //   return res.status(403).json({ msg: 'Keine Berechtigung diesen Zählerstand zu ändern.' });
    // }

    if (value !== undefined) reading.value = value;
    if (date) reading.date = date; // Muss 'YYYY-MM-DD' sein
    // Für photoUrl und notes: explizit null erlauben, um sie zu löschen
    if (photoUrl !== undefined) reading.photoUrl = photoUrl === '' ? null : photoUrl;
    if (notes !== undefined) reading.notes = notes === '' ? null : notes;
    // meterId und recordedByUserId sollten hier nicht geändert werden.

    await reading.save();
    const updatedReadingWithDetails = await MeterReading.findByPk(reading.id, {
        include: [
            { model: User, as: 'recordedBy', attributes: ['id', 'displayName', 'email'] },
            { model: Meter, as: 'meter', attributes: ['id', 'name', 'unit'] }
        ]
    });
    res.json(updatedReadingWithDetails);
  } catch (error) {
    console.error('Error updating meter reading:', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Zählerstands.' });
  }
});

// DELETE /api/meters/reading/:readingId - Einen Zählerstand löschen (Admin only)
router.delete('/reading/:readingId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reading = await MeterReading.findByPk(req.params.readingId);
    if (!reading) {
      return res.status(404).json({ msg: 'Zählerstand nicht gefunden.' });
    }
    await reading.destroy();
    res.json({ msg: 'Zählerstand erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Error deleting meter reading:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Zählerstands.' });
  }
});

module.exports = router;
