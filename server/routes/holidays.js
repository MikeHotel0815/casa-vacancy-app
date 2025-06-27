const express = require('express');
const fs = require('fs').promises; // Using promises version of fs
const path = require('path');

const router = express.Router();

const schoolHolidaysFilePath = path.join(__dirname, '../data/school_holidays_he.json');
const publicHolidaysFilePath = path.join(__dirname, '../data/public_holidays_he.json');

// Helper function to read and parse JSON file
async function readHolidaysFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Log the error for server-side inspection
    console.error(`Error reading or parsing holiday file at ${filePath}:`, err);
    // Throw a more specific error or return null/empty array to handle in route
    throw new Error(`Could not load holiday data from ${filePath}.`);
  }
}

// ---- ROUTE: GET /api/holidays/public/HE ----
// Ruft die gesetzlichen Feiertage für Hessen für ein bestimmtes Jahr aus einer lokalen Datei ab.
router.get('/public/HE', async (req, res) => {
  try {
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const allPublicHolidays = await readHolidaysFile(publicHolidaysFilePath);

    // Filter holidays for the requested year and for Hessen (DE-HE)
    // The nager.at API includes a 'counties' field. null means nationwide in Germany.
    // We need to ensure we only pick those that are either nationwide or specific to DE-HE.
    const hessenHolidaysForYear = allPublicHolidays.filter(holiday => {
      const holidayYear = new Date(holiday.date).getFullYear();
      const isHessen = holiday.counties === null || (Array.isArray(holiday.counties) && holiday.counties.includes('DE-HE'));
      return holidayYear === year && isHessen;
    });

    res.json(hessenHolidaysForYear);
  } catch (error) {
    // Error from readHolidaysFile will be caught here
    console.error('Fehler beim Abrufen der Feiertage aus Datei:', error.message);
    res.status(500).send('Fehler beim Abrufen der Feiertage.');
  }
});

// ---- ROUTE: GET /api/holidays/school/HE ----
// Ruft die Schulferien für Hessen aus einer lokalen Datei ab.
router.get('/school/HE', async (req, res) => {
  try {
    const schoolHolidays = await readHolidaysFile(schoolHolidaysFilePath);
    // If specific filtering by year or other params is needed for school holidays,
    // it can be added here. For now, returning all data from the file.
    res.json(schoolHolidays);
  } catch (error) {
    // Error from readHolidaysFile will be caught here
    console.error('Fehler beim Abrufen der Schulferien aus Datei:', error.message);
    res.status(500).send('Fehler beim Abrufen der Schulferien.');
  }
});

module.exports = router;
