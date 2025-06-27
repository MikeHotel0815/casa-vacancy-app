const express = require('express');
const { Op, Sequelize } = require('sequelize'); // Import Sequelize
const { v4: uuidv4 } = require('uuid'); // Import uuid
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification'); // Import Notification model
const authMiddleware = require('../middleware/authMiddleware');
const { sequelize } = require('../config/database'); // Import sequelize instance for transactions

const router = express.Router();

// Helper function to find conflicts
async function findConflictingBookings(startDate, endDate, excludeBookingId = null) {
  const whereClause = {
    status: { [Op.in]: ['booked', 'reserved'] }, // Only conflict with actual confirmed/reserved bookings
    [Op.or]: [
      { startDate: { [Op.lt]: endDate }, endDate: { [Op.gt]: startDate } }, // New interval overlaps existing
    ],
  };
  if (excludeBookingId) {
    whereClause.id = { [Op.ne]: excludeBookingId };
  }
  return Booking.findAll({ where: whereClause, order: [['createdAt', 'ASC']] }); // Prioritize older bookings
}


// ---- ROUTE: POST /api/bookings ----
// Erstellt eine neue Buchung oder Buchungssegmente bei Überschneidungen.
router.post('/', authMiddleware, async (req, res) => {
  const transaction = await sequelize.transaction(); // Start a transaction
  try {
    const { startDate: reqStartDate, endDate: reqEndDate, status: reqStatus, userId: targetUserId, displayName: targetDisplayName } = req.body;
    const loggedInUser = req.user;

    const originalRequestId = uuidv4(); // Generate a unique ID for this booking request

    let finalUserId = loggedInUser.id;
    let finalDisplayName = loggedInUser.displayName;

    // 1. Validation
    if (!reqStartDate || !reqEndDate) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (new Date(reqStartDate) >= new Date(reqEndDate)) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Das Enddatum muss nach dem Startdatum liegen.' });
    }
    const requestedStatus = reqStatus || 'booked';
    if (!['booked', 'reserved'].includes(requestedStatus)) { // User can only request 'booked' or 'reserved'
      await transaction.rollback();
      return res.status(400).json({ msg: 'Ungültiger Statuswert. Nur "booked" oder "reserved" anfragen.' });
    }

    if (loggedInUser.isAdmin && targetUserId) {
      const userToBookFor = await User.findByPk(targetUserId, { transaction });
      if (!userToBookFor) {
        await transaction.rollback();
        return res.status(404).json({ msg: 'Der angegebene Benutzer für die Buchung wurde nicht gefunden.' });
      }
      finalUserId = userToBookFor.id;
      finalDisplayName = userToBookFor.displayName;
    } else if (loggedInUser.isAdmin && !targetUserId && targetDisplayName) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Admins müssen eine targetUserId angeben, um für andere zu buchen.' });
    } else if (!loggedInUser.displayName) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Anzeigename nicht im Token gefunden.' });
    }

    const conflictingPrimaryBookings = await findConflictingBookings(reqStartDate, reqEndDate);

    const createdBookingSegments = [];

    if (conflictingPrimaryBookings.length === 0) {
      // No conflicts, create the booking as is
      const newBooking = await Booking.create({
        startDate: reqStartDate,
        endDate: reqEndDate,
        userId: finalUserId,
        displayName: finalDisplayName,
        status: requestedStatus,
        originalRequestId,
        isSplit: false,
      }, { transaction });
      createdBookingSegments.push(newBooking);
    } else {
      // Conflicts exist, handle splitting and 'angefragt' status
      let currentStartDate = new Date(reqStartDate);
      const requestEndDate = new Date(reqEndDate);

      // Sort conflicts by their start date to process them in order
      conflictingPrimaryBookings.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

      for (const conflict of conflictingPrimaryBookings) {
        const conflictStart = new Date(conflict.startDate);
        const conflictEnd = new Date(conflict.endDate);

        // 1. Non-overlapping part before the current conflict
        if (currentStartDate < conflictStart) {
          const segmentEndDate = new Date(Math.min(requestEndDate.getTime(), conflictStart.getTime()));
          if (currentStartDate < segmentEndDate) {
             const segment = await Booking.create({
                startDate: currentStartDate.toISOString().split('T')[0],
                endDate: segmentEndDate.toISOString().split('T')[0],
                userId: finalUserId,
                displayName: finalDisplayName,
                status: requestedStatus, // 'booked' or 'reserved'
                originalRequestId,
                isSplit: true,
             }, { transaction });
             createdBookingSegments.push(segment);
          }
        }

        // 2. Overlapping part (becomes 'angefragt')
        const overlapStart = new Date(Math.max(currentStartDate.getTime(), conflictStart.getTime()));
        const overlapEnd = new Date(Math.min(requestEndDate.getTime(), conflictEnd.getTime()));

        if (overlapStart < overlapEnd) {
          const angefragtSegment = await Booking.create({
            startDate: overlapStart.toISOString().split('T')[0],
            endDate: overlapEnd.toISOString().split('T')[0],
            userId: finalUserId,
            displayName: finalDisplayName,
            status: 'angefragt',
            originalRequestId,
            isSplit: true,
            originalBookingId: conflict.id, // Link to the primary booking it overlaps with
          }, { transaction });
          createdBookingSegments.push(angefragtSegment);

          // Create notification for the owner of the primary booking
          await Notification.create({
            recipientUserId: conflict.userId,
            type: 'overlap_request',
            message: `Eine neue Buchungsanfrage von ${finalDisplayName} (${overlapStart.toISOString().split('T')[0]} bis ${overlapEnd.toISOString().split('T')[0]}) überschneidet sich mit Ihrer Buchung (${conflict.startDate} bis ${conflict.endDate}).`,
            relatedBookingId: angefragtSegment.id,
            overlapStartTime: overlapStart,
            overlapEndTime: overlapEnd,
          }, { transaction });
        }
        currentStartDate = new Date(Math.max(currentStartDate.getTime(), overlapEnd.getTime()));
        if (currentStartDate >= requestEndDate) break; // Processed the whole request range
      }

      // 3. Non-overlapping part after all conflicts
      if (currentStartDate < requestEndDate) {
        const segment = await Booking.create({
          startDate: currentStartDate.toISOString().split('T')[0],
          endDate: requestEndDate.toISOString().split('T')[0],
          userId: finalUserId,
          displayName: finalDisplayName,
          status: requestedStatus,
          originalRequestId,
          isSplit: true,
        }, { transaction });
        createdBookingSegments.push(segment);
      }
    }

    await transaction.commit();
    res.status(201).json(createdBookingSegments);

  } catch (error) {
    await transaction.rollback(); // Rollback transaction on error
    console.error("Error creating booking:", error);
    // Check for specific Sequelize validation errors if needed
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: error.message, detail: error.stack });
  }
});

