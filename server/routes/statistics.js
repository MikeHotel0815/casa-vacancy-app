const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/authMiddleware');
const { Op, Sequelize } = require('sequelize'); // Sequelize für komplexere Queries
const User = require('../models/User'); // Für den Admin-Check
const Meter = require('../models/Meter'); // Mongoose Model
const MeterReading = require('../models/MeterReading'); // Mongoose Model
const mongoose = require('mongoose'); // Für ObjectId Validierung

// Admin-Check Middleware (kopiert und angepasst von meters.js)
const adminOnly = async (req, res, next) => {
  try {
    let user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ msg: 'Authentifizierung erforderlich.' });
    }
    // Überprüfen, ob der User direkt aus dem authMiddleware als Admin markiert ist
    if (user.isAdmin === true) { // Expliziter Check auf true
        return next();
    }
    // Fallback: User-Objekt aus DB laden, falls isAdmin nicht eindeutig true ist
    const userFromDb = await User.findByPk(user.id);
    if (userFromDb && userFromDb.isAdmin === true) { // Expliziter Check auf true
      req.user.isAdmin = true; // req.user für nachfolgende Checks anreichern
      return next();
    }
    return res.status(403).json({ msg: 'Zugriff verweigert. Nur für Administratoren.' });
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ msg: 'Fehler bei der Berechtigungsprüfung.' });
  }
};

// GET /api/statistics/layout/:year - Hausauslegung für ein bestimmtes Jahr (Admin only)
router.get('/layout/:year', authMiddleware, adminOnly, async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Ungültiges Jahr angegeben.' });
    }

    const startDateOfYear = new Date(Date.UTC(year, 0, 1)); // 1. Januar des Jahres, UTC
    const endDateOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)); // 31. Dezember des Jahres, UTC

    const relevantBookings = await Booking.findAll({
      where: {
        status: { [Op.in]: ['booked', 'reserved'] },
        // Filter für Buchungen, die das angegebene Jahr überschneiden
        // startDate ist VOR oder GLEICH dem Ende des Jahres UND endDate ist NACH oder GLEICH dem Anfang des Jahres
        startDate: { [Op.lte]: endDateOfYear.toISOString().split('T')[0] },
        endDate: { [Op.gte]: startDateOfYear.toISOString().split('T')[0] },
      },
      attributes: ['startDate', 'endDate', 'status'],
      order: [['startDate', 'ASC']],
    });

    const monthlyData = Array(12).fill(null).map((_, index) => ({
        month: index, // Monat (0-11, für Date-Objekt)
        bookedDays: 0,
        totalDaysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
    }));

    relevantBookings.forEach(booking => {
      // Wichtig: Booking.startDate und Booking.endDate sind Strings im Format 'YYYY-MM-DD'
      // Sie müssen korrekt in Date-Objekte (UTC) umgewandelt werden für Vergleiche
      const bookingStartParts = booking.startDate.split('-').map(Number);
      const bookingEndParts = booking.endDate.split('-').map(Number);

      // JavaScript Date Monate sind 0-indexed, also Monat - 1
      const bookingStart = new Date(Date.UTC(bookingStartParts[0], bookingStartParts[1] - 1, bookingStartParts[2]));
      const bookingEnd = new Date(Date.UTC(bookingEndParts[0], bookingEndParts[1] - 1, bookingEndParts[2]));


      for (let m = 0; m < 12; m++) { // m ist der Monat (0-11)
        const currentMonthStart = new Date(Date.UTC(year, m, 1));
        const currentMonthEnd = new Date(Date.UTC(year, m, monthlyData[m].totalDaysInMonth));

        // Bestimme den tatsächlichen Start und das Ende der Buchung innerhalb des aktuellen Jahres und Monats
        const effectiveBookingStartInPeriod = new Date(Math.max(bookingStart.getTime(), currentMonthStart.getTime()));
        const effectiveBookingEndInPeriod = new Date(Math.min(bookingEnd.getTime(), currentMonthEnd.getTime()));

        if (effectiveBookingStartInPeriod <= effectiveBookingEndInPeriod) {
          // Iteriere über die Tage der Buchung, die in diesem Monat liegen
          let dayIterator = new Date(effectiveBookingStartInPeriod);
          while(dayIterator <= effectiveBookingEndInPeriod) {
            if (dayIterator.getUTCFullYear() === year && dayIterator.getUTCMonth() === m) {
                 // Nur Tage zählen, die tatsächlich im aktuellen Jahr und Monat liegen
                 // (Sicherheitscheck, sollte durch Logik oben abgedeckt sein)
                monthlyData[m].bookedDays += 1;
            }
            dayIterator.setUTCDate(dayIterator.getUTCDate() + 1);
          }
        }
      }
    });

    const layoutStatistics = monthlyData.map(monthStats => ({
      year: year,
      month: monthStats.month + 1, // Monat zurück auf 1-12 für die Ausgabe
      bookedDays: monthStats.bookedDays,
      totalDaysInMonth: monthStats.totalDaysInMonth,
      occupancyRate: monthStats.totalDaysInMonth > 0 ? parseFloat(((monthStats.bookedDays / monthStats.totalDaysInMonth) * 100).toFixed(2)) : 0,
    }));

    res.json(layoutStatistics);

  } catch (error) {
    console.error(`Error fetching layout statistics for year ${req.params.year}:`, error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Auslegungsstatistik.' });
  }
});

