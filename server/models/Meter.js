const mongoose = require('mongoose');

const meterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  unit: {
    type: String,
    required: true,
    trim: true,
  },
  // Weitere relevante Felder könnten hier hinzugefügt werden,
  // z.B. Standort, Typ (Strom, Wasser, Gas), etc.
  // Fürs Erste belassen wir es bei Name und Einheit.
  createdBy: {
    type: String, // Geändert von ObjectId zu String
    required: true,
    // ref: 'User', // Entfernt, da User in Sequelize ist
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indizes
meterSchema.index({ name: 1 });
meterSchema.index({ createdBy: 1 });

// Middleware, um updatedAt zu aktualisieren
meterSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Meter = mongoose.model('Meter', meterSchema);

module.exports = Meter;
