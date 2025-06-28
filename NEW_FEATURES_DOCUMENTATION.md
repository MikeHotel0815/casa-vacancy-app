# Dokumentation: Neue Features - Zähler & Statistiken

Dieses Dokument beschreibt die neu hinzugefügten Funktionen zur Verwaltung von Zählern, Zählerständen und zur Anzeige von Statistiken.

## 1. Admin-Funktionen im Frontend

Ein neuer Admin-Bereich wurde der Anwendung hinzugefügt. Administratoren können über einen "Admin Panel"-Button in der Hauptnavigation darauf zugreifen.

Der Admin-Bereich bietet folgende Sektionen:
*   **Zähler & Ablesungen:** Verwaltung von Zählern (Erstellen, Bearbeiten, Löschen) und Erfassung von Zählerständen (inkl. Wert, Datum, optional Foto-URL und Notizen).
*   **Statistik: Auslegung:** Anzeige der monatlichen Hausauslegung (gebuchte Tage, prozentuale Auslastung) für ein wählbares Jahr.
*   **Statistik: Verbrauch:** Anzeige des monatlichen Verbrauchs für einen wählbaren Zähler und ein wählbares Jahr.

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
*   **Response (201 Created):** Das erstellte Zählerobjekt.
    ```json
    {
        "_id": "654abcdef1234567890abcd",
        "name": "Stromzähler Haupt",
        "unit": "kWh",
        "createdBy": "user_id_des_admins", // User ID des Admins
        "createdAt": "2023-11-01T10:00:00.000Z",
        "updatedAt": "2023-11-01T10:00:00.000Z",
        "__v": 0
    }
    ```

#### `GET /api/meters`
*   **Beschreibung:** Ruft alle Zähler ab.
*   **Response (200 OK):** Array von Zählerobjekten (Struktur siehe oben), inklusive populierter `createdBy` Information (displayName, email des Users).

#### `GET /api/meters/:id`
*   **Beschreibung:** Ruft einen spezifischen Zähler anhand seiner ID ab.
*   **URL Parameter:** `:id` (String, Zähler-ID).
*   **Response (200 OK):** Das Zählerobjekt, inklusive populierter `createdBy` Information.
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

#### `PUT /api/meters/:id`
*   **Beschreibung:** Aktualisiert einen bestehenden Zähler.
*   **URL Parameter:** `:id` (String, Zähler-ID).
*   **Request Body:**
    ```json
    {
      "name": "Neuer Name",
      "unit": "m³"
    }
    ```
    *   `name` (String, optional): Neuer Name des Zählers.
    *   `unit` (String, optional): Neue Einheit des Zählers.
*   **Response (200 OK):** Das aktualisierte Zählerobjekt.
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

#### `DELETE /api/meters/:id`
*   **Beschreibung:** Löscht einen Zähler und alle zugehörigen Zählerstände.
*   **URL Parameter:** `:id` (String, Zähler-ID).
*   **Response (200 OK):**
    ```json
    { "msg": "Zähler und zugehörige Zählerstände erfolgreich gelöscht." }
    ```
*   **Response (404 Not Found):** Wenn kein Zähler mit der ID existiert.

### 2.2 Zählerstände (`/api/meters/.../readings` & `/api/meters/reading/...`)

#### `POST /api/meters/:meterId/readings`
*   **Beschreibung:** Erfasst einen neuen Zählerstand für den Zähler mit `:meterId`.
*   **URL Parameter:** `:meterId` (String, ID des Zählers, zu dem der Stand gehört).
*   **Request Body:**
    ```json
    {
      "value": 1234.5,
      "date": "2023-10-26",
      "photoUrl": "https://example.com/foto.jpg",
      "notes": "Ablesung morgens"
    }
    ```
    *   `value` (Number, erforderlich): Der abgelesene Zählerstand.
    *   `date` (String, YYYY-MM-DD Format, erforderlich): Datum der Ablesung.
    *   `photoUrl` (String, optional): URL zu einem Foto des Zählerstands.
    *   `notes` (String, optional): Zusätzliche Notizen.
*   **Response (201 Created):** Das erstellte Zählerstandobjekt, inklusive populierter `meter` und `recordedBy` Informationen.
*   **Response (404 Not Found):** Wenn der zugehörige Zähler (`:meterId`) nicht existiert.

#### `GET /api/meters/:meterId/readings`
*   **Beschreibung:** Ruft alle Zählerstände für den Zähler mit `:meterId` ab (sortiert nach Datum absteigend).
*   **URL Parameter:** `:meterId` (String, ID des Zählers).
*   **Response (200 OK):** Array von Zählerstandobjekten, inklusive populierter `recordedBy` Information.
*   **Response (404 Not Found):** Wenn der Zähler nicht existiert.

#### `GET /api/meters/reading/:readingId`
*   **Beschreibung:** Ruft einen spezifischen Zählerstand anhand seiner ID (`:readingId`) ab.
*   **URL Parameter:** `:readingId` (String, ID des Zählerstands).
*   **Response (200 OK):** Das Zählerstandobjekt, inklusive populierter `meter` und `recordedBy` Informationen.
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

