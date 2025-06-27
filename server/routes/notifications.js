const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Notification = require('../models/Notification');
const Booking = require('../models/Booking');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const { sequelize } = require('../config/database');

// GET /api/notifications - Fetches all notifications for the authenticated user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { recipientUserId: req.user.id },
      include: [
        {
          model: Booking,
          as: 'relatedBooking',
          include: [{ model: User, as: 'User', attributes: ['id', 'displayName'] }] // User who made the 'angefragt' booking
        }
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notifications/:id/respond - Allows the recipient to respond to an 'overlap_request'
router.post('/:id/respond', authMiddleware, async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const notificationId = req.params.id;
    const { action } = req.body; // Expecting "approved" or "rejected"

    if (!['approved', 'rejected'].includes(action)) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Invalid action value. Must be "approved" or "rejected".' });
    }

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientUserId: req.user.id,
        type: 'overlap_request',
      },
      include: [
        {
          model: Booking,
          as: 'relatedBooking', // This is the 'angefragt' booking
          include: [{ model: User, as: 'User', attributes: ['id', 'displayName'] }] // User who made the 'angefragt' booking
        }
      ],
      transaction
    });

    if (!notification) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'Notification not found or not applicable for response.' });
    }

    if (notification.response !== 'pending') {
      await transaction.rollback();
      return res.status(400).json({ msg: 'This notification has already been responded to.' });
    }

    if (!notification.relatedBooking) {
      await transaction.rollback();
      return res.status(404).json({ msg: 'Associated "angefragt" booking for this notification not found.' });
    }
    if (notification.relatedBooking.status !== 'angefragt') {
      await transaction.rollback();
      return res.status(400).json({ msg: 'The associated booking is not in "angefragt" status.' });
    }

    const angefragtBooking = notification.relatedBooking;
    const requester = angefragtBooking.User; // User who made the 'angefragt' request

    console.log(`[notifications.js respond] Geladene angefragtBooking ID ${angefragtBooking.id}: Start ${angefragtBooking.startDate}, Ende ${angefragtBooking.endDate}, Status ${angefragtBooking.status}`);

    notification.isRead = true; // Mark as read when responded to

    if (action === 'rejected') {
      notification.response = 'rejected_by_owner';
      await notification.save({ transaction });

      angefragtBooking.status = 'cancelled';
      console.log(`[notifications.js respond] Vor Speichern (rejected): angefragtBooking ID ${angefragtBooking.id} wird zu Status ${angefragtBooking.status}`);
      await angefragtBooking.save({ transaction });

      // Notify the requester about the rejection
      await Notification.create({
        recipientUserId: angefragtBooking.userId,
        type: 'overlap_rejected',
        message: `Ihre Buchungsanfrage für ${angefragtBooking.startDate} bis ${angefragtBooking.endDate} wurde von ${req.user.displayName} abgelehnt.`,
        relatedBookingId: angefragtBooking.id,
      }, { transaction });

      await transaction.commit();
      return res.json({ message: 'Buchungsanfrage abgelehnt.', notification, angefragtBooking });

    } else if (action === 'approved') {
      notification.response = 'acknowledged'; // 'acknowledged' by primary booker means approved for the requester
      await notification.save({ transaction });

      const primaryBookingId = angefragtBooking.originalBookingId;
      if (!primaryBookingId) {
        await transaction.rollback();
        return res.status(500).json({ msg: 'Fehler: "angefragt" Buchung hat keine originalBookingId.' });
      }

      const primaryBooking = await Booking.findByPk(primaryBookingId, { transaction });
      if (!primaryBooking) {
        await transaction.rollback();
        // This could happen if the primary booking was deleted after the 'angefragt' was created.
        // In this scenario, the 'angefragt' booking can simply become 'booked'.
        angefragtBooking.status = 'booked';
        angefragtBooking.originalBookingId = null; // No longer contingent
        await angefragtBooking.save({ transaction });

        await Notification.create({
          recipientUserId: angefragtBooking.userId,
          type: 'overlap_confirmed',
          message: `Ihre Buchungsanfrage für ${angefragtBooking.startDate} bis ${angefragtBooking.endDate} wurde bestätigt, da die ursprüngliche Buchung nicht mehr existiert.`,
          relatedBookingId: angefragtBooking.id,
        }, { transaction });

        await transaction.commit();
        return res.json({ message: 'Buchungsanfrage bestätigt (primäre Buchung existierte nicht mehr).', notification, angefragtBooking });
      }

      // Primary booking exists, now adjust it.
      const angefragtStart = new Date(angefragtBooking.startDate);
      const angefragtEnd = new Date(angefragtBooking.endDate);
      const primaryStart = new Date(primaryBooking.startDate);
      const primaryEnd = new Date(primaryBooking.endDate);

      // Case 1: Angefragt booking completely covers the primary booking
      if (angefragtStart <= primaryStart && angefragtEnd >= primaryEnd) {
        primaryBooking.status = 'cancelled'; // Or delete: await primaryBooking.destroy({ transaction });
        await primaryBooking.save({transaction});
      }
      // Case 2: Angefragt booking is at the start of the primary booking
      else if (angefragtStart <= primaryStart && angefragtEnd < primaryEnd) {
        primaryBooking.startDate = angefragtBooking.endDate; // endDate is exclusive, so next day is correct
        await primaryBooking.save({transaction});
      }
      // Case 3: Angefragt booking is at the end of the primary booking
      else if (angefragtStart > primaryStart && angefragtEnd >= primaryEnd) {
        primaryBooking.endDate = angefragtBooking.startDate; // startDate is inclusive, so previous day is correct
        await primaryBooking.save({transaction});
      }
      // Case 4: Angefragt booking is in the middle of the primary booking (split)
      else if (angefragtStart > primaryStart && angefragtEnd < primaryEnd) {
        const originalPrimaryEndDate = primaryBooking.endDate;
        primaryBooking.endDate = angefragtBooking.startDate; // Shorten the first part
        await primaryBooking.save({transaction});

        // Create a new booking for the second part
        await Booking.create({
          startDate: angefragtBooking.endDate,
          endDate: originalPrimaryEndDate,
          userId: primaryBooking.userId,
          displayName: primaryBooking.displayName,
          status: primaryBooking.status, // Keep original status
          originalRequestId: primaryBooking.originalRequestId, // Keep track of original request if it was part of one
          isSplit: true, // This new segment is a result of a split
        }, { transaction });
      } else {
        // This should not happen if overlap logic is correct, but as a fallback:
        await transaction.rollback();
        return res.status(500).json({msg: "Logikfehler bei der Anpassung der primären Buchung."});
      }

      // Validate primary booking(s) after modification (ensure startDate <= endDate)
      // A booking where startDate > endDate is invalid and should be cancelled.
      // A booking where startDate = endDate is a valid single-day booking.
      if (new Date(primaryBooking.startDate) > new Date(primaryBooking.endDate) && primaryBooking.status !== 'cancelled') {
         // If modification made it invalid (start is after end), consider it cancelled.
        if (primaryBooking.status !== 'cancelled') { // ensure not already cancelled
            primaryBooking.status = 'cancelled';
            await primaryBooking.save({ transaction });
        }
      }


      // Update the 'angefragt' booking to 'booked'
      angefragtBooking.status = 'booked';
      angefragtBooking.originalBookingId = null; // No longer contingent
      console.log(`[notifications.js respond] Vor Speichern (approved): angefragtBooking ID ${angefragtBooking.id} (${angefragtBooking.startDate} - ${angefragtBooking.endDate}) wird zu Status ${angefragtBooking.status}`);
      await angefragtBooking.save({ transaction });

      // Notify the requester
      await Notification.create({
        recipientUserId: angefragtBooking.userId,
        type: 'overlap_confirmed',
        message: `Ihre Buchungsanfrage (${angefragtBooking.startDate} bis ${angefragtBooking.endDate}) wurde von ${req.user.displayName} bestätigt.`,
        relatedBookingId: angefragtBooking.id,
      }, { transaction });

      // Notify the primary booker (self-notification for action confirmation)
      await Notification.create({
        recipientUserId: req.user.id, // The one who approved
        type: 'overlap_resolution_notice',
        message: `Sie haben die überschneidende Buchungsanfrage von ${requester.displayName} (${angefragtBooking.startDate} bis ${angefragtBooking.endDate}) genehmigt. Ihre ursprüngliche Buchung wurde entsprechend angepasst.`,
        relatedBookingId: primaryBooking.id, // Relate to their original (now possibly modified) booking
      }, { transaction });
    }

    await transaction.commit();
    res.json({ message: `Aktion "${action}" erfolgreich durchgeführt.`, notification, affectedBooking: angefragtBooking });

  } catch (error) {
    await transaction.rollback();
    console.error("Error responding to notification:", error);
    res.status(500).json({ error: error.message, detail: error.stack });
  }
});


// POST /api/notifications/:id/mark-read - Marks a notification as read
router.post('/:id/mark-read', authMiddleware, async (req, res) => {
    try {
        const notificationId = req.params.id;
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                recipientUserId: req.user.id,
            }
        });

        if (!notification) {
            return res.status(404).json({ msg: 'Notification not found.' });
        }

        notification.isRead = true;
        await notification.save();
        res.json(notification);

    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/notifications/:id - Deletes a notification for the authenticated user
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.id;

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientUserId: userId,
      },
    });

    if (!notification) {
      return res.status(404).json({ msg: 'Benachrichtigung nicht gefunden oder nicht autorisiert.' });
    }

    await notification.destroy();
    res.status(204).send(); // 204 No Content, standard for successful DELETE with no body

  } catch (error) {
    console.error("Fehler beim Löschen der Benachrichtigung:", error);
    res.status(500).json({ error: error.message });
  }
});


module.exports = router;
