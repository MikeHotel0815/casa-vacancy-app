const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios'); // Re-adding axios for API calls

const router = express.Router();

const schoolHolidaysFilePath = path.join(__dirname, '../data/school_holidays_he.cached.json');
const publicHolidaysFilePath = path.join(__dirname, '../data/public_holidays_he.cached.json');
const CACHE_DURATION_MONTHS = 6;

// Helper to check if cache is stale
function isCacheStale(lastFetchedTimestamp) {
  if (!lastFetchedTimestamp) return true;
  const lastFetchedDate = new Date(lastFetchedTimestamp);
  const expiryDate = new Date(lastFetchedDate);
  expiryDate.setMonth(expiryDate.getMonth() + CACHE_DURATION_MONTHS);
  return new Date() > expiryDate;
}

// Helper to read cached file
async function readCachedFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If file not found or other read error, it's fine, we'll fetch new data
    if (err.code === 'ENOENT') {
      console.log(`Cache file ${filePath} not found. Will fetch new data.`);
      return null;
    }
    console.error(`Error reading cache file ${filePath}:`, err);
    return null; // Treat other errors as cache miss
  }
}

// Helper to write to cache file
async function writeCacheFile(filePath, data) {
  try {
    const content = {
      lastFetched: new Date().toISOString(),
      holidays: data,
    };
    await fs.writeFile(filePath, JSON.stringify(content, null, 2), 'utf8');
    console.log(`Cache updated for ${filePath}`);
  } catch (err) {
    console.error(`Error writing cache file ${filePath}:`, err);
  }
}

// ---- ROUTE: GET /api/holidays/public/HE ----
router.get('/public/HE', async (req, res) => {
  let allPublicHolidays = [];
  const currentYear = new Date().getFullYear();
  const requestedYear = parseInt(req.query.year || currentYear, 10);

  try {
    const cachedData = await readCachedFile(publicHolidaysFilePath);

    if (cachedData && !isCacheStale(cachedData.lastFetched)) {
      console.log('Serving public holidays from cache for year:', requestedYear);
      allPublicHolidays = cachedData.holidays;
    } else {
      console.log('Fetching fresh public holidays for years:', currentYear, 'and', currentYear + 1);
      const [currentYearHolidaysResponse, nextYearHolidaysResponse] = await Promise.all([
        axios.get(`https://date.nager.at/api/v3/PublicHolidays/${currentYear}/DE`),
        axios.get(`https://date.nager.at/api/v3/PublicHolidays/${currentYear + 1}/DE`)
      ]);

      allPublicHolidays = [...currentYearHolidaysResponse.data, ...nextYearHolidaysResponse.data];
      // Remove duplicates if any (e.g. if an API returns overlapping data for some reason)
      const uniqueHolidays = Array.from(new Set(allPublicHolidays.map(h => h.date)))
                                  .map(date => allPublicHolidays.find(h => h.date === date));
      allPublicHolidays = uniqueHolidays;
      await writeCacheFile(publicHolidaysFilePath, allPublicHolidays);
    }

    const hessenHolidaysForYear = allPublicHolidays.filter(holiday => {
      const holidayYear = new Date(holiday.date).getFullYear();
      const isHessen = holiday.counties === null || (Array.isArray(holiday.counties) && holiday.counties.includes('DE-HE'));
      return holidayYear === requestedYear && isHessen;
    });
    res.json(hessenHolidaysForYear);

  } catch (error) {
    console.error('Fehler beim Abrufen der Feiertage (public/HE):', error.message);
    // Attempt to serve stale data if API fetch failed but cache exists and is readable
    if (error.isAxiosError) { // Check if it's an API error
        console.log("API fetch failed for public holidays. Attempting to serve from stale cache if available.");
        try {
            const staleData = await readCachedFile(publicHolidaysFilePath);
            if (staleData && staleData.holidays) {
                console.warn("Serving stale public holidays due to API error.");
                const hessenHolidaysForYear = staleData.holidays.filter(holiday => {
                    const holidayYear = new Date(holiday.date).getFullYear();
                    const isHessen = holiday.counties === null || (Array.isArray(holiday.counties) && holiday.counties.includes('DE-HE'));
                    return holidayYear === requestedYear && isHessen;
                });
                return res.json(hessenHolidaysForYear);
            }
        } catch (staleReadError) {
            console.error("Error reading stale cache for public holidays:", staleReadError.message);
        }
    }
    res.status(500).send('Fehler beim Abrufen der Feiertage.');
  }
});

// ---- ROUTE: GET /api/holidays/school/HE ----
router.get('/school/HE', async (req, res) => {
  try {
    const cachedData = await readCachedFile(schoolHolidaysFilePath);

    if (cachedData && !isCacheStale(cachedData.lastFetched)) {
      console.log('Serving school holidays from cache.');
      res.json(cachedData.holidays);
    } else {
      console.log('Fetching fresh school holidays for HE.');
      const response = await axios.get(`https://ferien-api.de/api/v1/holidays/HE`);
      await writeCacheFile(schoolHolidaysFilePath, response.data);
      res.json(response.data);
    }
  } catch (error) {
    console.error('Fehler beim Abrufen der Schulferien (school/HE):', error.message);
     // Attempt to serve stale data if API fetch failed
    if (error.isAxiosError) { // Check if it's an API error
        console.log("API fetch failed for school holidays. Attempting to serve from stale cache if available.");
        try {
            const staleData = await readCachedFile(schoolHolidaysFilePath);
            if (staleData && staleData.holidays) {
                console.warn("Serving stale school holidays due to API error.");
                return res.json(staleData.holidays);
            }
        } catch (staleReadError) {
            console.error("Error reading stale cache for school holidays:", staleReadError.message);
        }
    }
    res.status(500).send('Fehler beim Abrufen der Schulferien.');
  }
});

module.exports = router;
