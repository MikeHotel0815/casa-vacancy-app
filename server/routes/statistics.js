const express = require('express');
const router = express.Router();
const { Booking, Meter, MeterReading, User } = require('../models'); // Sequelize Modelle
const authMiddleware = require('../middleware/authMiddleware');
const { Op, Sequelize, fn, col, literal } = require('sequelize'); // Sequelize für komplexere Queries

// Admin-Check Middleware
const adminOnly = async (req, res, next) => {
  try {
    let user = req.user;
    if (!user || !user.id) {
      return res.status(401).json({ msg: 'Authentifizierung erforderlich.' });
    }
    if (user.isAdmin === true) {
        return next();
    }
    const userFromDb = await User.findByPk(user.id);
    if (userFromDb && userFromDb.isAdmin) {
      req.user.isAdmin = true;
      return next();
    }
    return res.status(403).json({ msg: 'Zugriff verweigert. Nur für Administratoren.' });
  } catch (error) {
    console.error("Admin check error:", error);
    return res.status(500).json({ msg: 'Fehler bei der Berechtigungsprüfung.' });
  }
};

// GET /api/statistics/layout/:year - Hausauslegung für ein bestimmtes Jahr (Admin only)
// Diese Route bleibt im Wesentlichen gleich, da Booking bereits ein Sequelize-Modell ist.
// Lediglich die Datumsbehandlung wird hier auf UTC für Konsistenz geprüft/angepasst.
router.get('/layout/:year', authMiddleware, adminOnly, async (req, res) => {
  try {
    const year = parseInt(req.params.year, 10);
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Ungültiges Jahr angegeben.' });
    }

    const startDateOfYearStr = `${year}-01-01`;
    const endDateOfYearStr = `${year}-12-31`;

    const relevantBookings = await Booking.findAll({
      where: {
        status: { [Op.in]: ['booked', 'reserved'] },
        startDate: { [Op.lte]: endDateOfYearStr },
        endDate: { [Op.gte]: startDateOfYearStr },
      },
      attributes: ['startDate', 'endDate'], // Status wird nicht mehr für die Berechnung benötigt
      order: [['startDate', 'ASC']],
    });

    const monthlyData = Array(12).fill(null).map((_, index) => ({
        month: index, // 0-11
        bookedDays: 0,
        totalDaysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate() // Tage im Monat in UTC
    }));

    relevantBookings.forEach(booking => {
      const bookingStart = new Date(booking.startDate); // Ist DATEONLY, wird als Mitternacht UTC interpretiert
      const bookingEnd = new Date(booking.endDate);     // Ist DATEONLY, wird als Mitternacht UTC interpretiert

      for (let m = 0; m < 12; m++) { // m ist der Monat (0-11)
        const currentMonthStart = new Date(Date.UTC(year, m, 1));
        const currentMonthEnd = new Date(Date.UTC(year, m, monthlyData[m].totalDaysInMonth, 23, 59, 59, 999)); // Ende des Tages UTC

        const effectiveBookingStartInPeriod = new Date(Math.max(bookingStart.getTime(), currentMonthStart.getTime()));
        // Für das Ende der Buchung +1 Tag addieren, da endDate inklusiv ist für die Tageszählung
        const effectiveBookingEndInPeriod = new Date(Math.min(new Date(bookingEnd.getTime() + 24*60*60*1000).getTime(), currentMonthEnd.getTime()));


        if (effectiveBookingStartInPeriod < effectiveBookingEndInPeriod) { // Strikter Vergleich <, da wir Tage zählen
          let dayIterator = new Date(effectiveBookingStartInPeriod);
          while(dayIterator < effectiveBookingEndInPeriod && dayIterator.getUTCFullYear() === year && dayIterator.getUTCMonth() === m) {
             monthlyData[m].bookedDays += 1;
             dayIterator.setUTCDate(dayIterator.getUTCDate() + 1);
          }
        }
      }
    });

    const layoutStatistics = monthlyData.map(monthStats => ({
      year: year,
      month: monthStats.month + 1,
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
    const meterIdInt = parseInt(meterId, 10);


    if (isNaN(meterIdInt) || meterIdInt <= 0) {
        return res.status(400).json({ msg: 'Gültige numerische Zähler-ID ist erforderlich.' });
    }
    if (isNaN(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ msg: 'Ungültiges Jahr angegeben.' });
    }

    const meter = await Meter.findByPk(meterIdInt);
    if (!meter) {
      return res.status(404).json({ msg: 'Zähler nicht gefunden.' });
    }

    // Sequelize DATEONLY speichert als 'YYYY-MM-DD'.
    // Für Vergleiche mit Op.gte/lte ist es am sichersten, Strings in diesem Format zu verwenden.
    const veryStartDateStr = `${year - 1}-01-01`;
    const veryEndDateStr = `${year + 1}-12-31`;

    const readings = await MeterReading.findAll({
      where: {
        meterId: meterIdInt,
        date: { // Datumsvergleich für DATEONLY
          [Op.gte]: veryStartDateStr,
          [Op.lte]: veryEndDateStr,
        },
      },
      order: [['date', 'ASC']], // Wichtig für die Differenzbildung
    });

    const monthlyConsumption = Array(12).fill(null).map((_, index) => ({
        month: index + 1, // 1-12
        year: year,
        consumption: 0,
        estimated: false,
        daysWithReadings: 0,
        totalDaysInMonth: new Date(Date.UTC(year, index + 1, 0)).getUTCDate()
    }));

    if (readings.length < 2) {
      monthlyConsumption.forEach(mc => mc.estimated = true);
      const message = readings.length < 1 ? 'Keine Zählerstände für diesen Zähler vorhanden.' : 'Nicht genügend Zählerstände (<2) im Zeitraum für eine Verbrauchsberechnung.';
      return res.json({
        meterId: meter.id,
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

      // 'date' ist ein String 'YYYY-MM-DD' von Sequelize DATEONLY
      const startDate = new Date(startReading.date + 'T00:00:00Z'); // Als UTC interpretieren
      const endDate = new Date(endReading.date + 'T00:00:00Z');   // Als UTC interpretieren

      if (startDate.getTime() >= endDate.getTime()) continue;

      const valueDiff = endReading.value - startReading.value;
      const consumptionInPeriod = Math.max(0, valueDiff);

      // Differenz in Millisekunden, dann in Tage umrechnen
      const totalMsInReadingPeriod = endDate.getTime() - startDate.getTime();
      const totalDaysInReadingPeriod = totalMsInReadingPeriod / (1000 * 60 * 60 * 24);

      if (totalDaysInReadingPeriod === 0) continue;

      const averageDailyConsumption = consumptionInPeriod / totalDaysInReadingPeriod;

      let currentIterDate = new Date(startDate); // Start der Iteration

      while(currentIterDate.getTime() < endDate.getTime()) { // Iteriere bis zum Tag vor endDate
        const iterYear = currentIterDate.getUTCFullYear();
        const iterMonth = currentIterDate.getUTCMonth(); // 0-11

        if (iterYear === year) {
          const dayStartTime = currentIterDate.getTime();
          const nextDayDate = new Date(currentIterDate);
          nextDayDate.setUTCDate(nextDayDate.getUTCDate() + 1);
          const dayEndTime = nextDayDate.getTime();

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
        if (currentIterDate.getUTCFullYear() > year + 1 && currentIterDate.getUTCMonth() > 0) break;
      }
    }

    monthlyConsumption.forEach(mc => {
        mc.consumption = parseFloat(mc.consumption.toFixed(3));
        if (mc.daysWithReadings < (mc.totalDaysInMonth / 2) || mc.daysWithReadings === 0) {
            if (readings.length >=2 ) mc.estimated = true;
        }
         mc.daysWithReadings = parseFloat(mc.daysWithReadings.toFixed(1));
    });

    res.json({
      meterId: meter.id,
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
