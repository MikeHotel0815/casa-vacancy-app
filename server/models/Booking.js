// Importiert notwendige Teile von Sequelize
const { DataTypes, UUIDV4 } = require('sequelize');

// Importiert die konfigurierte Sequelize-Instanz und das User-Modell
const { sequelize } = require('../config/database');
const User = require('./User'); // Wichtig für die Verknüpfung

// Definiert das 'Booking'-Modell
const Booking = sequelize.define('Booking', {
  // Das Feld 'id' wird von Sequelize automatisch als Primärschlüssel hinzugefügt.
  
  startDate: {
    type: DataTypes.DATEONLY, // Speichert nur das Datum, ohne Uhrzeit
    allowNull: false,         // Startdatum ist ein Pflichtfeld
  },
  endDate: {
    type: DataTypes.DATEONLY, // Speichert nur das Datum, ohne Uhrzeit
    allowNull: false,         // Enddatum ist ein Pflichtfeld
  },
  // Hinzugefügtes Feld für den Anzeigenamen des buchenden Benutzers.
  // Dies ist eine Denormalisierung zur Vereinfachung der Anzeige im Frontend.
  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: { // Hinzugefügtes Feld für den Buchungsstatus
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'booked',
    validate: {
      isIn: [['booked', 'reserved', 'angefragt', 'cancelled']], // 'angefragt' und 'cancelled' hinzugefügt
    },
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User, // Dies ist die Referenz zum User-Modell
      key: 'id',   // Verknüpft mit dem 'id'-Feld des User-Modells
    }
  },
  originalBookingId: { // Für 'angefragt' Status, verweist auf die primäre Buchung
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Bookings', // Name der Tabelle
      key: 'id',
    },
    onDelete: 'SET NULL', // Wenn die ursprüngliche Buchung gelöscht wird, wird dieses Feld auf NULL gesetzt
    onUpdate: 'CASCADE',
  },
  isSplit: { // Zeigt an, ob diese Buchung ein Teil einer aufgeteilten Anfrage ist
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  originalRequestId: { // Eindeutige ID für die ursprüngliche Buchungsanfrage des Benutzers
    type: DataTypes.UUID,
    allowNull: true, // Kann null sein für Buchungen, die vor dieser Logik erstellt wurden
  }
}, {
  // Model-Optionen
  timestamps: true, // Fügt 'createdAt' und 'updatedAt' hinzu
});

// Definiert die "Eine-zu-Viele"-Beziehung: Ein User kann viele Bookings haben.
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

// Self-referencing Foreign Key für originalBookingId
// Eine Buchung (angefragt) kann sich auf eine andere (originale) Buchung beziehen.
Booking.belongsTo(Booking, { as: 'OriginalBooking', foreignKey: 'originalBookingId', constraints: false, allowNull: true });
Booking.hasMany(Booking, { as: 'OverlapRequests', foreignKey: 'originalBookingId', constraints: false, allowNull: true });


// Exportiert das Booking-Modell
module.exports = Booking;
