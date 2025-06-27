const express = require('express');
const { Op, Sequelize } = require('sequelize'); // Import Sequelize
const { v4: uuidv4 } = require('uuid'); // Import uuid
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification'); // Import Notification model
const authMiddleware = require('../middleware/authMiddleware');
const { sequelize } = require('../config/database'); // Import sequelize instance for transactions

const router = express.Router();

// Helper function to find conflicts (excluding a specific booking ID if provided)
async function findConflictingBookings(startDate, endDate, excludeBookingId = null, transaction = null) {
  const whereClause = {
    status: { [Op.in]: ['booked', 'reserved'] },
    [Op.or]: [
      { startDate: { [Op.lt]: endDate }, endDate: { [Op.gt]: startDate } },
    ],
  };
  if (excludeBookingId) {
    whereClause.id = { [Op.ne]: excludeBookingId };
  }
  return Booking.findAll({ where: whereClause, order: [['createdAt', 'ASC']], transaction });
}

// Reusable function to create/process bookings with overlap logic
async function processAndCreateBookings({
  requestedStartDate,
  requestedEndDate,
  requestedStatus,
  userId,
  displayName,
  originalRequestIdIn, // Use a different name to avoid conflict with uuidv4()
  transaction,
  existingBookingToUpdate = null // Pass if this is an update scenario
}) {
  let finalUserId = userId;
  let finalDisplayName = displayName;
  // If existingBookingToUpdate is provided, its originalRequestId should be preferred
  const originalRequestId = existingBookingToUpdate?.originalRequestId || originalRequestIdIn || uuidv4();


  // ---- START: Same-User Booking Merging Logic ----
  let effectiveReqStartDate = new Date(requestedStartDate);
  let effectiveReqEndDate = new Date(requestedEndDate);

  const sameUserBookingsQuery = {
    userId: finalUserId,
    status: { [Op.in]: ['booked', 'reserved'] },
    [Op.or]: [
      { startDate: { [Op.lte]: effectiveReqEndDate }, endDate: { [Op.gte]: effectiveReqStartDate } },
    ],
  };
  // If updating, exclude the booking being updated from the initial merge check against itself
  if (existingBookingToUpdate) {
    sameUserBookingsQuery.id = { [Op.ne]: existingBookingToUpdate.id };
  }

  const sameUserBookings = await Booking.findAll({ where: sameUserBookingsQuery, transaction });

  if (sameUserBookings.length > 0) {
    const bookingsToDelete = [];
    for (const booking of sameUserBookings) {
      effectiveReqStartDate = new Date(Math.min(effectiveReqStartDate.getTime(), new Date(booking.startDate).getTime()));
      effectiveReqEndDate = new Date(Math.max(effectiveReqEndDate.getTime(), new Date(booking.endDate).getTime()));
      bookingsToDelete.push(booking.id);
    }
    if (bookingsToDelete.length > 0) {
      await Booking.destroy({ where: { id: { [Op.in]: bookingsToDelete }, userId: finalUserId }, transaction });
    }
  }
  // ---- END: Same-User Booking Merging Logic ----

  // Now, find conflicts with OTHER users using the (potentially merged) effective dates
  // If updating, exclude the original booking ID from conflict check, as it's being replaced.
  const conflicts = await findConflictingBookings(
    effectiveReqStartDate.toISOString().split('T')[0],
    effectiveReqEndDate.toISOString().split('T')[0],
    existingBookingToUpdate ? existingBookingToUpdate.id : null, // Exclude self if updating
    transaction
  );

  const createdBookingSegments = [];

  if (conflicts.filter(b => b.userId !== finalUserId).length === 0) {
    const newBooking = await Booking.create({
      startDate: effectiveReqStartDate.toISOString().split('T')[0],
      endDate: effectiveReqEndDate.toISOString().split('T')[0],
      userId: finalUserId,
      displayName: finalDisplayName,
      status: requestedStatus,
      originalRequestId,
      isSplit: false,
    }, { transaction });
    createdBookingSegments.push(newBooking);
  } else {
    let currentStartDate = new Date(effectiveReqStartDate);
    const requestEndDate = new Date(effectiveReqEndDate);
    const otherUserConflicts = conflicts
      .filter(b => b.userId !== finalUserId)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    for (const conflict of otherUserConflicts) {
      const conflictStart = new Date(conflict.startDate);
      const conflictEnd = new Date(conflict.endDate);

      if (currentStartDate < conflictStart) {
        const segmentEndDate = new Date(Math.min(requestEndDate.getTime(), conflictStart.getTime()));
        if (currentStartDate < segmentEndDate) {
          const segment = await Booking.create({
            startDate: currentStartDate.toISOString().split('T')[0],
            endDate: segmentEndDate.toISOString().split('T')[0],
            userId: finalUserId, displayName: finalDisplayName, status: requestedStatus, originalRequestId, isSplit: true,
          }, { transaction });
          createdBookingSegments.push(segment);
        }
      }

      const overlapStart = new Date(Math.max(currentStartDate.getTime(), conflictStart.getTime()));
      const overlapEnd = new Date(Math.min(requestEndDate.getTime(), conflictEnd.getTime()));

      if (overlapStart < overlapEnd) {
        if (conflict.userId !== finalUserId) { // Should always be true due to filter
          const angefragtSegment = await Booking.create({
            startDate: overlapStart.toISOString().split('T')[0],
            endDate: overlapEnd.toISOString().split('T')[0],
            userId: finalUserId, displayName: finalDisplayName, status: 'angefragt', originalRequestId, isSplit: true, originalBookingId: conflict.id,
          }, { transaction });
          createdBookingSegments.push(angefragtSegment);
          await Notification.create({
            recipientUserId: conflict.userId, type: 'overlap_request',
            message: `Eine neue Buchungsanfrage von ${finalDisplayName} (${overlapStart.toISOString().split('T')[0]} bis ${overlapEnd.toISOString().split('T')[0]}) überschneidet sich mit Ihrer Buchung (${conflict.startDate} bis ${conflict.endDate}).`,
            relatedBookingId: angefragtSegment.id, overlapStartTime: overlapStart, overlapEndTime: overlapEnd,
          }, { transaction });
        }
      }
      currentStartDate = new Date(Math.max(currentStartDate.getTime(), overlapEnd.getTime()));
      if (currentStartDate >= requestEndDate) break;
    }

    if (currentStartDate < requestEndDate) {
      const segment = await Booking.create({
        startDate: currentStartDate.toISOString().split('T')[0],
        endDate: requestEndDate.toISOString().split('T')[0],
        userId: finalUserId, displayName: finalDisplayName, status: requestedStatus, originalRequestId, isSplit: true,
      }, { transaction });
      createdBookingSegments.push(segment);
    }
  }
  return createdBookingSegments.filter(s => s);
}