// GET /api/statistics/consumption/:meterId/:year - Monatsverbräuche für einen Zähler in einem Jahr (Admin only)
router.get('/consumption/:meterId/:year', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { meterId, year: yearParam } = req.params;
    const year = parseInt(yearParam, 10);

    if (!meterId || !mongoose.Types.ObjectId.isValid(meterId)) {
        return res.status(400).json({ msg: 'Gültige Zähler-ID ist erforderlich.' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Ungültiges Jahr angegeben.' });
    }

    const meter = await Meter.findById(meterId);
    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    // Daten für den Zeitraum von Anfang Vorjahr bis Ende Folgejahr holen, um Randmonate abzudecken
    const veryStartDate = new Date(Date.UTC(year - 1, 0, 1));
    const veryEndDate = new Date(Date.UTC(year + 1, 11, 31, 23, 59, 59, 999));

    const readings = await MeterReading.find({
      meter: meterId,
      date: { $gte: veryStartDate, $lte: veryEndDate },
    }).sort({ date: 'asc' });

    const monthlyConsumption = Array(12).fill(null).map((_, index) => ({
        month: index + 1,
        year: year,
        consumption: 0,
        estimated: false,
        daysWithReadings: 0, // Tage im Monat, für die es eine Ableseperiode gab
        totalDaysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
    }));

    if (readings.length < 2) {
      monthlyConsumption.forEach(mc => mc.estimated = true); // Alle Monate als geschätzt markieren
      const message = readings.length < 1 ? 'Keine Zählerstände für diesen Zähler vorhanden.' : 'Nicht genügend Zählerstände (<2) im Zeitraum für eine Verbrauchsberechnung.';
      return res.json({
        meterName: meter.name,
        unit: meter.unit,
        year: year,
        monthlyConsumption: monthlyConsumption,
        message: message,
      });
    }

    for (let i = 0; i < readings.length - 1; i++) {
      const startReading = readings[i];
      const endReading = readings[i+1];

      const startDate = new Date(startReading.date); // Ist bereits ein Date-Objekt von Mongoose
      const endDate = new Date(endReading.date);   // Ist bereits ein Date-Objekt von Mongoose

      if (startDate.getTime() >= endDate.getTime()) continue;

      const valueDiff = endReading.value - startReading.value;
      // Ein negativer Verbrauch kann z.B. bei Zählerwechsel oder Rückspeisung (Photovoltaik) auftreten.
      // Für eine einfache Verbrauchsstatistik behandeln wir das als 0 oder überspringen es.
      // Hier wird es als 0 behandelt, um die Tage trotzdem zu zählen.
      const consumptionInPeriod = Math.max(0, valueDiff);

      const totalDaysInReadingPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (totalDaysInReadingPeriod === 0) continue;

      const averageDailyConsumption = consumptionInPeriod / totalDaysInReadingPeriod;

      let currentIterDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));

      while(currentIterDate < endDate) {
        const iterYear = currentIterDate.getUTCFullYear();
        const iterMonth = currentIterDate.getUTCMonth(); // 0-11

        if (iterYear === year) {
          // Berechne, welcher Anteil des Tages in die Ableseperiode UND den aktuellen Iterationstag fällt
          const dayStartTime = currentIterDate.getTime();
          const dayEndTime = new Date(Date.UTC(iterYear, iterMonth, currentIterDate.getUTCDate() + 1)).getTime();

          const effectiveIntervalStart = Math.max(dayStartTime, startDate.getTime());
          const effectiveIntervalEnd = Math.min(dayEndTime, endDate.getTime());

          const effectiveMillisInDay = effectiveIntervalEnd - effectiveIntervalStart;

          if (effectiveMillisInDay > 0) {
            const fractionOfDay = effectiveMillisInDay / (1000 * 60 * 60 * 24);
            monthlyConsumption[iterMonth].consumption += averageDailyConsumption * fractionOfDay;
            monthlyConsumption[iterMonth].daysWithReadings += fractionOfDay;
          }
        }
        currentIterDate.setUTCDate(currentIterDate.getUTCDate() + 1);
        if (currentIterDate.getUTCFullYear() > year + 1) break; // Sicherheitsbreak
      }
    }

    monthlyConsumption.forEach(mc => {
        mc.consumption = parseFloat(mc.consumption.toFixed(3));
        // Wenn für weniger als die Hälfte der Tage im Monat Daten vorliegen, markiere als geschätzt
        // Oder wenn es überhaupt keine Tage mit Readings gab.
        if (mc.daysWithReadings < (mc.totalDaysInMonth / 2) || mc.daysWithReadings === 0) {
             // Verfeinerung: Wenn es gar keine Readings im Jahr gab, wurde das oben abgefangen.
             // Diese Schätzung ist für Monate innerhalb eines Jahres mit spärlichen Daten.
            if (readings.length >=2 ) mc.estimated = true;
        }
         mc.daysWithReadings = parseFloat(mc.daysWithReadings.toFixed(2));
    });

    res.json({
      meterId: meter._id,
      meterName: meter.name,
      unit: meter.unit,
      year: year,
      monthlyConsumption: monthlyConsumption,
    });

  } catch (error) {
    console.error(`Error fetching consumption statistics for meter ${req.params.meterId}, year ${req.params.year}:`, error);
    res.status(500).json({ error: 'Serverfehler beim Abrufen der Verbrauchsstatistik.' });
  }
});


module.exports = router;
