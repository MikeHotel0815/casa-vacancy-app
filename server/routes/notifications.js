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
    const { response } = req.body; // Expecting "acknowledged" or "rejected_by_owner"

    if (!['acknowledged', 'rejected_by_owner'].includes(response)) {
      await transaction.rollback();
      return res.status(400).json({ msg: 'Invalid response value. Must be "acknowledged" or "rejected_by_owner".' });
    }

    const notification = await Notification.findOne({
      where: {
        id: notificationId,
        recipientUserId: req.user.id, // Ensure the user owns this notification
        type: 'overlap_request', // Only for overlap requests
      },
      include: [{ model: Booking, as: 'relatedBooking' }], // Include the 'angefragt' booking
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
        // This case should ideally not happen if data integrity is maintained
        return res.status(404).json({ msg: 'Associated booking for this notification not found.' });
    }

    notification.response = response;
    notification.isRead = true; // Mark as read when responded to
    await notification.save({ transaction });

    const angefragtBooking = notification.relatedBooking;

    if (response === 'rejected_by_owner') {
      // Change status of the 'angefragt' booking to 'cancelled'
      if (angefragtBooking.status === 'angefragt') {
        angefragtBooking.status = 'cancelled'; // Or delete it, depending on desired behavior
        await angefragtBooking.save({ transaction });

        // Optionally, notify the user who made the 'angefragt' booking about the rejection
        await Notification.create({
          recipientUserId: angefragtBooking.userId,
          type: 'overlap_rejected',
          message: `Ihre Buchungsanfrage (${angefragtBooking.startDate} bis ${angefragtBooking.endDate}) wurde von ${req.user.displayName} abgelehnt.`,
          relatedBookingId: angefragtBooking.id,
          isRead: false,
        }, { transaction });
      }
    } else if (response === 'acknowledged') {
      // The 'angefragt' booking status remains 'angefragt'. This is just an acknowledgment.
      // Optionally, notify the user who made the 'angefragt' booking that it was acknowledged (but still not confirmed)
       await Notification.create({
          recipientUserId: angefragtBooking.userId,
          type: 'overlap_acknowledged',
          message: `Ihre Buchungsanfrage (${angefragtBooking.startDate} bis ${angefragtBooking.endDate}) wurde von ${req.user.displayName} zur Kenntnis genommen, bleibt aber weiterhin angefragt.`,
          relatedBookingId: angefragtBooking.id,
          isRead: false,
        }, { transaction });
    }

    await transaction.commit();
    // Return the updated notification, and potentially the affected booking
    res.json({ notification, affectedBooking: angefragtBooking });

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


module.exports = router;
