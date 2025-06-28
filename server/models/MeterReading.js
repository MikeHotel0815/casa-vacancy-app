const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
// Stelle sicher, dass User und Meter korrekt importiert werden,
// um Zirkelbezüge beim Start zu vermeiden, kann es manchmal helfen,
// die Assoziationen in einer separaten Datei oder nach der Definition aller Modelle zu setzen.
// Für dieses Beispiel gehen wir davon aus, dass die Reihenfolge der Imports und Definitionen passt.
const User = require('./User');
const Meter = require('./Meter');

const MeterReading = sequelize.define('MeterReading', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  value: {
    type: DataTypes.FLOAT, // FLOAT ist in MariaDB/MySQL oft DOUBLE. DECIMAL wäre genauer.
    allowNull: false,
    validate: {
      isFloat: { // Stellt sicher, dass es eine Zahl ist
        msg: "Zählerstand muss eine gültige Zahl sein."
      }
    }
  },
  date: {
    type: DataTypes.DATEONLY, // Speichert nur YYYY-MM-DD
    allowNull: false,
    validate: {
      isDate: {
        msg: "Datum muss ein gültiges Datum sein."
      }
    }
  },
  photoUrl: {
    type: DataTypes.STRING, // Kann die URL zum Bild speichern
    allowNull: true,
    validate: {
      isUrl: {
        msg: "Foto-URL muss eine gültige URL sein.",
        // Diese Validierung ist optional, da das Feld ohnehin null sein darf.
        // Wenn eine URL angegeben wird, sollte sie gültig sein.
        // Jedoch akzeptiert isUrl:true auch leere Strings nicht, was hier okay ist, wenn es null sein darf.
      }
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  // meterId wird durch die Assoziation unten hinzugefügt
  // recordedByUserId wird durch die Assoziation unten hinzugefügt
});

// Assoziationen:

// Ein Zähler (Meter) kann viele Zählerstände (MeterReadings) haben
Meter.hasMany(MeterReading, {
  foreignKey: {
    name: 'meterId',
    allowNull: false,
  },
  as: 'readings', // Alias, um auf die Zählerstände eines Zählers zuzugreifen
  onDelete: 'CASCADE', // Wenn ein Zähler gelöscht wird, werden auch seine Zählerstände gelöscht
});
// Ein Zählerstand (MeterReading) gehört zu genau einem Zähler (Meter)
MeterReading.belongsTo(Meter, {
  foreignKey: {
    name: 'meterId',
    allowNull: false,
  },
  as: 'meter', // Alias, um auf den zugehörigen Zähler zuzugreifen
});


// Ein User (Erfasser) kann viele Zählerstände erfasst haben
User.hasMany(MeterReading, {
  foreignKey: {
    name: 'recordedByUserId', // Dies erstellt eine Spalte 'recordedByUserId' in der 'MeterReadings'-Tabelle
    allowNull: false,
  },
  as: 'recordedReadings', // Alias, um auf die erfassten Zählerstände eines Users zuzugreifen
});
// Ein Zählerstand (MeterReading) wurde von genau einem User erfasst
MeterReading.belongsTo(User, {
  foreignKey: {
    name: 'recordedByUserId',
    allowNull: false,
  },
  as: 'recordedBy', // Alias, um auf den Erfasser eines Zählerstands zuzugreifen
});

module.exports = MeterReading;
