// Importiert notwendige Teile von Sequelize
const { DataTypes } = require('sequelize');

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
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User, // Dies ist die Referenz zum User-Modell
      key: 'id',   // Verknüpft mit dem 'id'-Feld des User-Modells
    }
  }
}, {
  // Model-Optionen
  timestamps: true, // Fügt 'createdAt' und 'updatedAt' hinzu
});

// Definiert die "Eine-zu-Viele"-Beziehung: Ein User kann viele Bookings haben.
User.hasMany(Booking, { foreignKey: 'userId' });
Booking.belongsTo(User, { foreignKey: 'userId' });

// Exportiert das Booking-Modell
module.exports = Booking;