// ... (rest of the routes: GET, DELETE, PUT - PUT will need similar overlap logic if dates change)
// Helper function to find conflicts (already defined above, ensure it's in scope or passed)

// ---- ROUTE: DELETE /api/bookings/:id ----
// Löscht eine Buchung.
router.delete('/:id', authMiddleware, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const bookingId = req.params.id;
        const loggedInUser = req.user;

        const booking = await Booking.findByPk(bookingId, { transaction });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Berechtigungsprüfung: Admin oder der Ersteller der Buchung
        if (!loggedInUser.isAdmin && booking.userId !== loggedInUser.id) {
            await transaction.rollback();
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu löschen.' });
        }

        // If deleting a primary booking, consider what happens to 'angefragt' bookings linked to it.
        // The model's onDelete: 'SET NULL' for originalBookingId handles DB consistency.
        // Application logic might be needed to notify users of 'angefragt' bookings if their primary is deleted.
        // For now, we just delete the booking.

        // Also, delete related 'angefragt' notifications if the booking being deleted IS an 'angefragt' booking.
        if (booking.status === 'angefragt') {
            await Notification.destroy({ where: { relatedBookingId: booking.id, type: 'overlap_request' }, transaction });
        }


        await booking.destroy({ transaction });
        await transaction.commit();
        res.json({ msg: 'Buchung erfolgreich gelöscht.' });

    } catch (error) {
        await transaction.rollback();
        console.error("Error deleting booking:", error);
        res.status(500).json({ error: error.message });
    }
});

