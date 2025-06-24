// Lädt Umgebungsvariablen aus der .env-Datei
require('dotenv').config();

// Importiert die Kern-Pakete
const express = require('express');
const cors = require('cors');

// Importiert unsere eigenen Module
const { sequelize, connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const holidayRoutes = require('./routes/holidays');

// --- Initialisierung ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middlewares ---
// Aktiviert CORS, damit unser React-Frontend (von einem anderen Port) Anfragen stellen kann
app.use(cors()); 
// Ermöglicht dem Server, JSON-formatierte Request-Bodies zu lesen
app.use(express.json()); 

// --- API-Routen ---
// Alle Authentifizierungs-Routen werden unter dem Präfix /api/auth erreichbar sein
app.use('/api/auth', authRoutes);
// Alle Buchungs-Routen werden unter /api/bookings erreichbar sein
app.use('/api/bookings', bookingRoutes);
// Alle Feiertags- und Ferien-Routen werden unter /api/holidays erreichbar sein
app.use('/api/holidays', holidayRoutes);

// --- Server-Start und Datenbank-Synchronisation ---
const startServer = async () => {
  try {
    // 1. Verbindung zur Datenbank testen
    await connectDB();
    
    // 2. Modelle mit der Datenbank synchronisieren.
    // {force: false} bedeutet, dass Tabellen nicht gelöscht und neu erstellt werden, wenn sie bereits existieren.
    // Für die Entwicklung kann man {force: true} nutzen, um bei jeder Änderung am Modell die DB neu aufzubauen.
    await sequelize.sync({ force: false }); 
    console.log('Datenbank-Tabellen wurden erfolgreich synchronisiert.');

    // 3. Den Server starten
    app.listen(PORT, () => {
      console.log(`Server läuft auf Port ${PORT}`);
    });
  } catch (error) {
    console.error('Fehler beim Starten des Servers:', error);
    process.exit(1); // Beendet den Prozess bei einem kritischen Fehler
  }
};

// Server starten
startServer();
