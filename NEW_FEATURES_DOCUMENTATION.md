# Dokumentation: Neue Features - Zähler & Statistiken (Sequelize Refactoring)

Dieses Dokument beschreibt die neu hinzugefügten Funktionen zur Verwaltung von Zählern, Zählerständen und zur Anzeige von Statistiken, **umgestellt auf Sequelize und die bestehende MariaDB-Datenbank.**

## 1. Admin-Funktionen im Frontend

Ein neuer Admin-Bereich wurde der Anwendung hinzugefügt. Administratoren können über einen "Admin Panel"-Button in der Hauptnavigation darauf zugreifen.

Der Admin-Bereich bietet folgende Sektionen:
*   **Zähler & Ablesungen:** Verwaltung von Zählern (Erstellen, Bearbeiten, Löschen) und Erfassung von Zählerständen (inkl. Wert, Datum, optional Foto-URL und Notizen).
*   **Statistik: Auslegung:** Anzeige der monatlichen Hausauslegung (gebuchte Tage, prozentuale Auslastung) für ein wählbares Jahr. (Diese Funktion basiert weiterhin auf dem bestehenden `Booking`-Modell).
*   **Statistik: Verbrauch:** Anzeige des monatlichen Verbrauchs für einen wählbaren Zähler und ein wählbares Jahr (nun basierend auf Sequelize-Modellen).

## 2. API-Endpunkte

Alle hier beschriebenen Endpunkte erfordern Authentifizierung (Bearer Token) und sind nur für Administratoren zugänglich. Die Basis-URL für die API ist die in Ihrer `.env`-Datei unter `VITE_API_URL` konfigurierte URL (z.B. `http://localhost:5000/api`).

### 2.1 Zähler (`/api/meters`)

#### `POST /api/meters`
*   **Beschreibung:** Erstellt einen neuen Zähler.
*   **Request Body:**
    ```json
    {
      "name": "Stromzähler Haupt",
      "unit": "kWh"
    }
    ```
    *   `name` (String, erforderlich): Name des Zählers.
    *   `unit` (String, erforderlich): Einheit des Zählers (z.B. kWh, m³, Stk).
*   **Response (201 Created):** Das erstellte Zählerobjekt, inklusive des `createdBy` User-Objekts (selektierte Felder).
    ```json
    {
        "id": 1, // Numerische ID von Sequelize
        "name": "Stromzähler Haupt",
        "unit": "kWh",
        "userId": 10, // Fremdschlüssel zum User
        "createdAt": "2023-11-01T10:00:00.000Z",
        "updatedAt": "2023-11-01T10:00:00.000Z",
        "createdBy": { // Assoziiertes User-Objekt (Alias 'createdBy')
            "id": 10,
            "displayName": "Admin User",
            "email": "admin@example.com"
        }
    }
    ```

#### `GET /api/meters`
*   **Beschreibung:** Ruft alle Zähler ab.
*   **Response (200 OK):** Array von Zählerobjekten (Struktur siehe oben), inklusive `createdBy` User-Informationen.

#### `GET /api/meters/:id`
*   **Beschreibung:** Ruft einen spezifischen Zähler anhand seiner ID ab.
*   **URL Parameter:** `:id` (Integer, Zähler-ID).
*   **Response (200 OK):** Das Zählerobjekt, inklusive `createdBy` User-Informationen.
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

#### `PUT /api/meters/:id`
*   **Beschreibung:** Aktualisiert einen bestehenden Zähler.
*   **URL Parameter:** `:id` (Integer, Zähler-ID).
*   **Request Body:**
    ```json
    {
      "name": "Neuer Name",
      "unit": "m³"
    }
    ```
*   **Response (200 OK):** Das aktualisierte Zählerobjekt, inklusive `createdBy` User-Informationen.
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

#### `DELETE /api/meters/:id`
*   **Beschreibung:** Löscht einen Zähler. Zugehörige Zählerstände werden aufgrund von `onDelete: 'CASCADE'` ebenfalls gelöscht.
*   **URL Parameter:** `:id` (Integer, Zähler-ID).
*   **Response (200 OK):**
    ```json
    { "msg": "Zähler und zugehörige Zählerstände erfolgreich gelöscht." }
    ```
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

### 2.2 Zählerstände (`/api/meters/.../readings` & `/api/meters/reading/...`)

#### `POST /api/meters/:meterId/readings`
*   **Beschreibung:** Erfasst einen neuen Zählerstand für den Zähler mit `:meterId`.
*   **URL Parameter:** `:meterId` (Integer, ID des Zählers).
*   **Request Body:**
    ```json
    {
      "value": 1234.5,
      "date": "2023-10-26", // YYYY-MM-DD
      "photoUrl": "https://example.com/foto.jpg",
      "notes": "Ablesung morgens"
    }
    ```
*   **Response (201 Created):** Das erstellte Zählerstandobjekt, inklusive `meter` und `recordedBy` User-Informationen.
    ```json
    {
        "id": 101,
        "value": 1234.5,
        "date": "2023-10-26",
        "photoUrl": "https://example.com/foto.jpg",
        "notes": "Ablesung morgens",
        "meterId": 1,
        "recordedByUserId": 10,
        "createdAt": "2023-11-01T10:05:00.000Z",
        "updatedAt": "2023-11-01T10:05:00.000Z",
        "recordedBy": { // Assoziiertes User-Objekt (Alias 'recordedBy')
            "id": 10,
            "displayName": "Admin User",
            "email": "admin@example.com"
        },
        "meter": { // Assoziiertes Meter-Objekt (Alias 'meter')
            "id": 1,
            "name": "Stromzähler Haupt",
            "unit": "kWh"
        }
    }
    ```
