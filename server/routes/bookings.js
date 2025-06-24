const express = require('express');
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/authMiddleware'); // Importieren unserer Middleware

const router = express.Router();

// ---- ROUTE: GET /api/bookings ----
// Ruft alle existierenden Buchungen ab.
router.get('/', async (req, res) => {
  try {
    const bookings = await Booking.findAll();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- ROUTE: POST /api/bookings ----
// Erstellt eine neue Buchung.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const userId = req.user.id;
    const displayName = req.user.displayName; // Anzeigename aus dem Token holen

    // 1. Validierung
    if (!startDate || !endDate) {
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (!displayName) {
        return res.status(400).json({ msg: 'Anzeigename nicht im Token gefunden.' });
    }

    // 2. Überschneidungsprüfung
    const existingBooking = await Booking.findOne({
      where: {
        [Op.or]: [
          { startDate: { [Op.between]: [startDate, endDate] } },
          { endDate: { [Op.between]: [startDate, endDate] } },
          { [Op.and]: [
              { startDate: { [Op.lte]: startDate } },
              { endDate: { [Op.gte]: endDate } }
          ]}
        ]
      }
    });

    if (existingBooking) {
      return res.status(400).json({ msg: 'Der ausgewählte Zeitraum ist bereits belegt.' });
    }

    // 3. Neue Buchung erstellen
    const newBooking = await Booking.create({
      startDate,
      endDate,
      userId,
      displayName, // Anzeigename mitspeichern
    });

    res.status(201).json(newBooking);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- ROUTE: DELETE /api/bookings/:id ----
// Löscht eine Buchung.
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user.id;

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        if (booking.userId !== userId) {
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu löschen.' });
        }

        await booking.destroy();
        res.json({ msg: 'Buchung erfolgreich gelöscht.' });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
