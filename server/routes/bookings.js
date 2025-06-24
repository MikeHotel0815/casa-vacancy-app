const express = require('express');
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const User = require('../models/User'); // User-Modell importieren
const { authMiddleware, adminOnly } = require('../middleware/authMiddleware'); // Importieren unserer Middleware

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
    let { startDate, endDate, status, userIdForBooking } = req.body; // userIdForBooking für Admin
    let targetUserId = req.user.id;
    let targetUserDisplayName = req.user.displayName;

    // Wenn der anfragende Benutzer ein Admin ist und eine userIdForBooking angegeben wurde,
    // wird die Buchung für diesen Benutzer erstellt.
    if (req.user.isAdmin && userIdForBooking) {
      const userToBookFor = await User.findByPk(userIdForBooking);
      if (!userToBookFor) {
        return res.status(404).json({ msg: 'Der angegebene Benutzer zum Buchen wurde nicht gefunden.' });
      }
      targetUserId = userToBookFor.id;
      targetUserDisplayName = userToBookFor.displayName;
    } else if (userIdForBooking && !req.user.isAdmin) {
      return res.status(403).json({ msg: 'Nur Administratoren dürfen Buchungen für andere Benutzer erstellen.' });
    }


    // 1. Validierung
    if (!startDate || !endDate) {
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (!targetUserDisplayName) { // Geändert von displayName zu targetUserDisplayName
      return res.status(400).json({ msg: 'Anzeigename für die Buchung konnte nicht ermittelt werden.' });
    }
    if (status && !['booked', 'reserved'].includes(status)) {
      return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
    }

    // 2. Überschneidungsprüfung (nur für 'booked' Status, 'reserved' darf sich überschneiden oder auch nicht, je nach Anforderung)
    // 2. Verfeinerte Überschneidungsprüfung
    const finalStatus = status || 'booked'; // Status, den die neue Buchung haben wird

    // Jede neue Buchung (booked oder reserved) darf keine bestehende 'booked' Buchung überschneiden.
    // Eine neue 'booked' Buchung darf zusätzlich keine bestehende 'reserved' Buchung überschneiden.
    // -> Einfacher: Wenn finalStatus 'booked', prüfe gegen alle. Wenn finalStatus 'reserved', prüfe nur gegen 'booked'.

    let conflictCheckFilter = {};
    if (finalStatus === 'booked') {
        // Eine neue 'booked' Buchung darf weder bestehende 'booked' noch 'reserved' überschneiden.
        // Also keine zusätzliche Filterung nach Status für bestehende Buchungen.
    } else { // finalStatus === 'reserved'
        // Eine neue 'reserved' Buchung darf nur bestehende 'booked' nicht überschneiden.
        conflictCheckFilter.status = 'booked';
    }

    const conflictingBooking = await Booking.findOne({
      where: {
        ...conflictCheckFilter, // Filtert ggf. nach status: 'booked' für bestehende Buchungen
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

    if (conflictingBooking) {
      let message = 'Der ausgewählte Zeitraum überschneidet sich mit einer bestehenden ';
      if (finalStatus === 'booked' && conflictingBooking.status === 'reserved') {
        message += 'Reservierung.';
      } else if (finalStatus === 'booked' && conflictingBooking.status === 'booked') {
        message += 'Buchung.';
      } else { // finalStatus === 'reserved' (kann nur mit 'booked' kollidieren)
        message += 'Buchung.';
      }
      return res.status(400).json({ msg: message });
    }

    // 3. Neue Buchung erstellen
    const newBooking = await Booking.create({
      startDate,
      endDate,
      userId: targetUserId, // Geändert zu targetUserId
      displayName: targetUserDisplayName, // Geändert zu targetUserDisplayName
      status: finalStatus,
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
        const requestingUser = req.user;

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Admins dürfen jede Buchung löschen, andere Benutzer nur ihre eigenen.
        if (!requestingUser.isAdmin && booking.userId !== requestingUser.id) {
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
        const requestingUser = req.user;
        const { startDate, endDate, status, userIdForBooking } = req.body; // userIdForBooking für Admin-Besitzerwechsel

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Admins dürfen jede Buchung ändern, andere Benutzer nur ihre eigenen.
        if (!requestingUser.isAdmin && booking.userId !== requestingUser.id) {
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu ändern.' });
        }

        let newOwnerUserId = booking.userId;
        let newOwnerDisplayName = booking.displayName;

        // Wenn Admin eine userIdForBooking angibt, wird der Besitzer der Buchung geändert
        if (requestingUser.isAdmin && userIdForBooking && userIdForBooking !== booking.userId) {
            const userToAssignBookingTo = await User.findByPk(userIdForBooking);
            if (!userToAssignBookingTo) {
                return res.status(404).json({ msg: 'Der angegebene Benutzer für die Buchungszuweisung wurde nicht gefunden.' });
            }
            newOwnerUserId = userToAssignBookingTo.id;
            newOwnerDisplayName = userToAssignBookingTo.displayName;
        } else if (userIdForBooking && !requestingUser.isAdmin) {
             return res.status(403).json({ msg: 'Nur Administratoren dürfen den Besitzer einer Buchung ändern.' });
        }


        // Validierung für Status
        if (status && !['booked', 'reserved'].includes(status)) {
            return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
        }

        // Validierung für Daten, falls sie geändert werden
        if ((startDate && !endDate) || (!startDate && endDate)) {
            return res.status(400).json({ msg: 'Bei Datumsänderung müssen Start- und Enddatum angegeben werden.' });
        }

        const newStartDate = startDate || booking.startDate;
        const newEndDate = endDate || booking.endDate;
        const newStatus = status || booking.status;

        // Überschneidungsprüfung, falls Daten geändert werden oder Status von 'reserved' zu 'booked' wechselt
        let performOverlapCheck = false;
        if (startDate || endDate) { // Dates are changing
            performOverlapCheck = true;
        } else if (newStatus === 'booked' && booking.status === 'reserved') { // Status changes R -> B
            performOverlapCheck = true;
        }

        if (performOverlapCheck) {
            let conflictCheckFilter = { id: { [Op.ne]: bookingId } }; // Exclude self
            if (newStatus === 'booked') {
                // Check against all other bookings (both 'booked' and 'reserved')
            } else { // newStatus === 'reserved'
                // Check only against other 'booked' bookings
                conflictCheckFilter.status = 'booked';
            }

            const conflictingBooking = await Booking.findOne({
                where: {
                    ...conflictCheckFilter,
                    [Op.or]: [
                        { startDate: { [Op.between]: [newStartDate, newEndDate] } },
                        { endDate: { [Op.between]: [newStartDate, newEndDate] } },
                        { [Op.and]: [
                            { startDate: { [Op.lte]: newStartDate } },
                            { endDate: { [Op.gte]: newEndDate } }
                        ]}
                    ]
                }
            });

            if (conflictingBooking) {
                let message = 'Der Zeitraum der Aktualisierung überschneidet sich mit einer bestehenden ';
                if (newStatus === 'booked' && conflictingBooking.status === 'reserved') {
                    message += 'Reservierung.';
                } else if (newStatus === 'booked' && conflictingBooking.status === 'booked') {
                    message += 'Buchung.';
                } else { // newStatus === 'reserved' (kann nur mit 'booked' kollidieren)
                    message += 'Buchung.';
                }
                return res.status(400).json({ msg: message });
            }
        }

        // Update der Buchung
        booking.startDate = newStartDate;
        booking.endDate = newEndDate;
        booking.status = newStatus;
        booking.userId = newOwnerUserId; // Besitzer aktualisieren
        booking.displayName = newOwnerDisplayName; // Anzeigename des Besitzers aktualisieren

        await booking.save();
        res.json(booking);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