*   **Response (404 Not Found):** Wenn der zugehörige Zähler (`:meterId`) nicht existiert.

#### `GET /api/meters/:meterId/readings`
*   **Beschreibung:** Ruft alle Zählerstände für den Zähler mit `:meterId` ab (sortiert nach Datum absteigend).
*   **URL Parameter:** `:meterId` (Integer, ID des Zählers).
*   **Response (200 OK):** Array von Zählerstandobjekten, inklusive `recordedBy` User-Informationen.
*   **Response (404 Not Found):** Wenn der Zähler nicht existiert (und daher auch keine Zählerstände haben kann).

#### `GET /api/meters/reading/:readingId`
*   **Beschreibung:** Ruft einen spezifischen Zählerstand anhand seiner ID (`:readingId`) ab.
*   **URL Parameter:** `:readingId` (Integer, ID des Zählerstands).
*   **Response (200 OK):** Das Zählerstandobjekt, inklusive `meter` und `recordedBy` User-Informationen.
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

#### `PUT /api/meters/reading/:readingId`
*   **Beschreibung:** Aktualisiert einen bestehenden Zählerstand mit ID `:readingId`.
*   **URL Parameter:** `:readingId` (Integer, ID des Zählerstands).
*   **Request Body:** (Felder wie bei POST, alle optional)
*   **Response (200 OK):** Das aktualisierte Zählerstandobjekt, inklusive Details.
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

#### `DELETE /api/meters/reading/:readingId`
*   **Beschreibung:** Löscht einen Zählerstand mit ID `:readingId`.
*   **URL Parameter:** `:readingId` (Integer, ID des Zählerstands).
*   **Response (200 OK):**
    ```json
    { "msg": "Zählerstand erfolgreich gelöscht." }
    ```
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

### 2.3 Statistiken (`/api/statistics`)

#### `GET /api/statistics/layout/:year`
*   **Beschreibung:** Ruft die Hausauslegungsstatistik für das angegebene `:year` ab. (Unverändert, da `Booking` bereits Sequelize war).
*   **URL Parameter:** `:year` (Number, z.B. 2023).
*   **Response (200 OK):** (Struktur wie zuvor)

#### `GET /api/statistics/consumption/:meterId/:year`
*   **Beschreibung:** Ruft die monatliche Verbrauchsstatistik für den Zähler mit `:meterId` für das angegebene `:year` ab.
*   **URL Parameter:**
    *   `:meterId` (Integer, ID des Zählers).
    *   `:year` (Number, z.B. 2023).
*   **Response (200 OK):** Objekt mit Zählerdetails und monatlichen Verbrauchsdaten (Struktur wie zuvor, `meterId` ist nun Integer).

## 3. Datenbankmodelle (Sequelize / MariaDB)

*   **Meter (Tabelle: `Meters`):**
    *   `id`: INTEGER, Primary Key, Auto Increment
    *   `name`: STRING, Not Null
    *   `unit`: STRING, Not Null
    *   `userId`: INTEGER, Foreign Key (referenziert `Users.id`), Not Null (Ersteller)
    *   `createdAt`, `updatedAt`: DATETIME (Automatische Zeitstempel)
*   **MeterReading (Tabelle: `MeterReadings`):**
    *   `id`: INTEGER, Primary Key, Auto Increment
    *   `value`: FLOAT (oder DECIMAL), Not Null
    *   `date`: DATEONLY (YYYY-MM-DD), Not Null
    *   `photoUrl`: STRING, Nullable
    *   `notes`: TEXT, Nullable
    *   `meterId`: INTEGER, Foreign Key (referenziert `Meters.id`), Not Null, onDelete: CASCADE
    *   `recordedByUserId`: INTEGER, Foreign Key (referenziert `Users.id`), Not Null (Erfasser)
    *   `createdAt`, `updatedAt`: DATETIME (Automatische Zeitstempel)

## 4. Wichtige Code-Pfade

*   **Backend Routen:**
    *   `server/routes/meters.js` (umgestellt auf Sequelize)
    *   `server/routes/statistics.js` (Verbrauchsteil umgestellt auf Sequelize)
*   **Backend Modelle (Sequelize):**
    *   `server/models/User.js` (bestehend)
    *   `server/models/Booking.js` (bestehend)
    *   `server/models/Meter.js` (neu mit Sequelize)
    *   `server/models/MeterReading.js` (neu mit Sequelize)
    *   `server/models/index.js` (falls vorhanden, für das Sammeln der Modelle und Assoziationen)
*   **Frontend Admin Bereich (React Komponenten):**
    *   (Pfade bleiben gleich, Funktionalität sollte weitgehend kompatibel sein)
*   **Backend Tests (Beispiel):**
    *   `server/tests/meters.test.js` (muss auf Sequelize und Test-DB (z.B. SQLite) umgestellt werden)

```
