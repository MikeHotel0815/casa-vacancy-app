// Importiert das Sequelize-Paket
const { Sequelize } = require('sequelize');

// Lädt die Umgebungsvariablen aus der .env-Datei
require('dotenv').config();

// --- Sequelize Konfiguration ---
// Erstellt eine neue Sequelize-Instanz und konfiguriert die Datenbankverbindung.
// Die Zugangsdaten werden sicher aus den Umgebungsvariablen gelesen.
const sequelize = new Sequelize(
  process.env.DB_NAME,      // Name der Datenbank
  process.env.DB_USER,      // Datenbank-Benutzer
  process.env.DB_PASSWORD,  // Datenbank-Passwort
  {
    host: process.env.DB_HOST, // Host der Datenbank (z.B. 'localhost')
    dialect: 'mariadb',        // Gibt an, dass wir MariaDB verwenden
    logging: false,            // Deaktiviert das Logging von SQL-Abfragen in der Konsole. Für Debugging auf `console.log` setzen.
  }
);

// Funktion zum Testen der Datenbankverbindung
const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('Verbindung zur Datenbank wurde erfolgreich hergestellt.');
  } catch (error) {
    console.error('Verbindung zur Datenbank konnte nicht hergestellt werden:', error);
  }
};

// Exportiert die Sequelize-Instanz und die Testfunktion, 
// damit sie in anderen Teilen der Anwendung (z.B. in index.js und den Models) verwendet werden können.
module.exports = { sequelize, connectDB };
