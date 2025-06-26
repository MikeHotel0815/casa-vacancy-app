const express = require('express');
const { Op } = require('sequelize');
const Booking = require('../models/Booking');
const User = require('../models/User'); // User-Modell importieren
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
    // userId und displayName aus dem Request-Body für Admins extrahieren
    const { startDate, endDate, status, userId: targetUserId, displayName: targetDisplayName } = req.body;
    const loggedInUser = req.user; // Enthält id, displayName, isAdmin (nach Anpassung authRoute)

    let finalUserId = loggedInUser.id;
    let finalDisplayName = loggedInUser.displayName;

    // 1. Validierung
    if (!startDate || !endDate) {
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (status && !['booked', 'reserved'].includes(status)) {
      return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
    }

    // Wenn der angemeldete Benutzer ein Admin ist und targetUserId angegeben ist
    if (loggedInUser.isAdmin && targetUserId) {
      const userToBookFor = await User.findByPk(targetUserId);
      if (!userToBookFor) {
        return res.status(404).json({ msg: 'Der angegebene Benutzer für die Buchung wurde nicht gefunden.' });
      }
      finalUserId = userToBookFor.id;
      finalDisplayName = userToBookFor.displayName; // Den Anzeigenamen des Zielbenutzers verwenden
    } else if (loggedInUser.isAdmin && !targetUserId && targetDisplayName) {
        // Admin bucht für jemanden, aber gibt nur displayName an (weniger ideal, aber als Fallback)
        // Dies ist nicht empfohlen, da displayName nicht unique sein muss.
        // Besser ist es, immer mit targetUserId zu arbeiten.
        // In diesem Fall verwenden wir den übergebenen targetDisplayName,
        // aber die userId bleibt die des Admins. Das ist inkonsistent.
        // Wir sollten den Admin zwingen, eine UserId zu senden oder diesen Fall nicht unterstützen.
        // Fürs Erste: Wenn Admin und targetUserId nicht da, aber targetDisplayName, dann Fehler.
        return res.status(400).json({ msg: 'Admins müssen eine targetUserId angeben, um für andere zu buchen.' });
    } else if (!loggedInUser.displayName) {
        // Fallback, falls displayName nicht im Token ist (sollte nicht passieren mit korrektem Setup)
        return res.status(400).json({ msg: 'Anzeigename nicht im Token gefunden.' });
    }


    // 2. Verfeinerte Überschneidungsprüfung
    const finalStatus = status || 'booked';

    let conflictCheckFilter = {};
    if (finalStatus === 'booked') {
        // Eine neue 'booked' Buchung darf weder bestehende 'booked' noch 'reserved' überschneiden.
    } else { // finalStatus === 'reserved'
        // Eine neue 'reserved' Buchung darf nur bestehende 'booked' nicht überschneiden.
        conflictCheckFilter.status = 'booked';
    }

    const conflictingBooking = await Booking.findOne({
      where: {
        ...conflictCheckFilter,
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
      } else { // finalStatus === 'reserved'
        message += 'Buchung.';
      }
      return res.status(400).json({ msg: message });
    }

    // 3. Neue Buchung erstellen
    const newBooking = await Booking.create({
      startDate,
      endDate,
      userId: finalUserId,
      displayName: finalDisplayName,
      status: finalStatus,
    });

    res.status(201).json(newBooking);

  } catch (error) {
    console.error("Error creating booking:", error); // Logging für Debugging
    res.status(500).json({ error: error.message });
  }
});

// ---- ROUTE: DELETE /api/bookings/:id ----
// Löscht eine Buchung.
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const loggedInUser = req.user; // Enthält id, displayName, isAdmin

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Berechtigungsprüfung: Admin oder der Ersteller der Buchung
        if (!loggedInUser.isAdmin && booking.userId !== loggedInUser.id) {
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu löschen.' });
        }

        await booking.destroy();
        res.json({ msg: 'Buchung erfolgreich gelöscht.' });

    } catch (error) {
        console.error("Error deleting booking:", error); // Logging für Debugging
        res.status(500).json({ error: error.message });
    }
});

// ---- ROUTE: PUT /api/bookings/:id ----
// Aktualisiert eine Buchung, z.B. um den Status zu ändern.
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const loggedInUser = req.user; // Enthält id, displayName, isAdmin
        // targetUserId und targetDisplayName für Admins, um den Benutzer einer Buchung zu ändern
        const { startDate, endDate, status, userId: targetUserIdToSet, displayName: targetDisplayNameToSet } = req.body;

        const booking = await Booking.findByPk(bookingId);

        if (!booking) {
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Berechtigungsprüfung: Admin oder der Ersteller der Buchung
        if (!loggedInUser.isAdmin && booking.userId !== loggedInUser.id) {
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

        let finalUserIdToSet = booking.userId;
        let finalDisplayNameToSet = booking.displayName;

        // Wenn Admin einen neuen Benutzer für die Buchung setzt
        if (loggedInUser.isAdmin && targetUserIdToSet) {
            const userToSet = await User.findByPk(targetUserIdToSet);
            if (!userToSet) {
                return res.status(404).json({ msg: 'Der angegebene Benutzer für die Aktualisierung der Buchung wurde nicht gefunden.' });
            }
            finalUserIdToSet = userToSet.id;
            finalDisplayNameToSet = userToSet.displayName;
        } else if (loggedInUser.isAdmin && targetDisplayNameToSet && !targetUserIdToSet) {
            // Admin versucht, displayName zu ändern, ohne userId anzugeben.
            // Dies sollte idealerweise nicht passieren, da der Frontend-Admin-User-Picker die ID liefern sollte.
            // Wenn wir dies zulassen, könnte es zu Inkonsistenzen führen, wenn der displayName nicht eindeutig ist
            // oder wenn der Admin nur den Namen ändern möchte, ohne den User zu wechseln.
            // Für dieses Szenario: Wenn targetUserIdToSet nicht gegeben ist, aber targetDisplayNameToSet,
            // dann nehmen wir an, der Admin möchte NUR den Anzeigenamen ändern (z.B. bei Tippfehlerkorrektur),
            // OHNE den zugrunde liegenden Benutzer (userId) zu wechseln.
            // Dies ist ein spezieller Fall und sollte im Frontend klar kommuniziert werden.
            // Wenn der Admin jedoch den Benutzer wechseln will, MUSS targetUserIdToSet gesendet werden.
            // Hier nehmen wir an, dass targetDisplayNameToSet nur für eine Korrektur des Namens des aktuellen Benutzers ist.
            if (finalUserIdToSet === booking.userId) { // Nur wenn der User gleich bleibt
                 finalDisplayNameToSet = targetDisplayNameToSet;
            } else {
                // Wenn targetUserIdToSet fehlt, aber der Admin versucht, einen anderen User via displayName zu setzen, ist das ein Fehler
                 return res.status(400).json({ msg: 'Um den Benutzer einer Buchung zu ändern, muss eine targetUserId angegeben werden.' });
            }
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
        booking.userId = finalUserIdToSet; // UserId aktualisieren
        booking.displayName = finalDisplayNameToSet; // DisplayName aktualisieren

        await booking.save();
        res.json(booking);

    } catch (error) {
        console.error("Error updating booking:", error); // Logging für Debugging
        res.status(500).json({ error: error.message });
    }
});


module.exports = router;
