const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const Booking = require('./Booking');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  recipientUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  type: {
    type: DataTypes.STRING, // e.g., 'overlap_request', 'overlap_rejected', 'overlap_confirmed_ack'
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  relatedBookingId: { // The 'angefragt' booking, or the primary booking that caused the notification
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: Booking,
      key: 'id',
    },
    onDelete: 'SET NULL', // If related booking is deleted, keep notification but nullify link
  },
  overlapStartTime: { // Specific start time of the conflict/request
    type: DataTypes.DATE,
    allowNull: true,
  },
  overlapEndTime: { // Specific end time of the conflict/request
    type: DataTypes.DATE,
    allowNull: true,
  },
  response: { // For 'overlap_request' type, stores the primary booker's response
    type: DataTypes.STRING, // e.g., 'pending', 'acknowledged', 'rejected_by_owner'
    defaultValue: 'pending',
    allowNull: false,
    validate: {
      isIn: [['pending', 'acknowledged', 'rejected_by_owner']],
    }
  }
}, {
  timestamps: true,
});

// Associations
User.hasMany(Notification, { foreignKey: 'recipientUserId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'recipientUserId', as: 'recipient' });

Booking.hasMany(Notification, { foreignKey: 'relatedBookingId', as: 'relatedNotifications' });
Notification.belongsTo(Booking, { foreignKey: 'relatedBookingId', as: 'relatedBooking' });

module.exports = Notification;
