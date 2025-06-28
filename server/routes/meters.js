const express = require('express');
const router = express.Router();
const Meter = require('../models/Meter');
const MeterReading = require('../models/MeterReading');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User'); // Wird für createdBy/recordedBy benötigt

// --- Helper Middleware für Admin Check ---
const adminOnly = async (req, res, next) => {
  // Annahme: authMiddleware fügt das User-Objekt zu req.user hinzu
  // und User-Objekt hat ein isAdmin Feld (Boolean).
  // Die User.findById Logik hier ist nur ein Fallback, falls req.user nicht vollständig ist.
  // Normalerweise sollte authMiddleware das korrekte User-Objekt mit isAdmin bereitstellen.
  try {
    let user = req.user;
    // Wichtig: Sicherstellen, dass req.user und req.user.id existieren, bevor DB-Aufruf erfolgt
    if (!user || !user.id) {
        // Wenn authMiddleware keinen User setzt oder keine ID hat, ist das ein Fehler.
        // Oder es ist eine Route, die keinen User erfordert, aber dann sollte adminOnly nicht verwendet werden.
        return res.status(401).json({ msg: 'Authentifizierung erforderlich.' });
    }

    if (user && typeof user.isAdmin !== 'undefined') {
      if (user.isAdmin) {
        return next();
      }
    }

    // Fallback: User-Objekt aus DB laden, falls isAdmin nicht in req.user ist.
    // Dies ist Mongoose-Syntax, da User.js ein Mongoose-Modell ist.
    // Das Projekt scheint Sequelize UND Mongoose zu mischen. User-Modell ist Sequelize.
    // Das User-Modell wurde in /models/User.js als Sequelize-Modell definiert.
    // Daher muss hier User.findByPk (Sequelize) anstelle von User.findById (Mongoose) verwendet werden.
    const userFromDb = await User.findByPk(user.id); // Korrigiert für Sequelize
    if (userFromDb && userFromDb.isAdmin) {
      req.user.isAdmin = true; // Optional: req.user für nachfolgende Checks anreichern
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
    if (!name || !unit) {
      return res.status(400).json({ msg: 'Name und Einheit sind erforderlich.' });
    }

    const newMeter = new Meter({
      name,
      unit,
      createdBy: req.user.id, // Mongoose erwartet hier die ObjectId
    });

    await newMeter.save();
    res.status(201).json(newMeter);
  } catch (error) {
    console.error('Error creating meter:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors });
    }
    res.status(500).json({ error: 'Serverfehler beim Erstellen des Zählers.' });
  }
});

// GET /api/meters - Alle Zähler abrufen (Admin only)
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    // populate für Mongoose, um User-Details zu laden
    const meters = await Meter.find().populate({
        path: 'createdBy',
        select: 'displayName email', // Sequelize User-Modell hat diese Felder
        model: 'User' // Explizit das Modell angeben, da es gemischt ist
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
    const meter = await Meter.findById(req.params.id).populate({
        path: 'createdBy',
        select: 'displayName email',
        model: 'User'
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
    // updatedAt wird durch Mongoose Middleware aktualisiert
    const updatedMeter = await Meter.findByIdAndUpdate(
      req.params.id,
      { name, unit, updatedAt: Date.now() },
      { new: true, runValidators: true } // new: true gibt das aktualisierte Dokument zurück
    ).populate({
        path: 'createdBy',
        select: 'displayName email',
        model: 'User'
    });

    if (!updatedMeter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }
    res.json(updatedMeter);
  } catch (error) {
    console.error('Error updating meter:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors });
    }
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Zählers.' });
  }
});

// DELETE /api/meters/:id - Einen Zähler löschen (Admin only)
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meter = await Meter.findById(req.params.id);
    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    // Lösche zuerst alle zugehörigen Zählerstände
    await MeterReading.deleteMany({ meter: req.params.id });
    // Dann den Zähler selbst löschen
    await Meter.findByIdAndDelete(req.params.id);

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
    const meterId = req.params.meterId;

    if (value === undefined || value === null || !date) {
      return res.status(400).json({ msg: 'Zählerstand (value) und Datum sind erforderlich.' });
    }

    const meterExists = await Meter.findById(meterId);
    if (!meterExists) {
      return res.status(404).json({ msg: 'Zugehöriger Zähler nicht gefunden.' });
    }

    const newReading = new MeterReading({
      meter: meterId,
      value,
      date: new Date(date), // Stelle sicher, dass es als Datum gespeichert wird
      photoUrl,
      notes,
      recordedBy: req.user.id,
    });

    await newReading.save();
    // Populate nach dem Speichern, um die referenzierten Daten zurückzugeben
    const populatedReading = await MeterReading.findById(newReading._id)
        .populate({ path: 'meter', select: 'name unit' })
        .populate({ path: 'recordedBy', select: 'displayName email', model: 'User' });

    res.status(201).json(populatedReading);
  } catch (error) {
    console.error('Error creating meter reading:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors });
    }
    res.status(500).json({ error: 'Serverfehler beim Erfassen des Zählerstands.' });
  }
});