#### `PUT /api/meters/reading/:readingId`
*   **Beschreibung:** Aktualisiert einen bestehenden Zählerstand mit ID `:readingId`.
*   **URL Parameter:** `:readingId` (String, ID des Zählerstands).
*   **Request Body:** (Felder wie bei POST, alle optional)
*   **Response (200 OK):** Das aktualisierte Zählerstandobjekt.
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

#### `DELETE /api/meters/reading/:readingId`
*   **Beschreibung:** Löscht einen Zählerstand mit ID `:readingId`.
*   **URL Parameter:** `:readingId` (String, ID des Zählerstands).
*   **Response (200 OK):**
    ```json
    { "msg": "Zählerstand erfolgreich gelöscht." }
    ```
*   **Response (404 Not Found):** Wenn kein Zählerstand mit der ID existiert.

### 2.3 Statistiken (`/api/statistics`)

#### `GET /api/statistics/layout/:year`
*   **Beschreibung:** Ruft die Hausauslegungsstatistik für das angegebene `:year` ab.
*   **URL Parameter:** `:year` (Number, z.B. 2023).
*   **Response (200 OK):** Array von Objekten, ein Objekt pro Monat:
    ```json
    [
      {
        "year": 2023,
        "month": 1, // 1 (Januar) - 12 (Dezember)
        "bookedDays": 15,
        "totalDaysInMonth": 31,
        "occupancyRate": 48.39 // in Prozent
      }
      // ... weitere Monate
    ]
    ```

#### `GET /api/statistics/consumption/:meterId/:year`
*   **Beschreibung:** Ruft die monatliche Verbrauchsstatistik für den Zähler mit `:meterId` für das angegebene `:year` ab.
*   **URL Parameter:**
    *   `:meterId` (String, ID des Zählers).
    *   `:year` (Number, z.B. 2023).
*   **Response (200 OK):** Objekt mit Zählerdetails und monatlichen Verbrauchsdaten:
    ```json
    {
      "meterId": "654abcdef1234567890abcd",
      "meterName": "Strom Haupt",
      "unit": "kWh",
      "year": 2023,
      "monthlyConsumption": [
        {
          "month": 1, // 1 (Januar) - 12 (Dezember)
          "year": 2023,
          "consumption": 150.500, // Verbrauch in der Einheit des Zählers
          "estimated": false,     // true, wenn der Wert aufgrund fehlender Daten geschätzt wurde
          "daysWithReadings": 31.0, // Anzahl der Tage im Monat, für die Ablesedaten zur Berechnung beitrugen
          "totalDaysInMonth": 31
        }
        // ... weitere Monate
      ],
      "message": "Optional: Hinweis, falls nicht genügend Daten vorhanden sind (z.B. 'Nicht genügend Zählerstände (<2) im Zeitraum für eine Verbrauchsberechnung.')"
    }
    ```

## 3. Datenbankmodelle

*   **Meter (Mongoose Collection: `meters`):**
    *   `name`: String (Name des Zählers)
    *   `unit`: String (Einheit, z.B. kWh, m³)
    *   `createdBy`: ObjectId (Referenz zum `users` Collection/Sequelize User-Modell, Ersteller des Zählers)
    *   `createdAt`, `updatedAt`: Date (Automatische Zeitstempel)
*   **MeterReading (Mongoose Collection: `meterreadings`):**
    *   `meter`: ObjectId (Referenz zum `meters` Collection)
    *   `value`: Number (Zählerstand)
    *   `date`: Date (Datum der Ablesung)
    *   `photoUrl`: String (URL zum Foto, optional)
    *   `notes`: String (Notizen, optional)
    *   `recordedBy`: ObjectId (Referenz zum `users` Collection/Sequelize User-Modell, Erfasser des Zählerstands)
    *   `createdAt`: Date (Automatischer Zeitstempel)

## 4. Wichtige Code-Pfade

*   **Backend Routen:**
    *   `server/routes/meters.js`
    *   `server/routes/statistics.js`
*   **Backend Modelle (Mongoose):**
    *   `server/models/Meter.js`
    *   `server/models/MeterReading.js`
*   **Frontend Admin Bereich (React Komponenten):**
    *   `client/src/App.jsx` (Integration des Admin-Bereichs)
    *   `client/src/components/Admin/AdminLayout.jsx` (Hauptlayout für Admin-Seiten)
    *   `client/src/components/Admin/MeterManagement.jsx` (Verwaltung von Zählern und Zählerständen)
    *   `client/src/components/Admin/LayoutStatisticsView.jsx` (Anzeige der Hausauslegungsstatistik)
    *   `client/src/components/Admin/ConsumptionStatisticsView.jsx` (Anzeige der Verbrauchsstatistik)
*   **Backend Tests (Beispiel):**
    *   `server/tests/meters.test.js` (Grundlegende API-Tests für Zähler)

```