// ---- ROUTE: PUT /api/bookings/:id ----
// Aktualisiert eine Buchung, z.B. um den Status zu ändern.
// IMPORTANT: This route currently does NOT implement the new overlapping logic.
// Updating a booking's date might cause new overlaps or change existing ones.
// This needs a similar complex logic as the POST route.
// For this iteration, date changes that cause new conflicts will likely be rejected by old logic or fail.
router.put('/:id', authMiddleware, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const bookingId = req.params.id;
        const loggedInUser = req.user;
        const { startDate, endDate, status, userId: targetUserIdToSet, displayName: targetDisplayNameToSet } = req.body;

        const booking = await Booking.findByPk(bookingId, { transaction });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Users cannot directly change a booking to 'angefragt' or from 'angefragt' to 'booked' via PUT.
        // 'angefragt' is a system-set status. Confirmation of an 'angefragt' booking happens via notification response.
        if (status && (status === 'angefragt' || booking.status === 'angefragt' && status !== 'cancelled')) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Status "angefragt" kann nicht direkt gesetzt oder geändert werden, außer zu "cancelled".' });
        }


        if (!loggedInUser.isAdmin && booking.userId !== loggedInUser.id) {
            await transaction.rollback();
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu ändern.' });
        }

        if (status && !['booked', 'reserved', 'cancelled'].includes(status)) { // Added 'cancelled'
            await transaction.rollback();
            return res.status(400).json({ msg: 'Ungültiger Statuswert.' });
        }
        if ((startDate && !endDate) || (!startDate && endDate)) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Bei Datumsänderung müssen Start- und Enddatum angegeben werden.' });
        }
         if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Das Enddatum muss nach dem Startdatum liegen.' });
        }


        let finalUserIdToSet = booking.userId;
        let finalDisplayNameToSet = booking.displayName;

        if (loggedInUser.isAdmin && targetUserIdToSet) {
            const userToSet = await User.findByPk(targetUserIdToSet, { transaction });
            if (!userToSet) {
                await transaction.rollback();
                return res.status(404).json({ msg: 'Der angegebene Benutzer für die Aktualisierung wurde nicht gefunden.' });
            }
            finalUserIdToSet = userToSet.id;
            finalDisplayNameToSet = userToSet.displayName;
        } else if (loggedInUser.isAdmin && targetDisplayNameToSet && !targetUserIdToSet) {
             if (finalUserIdToSet === booking.userId) {
                 finalDisplayNameToSet = targetDisplayNameToSet;
            } else {
                 await transaction.rollback();
                 return res.status(400).json({ msg: 'Um den Benutzer zu ändern, muss eine targetUserId angegeben werden.' });
            }
        }

        const newStartDate = startDate || booking.startDate;
        const newEndDate = endDate || booking.endDate;
        const newStatus = status || booking.status;

        // *** Overlap check for PUT - Simplified for now ***
        // A full implementation would require deleting current booking and re-creating segments,
        // which is very complex for PUT.
        // Current simplified check: if dates change, or status changes to 'booked' from 'reserved',
        // check for conflicts. This does NOT implement the splitting logic of POST.
        // It will reject if ANY conflict is found.
        let performOverlapCheck = false;
        if ( (startDate || endDate) && (newStartDate !== booking.startDate || newEndDate !== booking.endDate) ) {
            performOverlapCheck = true;
        } else if (newStatus === 'booked' && booking.status === 'reserved') {
            performOverlapCheck = true;
        }

        if (performOverlapCheck) {
            // This is the OLD conflict check logic. It doesn't split or create 'angefragt'.
            // It just prevents the update if a conflict is found.
            const conflictCheckFilter = {
                id: { [Op.ne]: bookingId },
                status: newStatus === 'booked' ? { [Op.in]: ['booked', 'reserved'] } : 'booked',
                 [Op.or]: [
                    { startDate: { [Op.lt]: newEndDate }, endDate: { [Op.gt]: newStartDate } },
                ]
            };

            const conflictingBooking = await Booking.findOne({ where: conflictCheckFilter, transaction });

            if (conflictingBooking) {
                await transaction.rollback();
                let message = 'Die Aktualisierung überschneidet sich mit einer bestehenden ';
                message += conflictingBooking.status === 'reserved' ? 'Reservierung.' : 'Buchung.';
                return res.status(400).json({ msg: message });
            }
        }

        booking.startDate = newStartDate;
        booking.endDate = newEndDate;
        booking.status = newStatus;
        booking.userId = finalUserIdToSet;
        booking.displayName = finalDisplayNameToSet;
        // originalRequestId and isSplit should not change on simple updates unless it's a re-creation.

        await booking.save({ transaction });
        await transaction.commit();
        res.json(booking);

    } catch (error) {
        await transaction.rollback();
        console.error("Error updating booking:", error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
        }
        res.status(500).json({ error: error.message, detail: error.stack });
    }
});

// GET /api/bookings (no changes needed for this, but ensure it returns new fields)
router.get('/', async (req, res) => {
  try {
    // Include User model to get more details if needed, or just use displayName from Booking
    const bookings = await Booking.findAll({
        order: [['startDate', 'ASC']],
        // include: [{ model: User, attributes: ['displayName'] }] // Example if you need more user details
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
