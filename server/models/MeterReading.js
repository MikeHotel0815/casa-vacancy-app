const mongoose = require('mongoose');

const meterReadingSchema = new mongoose.Schema({
  meter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meter',
    required: true,
  },
  value: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  photoUrl: { // URL zum hochgeladenen Foto
    type: String,
    trim: true,
  },
  notes: { // Optionale Notizen zum Zählerstand
    type: String,
    trim: true,
  },
  recordedBy: {
    type: String, // Geändert von ObjectId zu String
    required: true,
    // ref: 'User', // Entfernt, da User in Sequelize ist
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indizes
meterReadingSchema.index({ meter: 1, date: -1 }); // Wichtig für das Abrufen von Readings pro Zähler, sortiert nach Datum
meterReadingSchema.index({ recordedBy: 1 });
meterReadingSchema.index({ date: 1 }); // Allgemeiner Index auf Datum


const MeterReading = mongoose.model('MeterReading', meterReadingSchema);

module.exports = MeterReading;
