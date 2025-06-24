const express = require('express');
const axios = require('axios');

const router = express.Router();

// ---- ROUTE: GET /api/holidays/public/HE ----
// Ruft die gesetzlichen Feiertage für Hessen für ein bestimmtes Jahr ab.
router.get('/public/HE', async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const response = await axios.get(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
    const hessenHolidays = response.data.filter(holiday => holiday.counties === null || holiday.counties.includes('DE-HE'));
    res.json(hessenHolidays);
  } catch (error) {
    console.error('Fehler beim Abrufen der Feiertage:', error.message);
    res.status(500).send('Fehler beim Abrufen der Feiertage.');
  }
});

// ---- ROUTE: GET /api/holidays/school/HE ----
// Ruft die Schulferien für Hessen ab.
router.get('/school/HE', async (req, res) => {
  try {
    // KORREKTUR: Wir fragen nicht mehr nach einem spezifischen Jahr, 
    // sondern rufen alle verfügbaren Ferien ab, um Fehler bei zukünftigen Jahren zu vermeiden.
    const response = await axios.get(`https://ferien-api.de/api/v1/holidays/HE`);
    res.json(response.data);
  } catch (error) {
    console.error('Fehler beim Abrufen der Schulferien:', error.message);
    res.status(500).send('Fehler beim Abrufen der Schulferien.');
  }
});

module.exports = router;
