const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User'); // Import User model for association

const Meter = sequelize.define('Meter', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: "Name darf nicht leer sein."
      }
    }
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: "Einheit darf nicht leer sein."
      }
    }
  },
  // userId wird als Fremdschlüssel durch die Assoziation unten hinzugefügt.
  // Es ist wichtig, dass die Assoziation korrekt definiert ist.
});

// Assoziation: Ein Meter wurde von einem User erstellt
// User (Ersteller) kann viele Meter haben
User.hasMany(Meter, {
  foreignKey: {
    name: 'userId', // Dies erstellt eine Spalte 'userId' in der 'Meters'-Tabelle
    allowNull: false,
  },
  as: 'createdMeters', // Alias, um auf die erstellten Zähler eines Users zuzugreifen
});
// Ein Meter gehört zu einem User (Ersteller)
Meter.belongsTo(User, {
  foreignKey: {
    name: 'userId',
    allowNull: false,
  },
  as: 'createdBy', // Alias, um auf den Ersteller eines Zählers zuzugreifen
});


module.exports = Meter;
