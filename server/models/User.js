// Importiert notwendige Teile von Sequelize
const { DataTypes } = require('sequelize');

// Importiert die konfigurierte Sequelize-Instanz aus unserer Datenbank-Konfigurationsdatei
const { sequelize } = require('../config/database');

// Definiert das 'User'-Modell
const User = sequelize.define('User', {
  // Das Feld 'id' wird von Sequelize automatisch als Primärschlüssel (INTEGER, AUTO_INCREMENT) hinzugefügt.
  displayName: {
    type: DataTypes.STRING,
    allowNull: false, // Anzeigename ist ein Pflichtfeld
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false, // E-Mail ist ein Pflichtfeld
    unique: true,     // Jede E-Mail-Adresse darf nur einmal vorkommen
    validate: {
      isEmail: true,  // Überprüft, ob der Wert ein gültiges E-Mail-Format hat
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false, // Passwort ist ein Pflichtfeld
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // Standardmäßig kein Admin
  },
}, {
  // Model-Optionen
  timestamps: true, // Fügt die Felder 'createdAt' und 'updatedAt' automatisch hinzu
});

// Exportiert das User-Modell, damit es im Rest der Anwendung verwendet werden kann
module.exports = User;