// GET /api/meters/:meterId/readings - Alle Zählerstände für einen Zähler abrufen (Admin only)
router.get('/:meterId/readings', authMiddleware, adminOnly, async (req, res) => {
  try {
    const meterId = req.params.meterId;
    const meterExists = await Meter.findById(meterId);
    if (!meterExists) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    const readings = await MeterReading.find({ meter: meterId })
      .populate({ path: 'meter', select: 'name unit' })
      .populate({ path: 'recordedBy', select: 'displayName email', model: 'User' })
      .sort({ date: -1 });
    res.json(readings);
  } catch (error) {
    console.error('Error fetching meter readings:', error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Zählerstände.' });
  }
});

// GET /api/meters/readings/:readingId - Einen spezifischen Zählerstand abrufen (Admin only)
// Angepasste Route, um Kollisionen zu vermeiden, z.B. /api/meters/reading/:readingId
router.get('/reading/:readingId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const reading = await MeterReading.findById(req.params.readingId)
      .populate({ path: 'meter', select: 'name unit' })
      .populate({ path: 'recordedBy', select: 'displayName email', model: 'User' });
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

    const updateData = {};
    if (value !== undefined) updateData.value = value;
    if (date) updateData.date = new Date(date);
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (notes !== undefined) updateData.notes = notes;
    // recordedBy und meter sollten nicht änderbar sein.

    const updatedReading = await MeterReading.findByIdAndUpdate(
      req.params.readingId,
      updateData,
      { new: true, runValidators: true }
    ).populate({ path: 'meter', select: 'name unit' })
     .populate({ path: 'recordedBy', select: 'displayName email', model: 'User' });

    if (!updatedReading) {
      return res.status(404).json({ msg: 'Zählerstand nicht gefunden.' });
    }
    res.json(updatedReading);
  } catch (error) {
    console.error('Error updating meter reading:', error);
    if (error.name === 'ValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors });
    }
    res.status(500).json({ error: 'Serverfehler beim Aktualisieren des Zählerstands.' });
  }
});

// DELETE /api/meters/reading/:readingId - Einen Zählerstand löschen (Admin only)
router.delete('/reading/:readingId', authMiddleware, adminOnly, async (req, res) => {
  try {
    const deletedReading = await MeterReading.findByIdAndDelete(req.params.readingId);
    if (!deletedReading) {
      return res.status(404).json({ msg: 'Zählerstand nicht gefunden.' });
    }
    res.json({ msg: 'Zählerstand erfolgreich gelöscht.' });
  } catch (error) {
    console.error('Error deleting meter reading:', error);
    res.status(500).json({ error: 'Serverfehler beim Löschen des Zählerstands.' });
  }
});


module.exports = router;