// ---- ROUTE: POST /api/bookings ----
// Erstellt eine neue Buchung oder Buchungssegmente bei Überschneidungen.
router.post('/', authMiddleware, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { startDate: reqStartDate, endDate: reqEndDate, status: reqStatusBody, userId: targetUserId, displayName: targetDisplayNameBody } = req.body;
    const loggedInUser = req.user;
    const requestOriginalRequestId = uuidv4(); // Generate a unique ID for this specific user request operation

    let finalUserId = loggedInUser.id;
    let finalDisplayName = loggedInUser.displayName;
    let requestedStatus = reqStatusBody || 'booked';

    // 1. Validation
    if (!reqStartDate || !reqEndDate) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Bitte Start- und Enddatum angeben.' });
    }
    if (new Date(reqStartDate) >= new Date(reqEndDate)) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Das Enddatum muss nach dem Startdatum liegen.' });
    }
    if (!['booked', 'reserved'].includes(requestedStatus)) {
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
      finalDisplayName = userToBookFor.displayName; // Use actual displayName of target user
    } else if (loggedInUser.isAdmin && !targetUserId && targetDisplayNameBody) { // Admin booking for external user by name
        // This case should be handled carefully or disallowed if external users aren't modeled.
        // Assuming for now targetDisplayNameBody is for an existing user if targetUserId is not given.
        // Or, if it's a truly external name, ensure your User model/logic supports it.
        // For simplicity, this example assumes if targetUserId is missing, it's for the admin themselves or invalid.
        // Let's stick to: admin needs targetUserId to book for others.
        await transaction.rollback();
        return res.status(400).json({ msg: 'Admins müssen eine targetUserId angeben, um für andere zu buchen.' });
    } else if (!loggedInUser.displayName) {
        await transaction.rollback();
        return res.status(400).json({ msg: 'Anzeigename nicht im Token gefunden.' });
    }
     // If admin is booking for self, or non-admin booking for self
    if(targetUserId && targetUserId === loggedInUser.id && targetDisplayNameBody) {
        finalDisplayName = targetDisplayNameBody; // Allow self-update of display name if provided
    } else if (targetUserId && targetUserId === loggedInUser.id && !targetDisplayNameBody){
        finalDisplayName = loggedInUser.displayName;
    } else if (!targetUserId) { // Normal user booking for self
        finalDisplayName = loggedInUser.displayName;
    }


    const createdBookingSegments = await processAndCreateBookings({
      requestedStartDate: reqStartDate,
      requestedEndDate: reqEndDate,
      requestedStatus,
      userId: finalUserId,
      displayName: finalDisplayName,
      originalRequestIdIn: requestOriginalRequestId, // Pass the new UUID for this operation
      transaction
    });

    await transaction.commit();
    res.status(201).json(createdBookingSegments);

  } catch (error) {
    await transaction.rollback();
    console.error("Error creating booking:", error);
    if (error.name === 'SequelizeValidationError') {
        return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
    }
    res.status(500).json({ error: error.message, detail: error.stack });
  }
});


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
// Aktualisiert eine Buchung. Wendet die volle Overlap-Logik an, wenn Daten oder Status geändert werden.
router.put('/:id', authMiddleware, async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const bookingId = req.params.id;
        const loggedInUser = req.user;
        const {
            startDate: newStartDateStr,
            endDate: newEndDateStr,
            status: newStatusBody,
            userId: newTargetUserId,
            displayName: newTargetDisplayName
        } = req.body;

        const existingBooking = await Booking.findByPk(bookingId, { transaction });

        if (!existingBooking) {
            await transaction.rollback();
            return res.status(404).json({ msg: 'Buchung nicht gefunden.' });
        }

        // Berechtigungsprüfung
        if (!loggedInUser.isAdmin && existingBooking.userId !== loggedInUser.id) {
            await transaction.rollback();
            return res.status(403).json({ msg: 'Sie sind nicht berechtigt, diese Buchung zu ändern.' });
        }

        // Status Validierungen
        if (newStatusBody && (newStatusBody === 'angefragt' || (existingBooking.status === 'angefragt' && newStatusBody !== 'cancelled'))) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Status "angefragt" kann nicht direkt über PUT gesetzt oder geändert werden, außer zu "cancelled".' });
        }
        if (newStatusBody && !['booked', 'reserved', 'cancelled'].includes(newStatusBody)) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Ungültiger Statuswert für Aktualisierung.' });
        }

        // Datums Validierungen (nur wenn Daten geändert werden)
        if ((newStartDateStr && !newEndDateStr) || (!newStartDateStr && newEndDateStr)) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Bei Datumsänderung müssen Start- und Enddatum angegeben werden.' });
        }
        if (newStartDateStr && newEndDateStr && new Date(newStartDateStr) >= new Date(newEndDateStr)) {
            await transaction.rollback();
            return res.status(400).json({ msg: 'Das Enddatum muss nach dem Startdatum liegen.' });
        }

        const finalNewStartDate = newStartDateStr || existingBooking.startDate;
        const finalNewEndDate = newEndDateStr || existingBooking.endDate;
        const finalNewStatus = newStatusBody || existingBooking.status;

        let finalUserIdForUpdate = existingBooking.userId;
        let finalDisplayNameForUpdate = existingBooking.displayName;

        // Admin changing user for the booking
        if (loggedInUser.isAdmin && newTargetUserId && newTargetUserId !== existingBooking.userId) {
            const userToSet = await User.findByPk(newTargetUserId, { transaction });
            if (!userToSet) {
                await transaction.rollback();
                return res.status(404).json({ msg: 'Der angegebene neue Benutzer für die Buchung wurde nicht gefunden.' });
            }
            finalUserIdForUpdate = userToSet.id;
            finalDisplayNameForUpdate = newTargetDisplayName || userToSet.displayName; // Use provided name or new user's default
        } else if (loggedInUser.isAdmin && newTargetDisplayName && (!newTargetUserId || newTargetUserId === existingBooking.userId)) {
            // Admin changing only display name for existing user of booking
            finalDisplayNameForUpdate = newTargetDisplayName;
        } else if (!loggedInUser.isAdmin && newTargetDisplayName) {
            // Non-admin trying to update their own display name for the booking
             if (existingBooking.userId === loggedInUser.id) {
                finalDisplayNameForUpdate = newTargetDisplayName;
             }
        }


        // Determine if full re-processing is needed
        const datesChanged = newStartDateStr || newEndDateStr;
        const statusChangedToBookedOrReserved = newStatusBody && ['booked', 'reserved'].includes(newStatusBody) && newStatusBody !== existingBooking.status;
        const userChanged = newTargetUserId && newTargetUserId !== existingBooking.userId;

        if (datesChanged || statusChangedToBookedOrReserved || userChanged || (newStatusBody === 'cancelled' && existingBooking.status !== 'cancelled') ) {
             if (newStatusBody === 'cancelled') { // Handle cancellation separately and simply
                existingBooking.status = 'cancelled';
                existingBooking.displayName = finalDisplayNameForUpdate; // Allow display name update during cancellation
                await existingBooking.save({ transaction });
                 // If it was an 'angefragt' booking, related notifications might need cleanup or specific handling.
                if (existingBooking.wasAngefragt) { // Need a way to know if it was 'angefragt'
                     await Notification.destroy({ where: { relatedBookingId: existingBooking.id, type: 'overlap_request' }, transaction });
                }
                await transaction.commit();
                return res.json(existingBooking);
            }

            // For other significant changes, delete original and re-create
            const originalBookingIdForDelete = existingBooking.id;
            const originalRequestIdFromExisting = existingBooking.originalRequestId || uuidv4(); // Preserve or create new if somehow missing

            await Booking.destroy({ where: { id: originalBookingIdForDelete }, transaction });

            // If there were 'angefragt' bookings pointing to this one, they need to be handled.
            // Their originalBookingId will become NULL due to model constraints (onDelete: 'SET NULL').
            // This might mean they auto-confirm if the slot is free, or need re-evaluation.
            // For now, we'll let the SET NULL handle DB integrity. Re-evaluation is complex.
            // Also, destroy any 'overlap_request' notifications related to the booking being updated if it was primary for them.
            // This is tricky because the 'angefragt' booking holds the originalBookingId.
            // We should cancel 'angefragt' requests that were targeting the booking we just deleted if its dates change.
             await Notification.destroy({
                where: {
                    type: 'overlap_request',
                    '$relatedBooking.originalBookingId$': originalBookingIdForDelete
                },
                include: [{ model: Booking, as: 'relatedBooking' }],
                transaction
            });
             await Booking.update( //
                { status: 'cancelled', originalBookingId: null },
                { where: { originalBookingId: originalBookingIdForDelete, status: 'angefragt'}, transaction}
            );


            const newBookingSegments = await processAndCreateBookings({
                requestedStartDate: finalNewStartDate,
                requestedEndDate: finalNewEndDate,
                requestedStatus: finalNewStatus,
                userId: finalUserIdForUpdate,
                displayName: finalDisplayNameForUpdate,
                originalRequestIdIn: originalRequestIdFromExisting, // Use existing OR create new
                transaction,
                existingBookingToUpdate: null // Treat as new creation after delete
            });

            await transaction.commit();
            return res.status(200).json(newBookingSegments); // Return new segment(s)

        } else {
            // Only minor changes (e.g., admin changing display name for non-admin, no date/status change)
            existingBooking.userId = finalUserIdForUpdate;
            existingBooking.displayName = finalDisplayNameForUpdate;
            // No change to startDate, endDate, status if not part of the major reprocessing block
            await existingBooking.save({ transaction });
            await transaction.commit();
            return res.json(existingBooking);
        }

    } catch (error) {
        await transaction.rollback();
        console.error("Error updating booking:", error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ msg: "Validierungsfehler", errors: error.errors.map(e => e.message) });
        }
        res.status(500).json({ error: error.message, detail: error.stack });
    }
});

// GET /api/bookings
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
