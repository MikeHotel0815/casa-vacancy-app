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
    const { startDate, endDate, status } = req.body; // Status aus dem Request-Body holen
    const userId = req.user.id;
    const displayName = req.user.displayName;

    // 1. Validierung
    if (!startDate || !endDate) {
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (!displayName) {
      return res.status(400).json({ msg: 'Anzeigename nicht im Token gefunden.' });
    }
    if (status && !['booked', 'reserved'].includes(status)) {
      return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
    }

    // 2. Überschneidungsprüfung (nur für 'booked' Status, 'reserved' darf sich überschneiden oder auch nicht, je nach Anforderung)
    // Für dieses Beispiel: Überschneidungsprüfung für beide Status. Anpassen falls Reservierungen Überschneidungen erlauben sollen.
    const existingBooking = await Booking.findOne({
      where: {
        // Nur prüfen gegen 'booked' Buchungen oder alle? Annahme: gegen alle.
        // status: 'booked', // Optional: Nur gegen 'booked' prüfen
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
      // Hier könnte man noch prüfen, ob die bestehende Buchung 'reserved' ist und die neue 'booked' oder umgekehrt,
      // um ggf. eine Reservierung durch eine feste Buchung "überstimmen" zu lassen.
      // Fürs Erste: Jede Überschneidung ist ein Konflikt.
      return res.status(400).json({ msg: 'Der ausgewählte Zeitraum ist bereits belegt oder reserviert.' });
    }

    // 3. Neue Buchung erstellen
    const newBooking = await Booking.create({
      startDate,
      endDate,
      userId,
      displayName,
      status: status || 'booked', // Fallback auf 'booked', falls kein Status mitgegeben wird
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

// ---- ROUTE: PUT /api/bookings/:id ----
// Aktualisiert eine Buchung, z.B. um den Status zu ändern.
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const userId = req.user.id; // Nur der eigene Benutzer oder ein Admin sollte dies tun
        const { startDate, endDate, status } = req.body;

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Berechtigungsprüfung: Nur der Ersteller der Buchung darf sie ändern.
        // Man könnte hier auch eine Admin-Rolle erlauben.
        if (booking.userId !== userId) {
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu ändern.' });
        }

        // Validierung für Status
        if (status && !['booked', 'reserved'].includes(status)) {
            return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
        }

        // Validierung für Daten, falls sie geändert werden
        if ((startDate && !endDate) || (!startDate && endDate)) {
            return res.status(400).json({ msg: 'Bei Datumsänderung müssen Start- und Enddatum angegeben werden.' });
        }

        // Überschneidungsprüfung, falls Daten geändert werden oder Status auf 'booked' wechselt
        if ((startDate && endDate) || (status === 'booked' && booking.status === 'reserved')) {
            const checkStartDate = startDate || booking.startDate;
            const checkEndDate = endDate || booking.endDate;

            const existingBooking = await Booking.findOne({
                where: {
                    id: { [Op.ne]: bookingId }, // Schließe die aktuelle Buchung von der Prüfung aus
                    // Ggf. weitere Filter, z.B. nur gegen andere 'booked' Buchungen prüfen
                    [Op.or]: [
                        { startDate: { [Op.between]: [checkStartDate, checkEndDate] } },
                        { endDate: { [Op.between]: [checkStartDate, checkEndDate] } },
                        { [Op.and]: [
                            { startDate: { [Op.lte]: checkStartDate } },
                            { endDate: { [Op.gte]: checkEndDate } }
                        ]}
                    ]
                }
            });

            if (existingBooking) {
                return res.status(400).json({ msg: 'Der neue Zeitraum überschneidet sich mit einer bestehenden Buchung.' });
            }
        }

        // Update der Buchung
        booking.startDate = startDate || booking.startDate;
        booking.endDate = endDate || booking.endDate;
        booking.status = status || booking.status;

        await booking.save();
        res.json(booking);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
