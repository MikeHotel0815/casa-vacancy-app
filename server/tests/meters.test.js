// server/tests/meters.test.js
const request = require('supertest');
const express = require('express');
const meterRoutes = require('../routes/meters');
const { sequelize } = require('../config/database'); // Echte Sequelize-Instanz
const { User, Meter, MeterReading } = require('../models'); // Echte Sequelize-Modelle

let app;
let adminUser, normalUser;
let adminToken = 'ADMIN_TOKEN_VALID'; // Muss mit Mock übereinstimmen
let normalUserToken = 'USER_TOKEN_VALID'; // Muss mit Mock übereinstimmen

// Mock authMiddleware (bleibt ähnlich, stellt sicher, dass User-IDs korrekt sind)
jest.mock('../middleware/authMiddleware', () => jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token === 'ADMIN_TOKEN_VALID') {
            req.user = { id: 1, isAdmin: true, displayName: 'Admin Test' }; // Annahme: Admin hat ID 1
        } else if (token === 'USER_TOKEN_VALID') {
            req.user = { id: 2, isAdmin: false, displayName: 'Normal User' }; // Annahme: User hat ID 2
        }
    }
    next();
}));

// Mock User.findByPk (wird von adminOnly Middleware verwendet)
const mockUserFindByPk = jest.fn();
// Um das User-Modul korrekt zu mocken, wenn es bereits von anderen Modulen geladen wurde,
// ist es oft besser, dies ganz am Anfang der Testdatei oder in einer separaten __mocks__ Datei zu tun.
// Für dieses Beispiel versuchen wir es direkt hier.
jest.mock('../models/User', () => {
    const actualUser = jest.requireActual('../models/User');
    return {
      ...actualUser,
      findByPk: (id) => mockUserFindByPk(id),
      // Wichtig: Wenn Assoziationen wie User.hasMany in User.js definiert sind,
      // muss der Mock diese Logik nicht replizieren, da wir das 'echte' Modell für den Rest verwenden.
      // Sequelize kümmert sich um Assoziationen basierend auf den Modelldefinitionen.
    };
});


beforeAll(async () => {
    // WICHTIG: Stellen Sie sicher, dass Ihre server/config/database.js
    // für process.env.NODE_ENV === 'test' eine SQLite In-Memory DB verwendet.
    // Beispiel in database.js:
    // if (process.env.NODE_ENV === 'test') {
    //   sequelize = new Sequelize('sqlite::memory:', { logging: false });
    // } else { ... normale Konfiguration ... }
    if (process.env.NODE_ENV !== 'test') {
        // console.warn("WARNUNG: Tests sollten mit NODE_ENV=test ausgeführt werden, um eine separate Test-DB zu nutzen.");
        // In einer CI-Umgebung könnte man hier einen Fehler werfen.
        // throw new Error("Tests müssen mit NODE_ENV=test ausgeführt werden.");
    }
    await sequelize.sync({ force: true });

    mockUserFindByPk.mockImplementation(async (id) => {
        if (id === 1) return Promise.resolve({ id: 1, email: 'admin@test.com', displayName: 'Admin Test', isAdmin: true, save: jest.fn() });
        if (id === 2) return Promise.resolve({ id: 2, email: 'user@test.com', displayName: 'Normal User', isAdmin: false, save: jest.fn() });
        return Promise.resolve(null);
    });

    adminUser = { id: 1, isAdmin: true, displayName: 'Admin Test' };
    normalUser = { id: 2, isAdmin: false, displayName: 'Normal User' };

    app = express();
    app.use(express.json());
    app.use('/api/meters', meterRoutes); // meterRoutes sollte die gemockten Modelle verwenden
});

beforeEach(async () => {
    // Sequelize `truncate: true, cascade: true` ist gut für das Zurücksetzen von Tabellen mit Beziehungen.
    // Reihenfolge ist wichtig wegen Foreign Key Constraints. Erst Readings, dann Meters.
    await MeterReading.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
    await Meter.destroy({ where: {}, truncate: true, cascade: true, restartIdentity: true });
    // User-Tabelle wird hier normalerweise nicht geleert, wenn sie persistente Testuser für Auth-Mocking enthält
    // oder wenn der User-Mock das Abrufen von Usern vollständig abdeckt.
});

afterAll(async () => {
    await sequelize.close();
});

describe('Meter API Endpoints (Sequelize)', () => {
    describe('POST /api/meters', () => {
        it('Admin should create a meter successfully', async () => {
            const res = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Hauptwasserzähler', unit: 'm³' });
            expect(res.statusCode).toEqual(201);
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe('Hauptwasserzähler');
            expect(res.body.unit).toBe('m³');
            expect(res.body.userId).toBe(adminUser.id);
            expect(res.body.createdBy).toBeDefined();
            expect(res.body.createdBy.displayName).toBe('Admin Test');
        });

        it('Non-admin should get 403 when trying to create a meter', async () => {
            const res = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${normalUserToken}`)
                .send({ name: 'Mein Zähler', unit: 'Stk' });
            expect(res.statusCode).toEqual(403);
        });

        it('Should return 400 if name is missing', async () => {
            const res = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ unit: 'kWh' });
            expect(res.statusCode).toEqual(400);
            expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('Name darf nicht leer sein.')]));
        });
         it('Should return 400 if unit is missing', async () => {
            const res = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test ohne Einheit' });
            expect(res.statusCode).toEqual(400);
            expect(res.body.errors).toEqual(expect.arrayContaining([expect.stringContaining('Einheit darf nicht leer sein.')]));
        });
    });

    describe('GET /api/meters', () => {
        beforeEach(async () => {
            // Erstelle User im Mock oder in der DB, wenn der Mock nicht ausreicht
            // Hier nehmen wir an, adminUser.id (1) ist gültig für den Fremdschlüssel
            await Meter.create({ name: 'Strom Garten', unit: 'kWh', userId: adminUser.id });
            await Meter.create({ name: 'Wasser Küche', unit: 'm³', userId: adminUser.id });
        });

        it('Admin should get all meters with creator info', async () => {
            const res = await request(app)
                .get('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
            expect(res.body[0].createdBy).toBeDefined();
            expect(res.body[0].createdBy.displayName).toBe('Admin Test');
        });
    });

    describe('GET /api/meters/:id', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Einzelner Zähler', unit: 'Liter', userId: adminUser.id });
        });

        it('Admin should get a specific meter by ID', async () => {
            const res = await request(app)
                .get(`/api/meters/${testMeter.id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toBe('Einzelner Zähler');
            expect(res.body.createdBy.id).toBe(adminUser.id);
        });

        it('Should return 404 if meter not found', async () => {
            const nonExistentId = 99999; // Eine ID, die sicher nicht existiert
            const res = await request(app)
                .get(`/api/meters/${nonExistentId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(404);
        });
    });

    describe('PUT /api/meters/:id', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Alter Name', unit: 'Alte Einheit', userId: adminUser.id });
        });

        it('Admin should update a meter successfully', async () => {
            const res = await request(app)
                .put(`/api/meters/${testMeter.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Neuer Zählername', unit: 'Neue Einheit' });
            expect(res.statusCode).toEqual(200);
            expect(res.body.name).toBe('Neuer Zählername');
            expect(res.body.unit).toBe('Neue Einheit');
        });
    });

    describe('DELETE /api/meters/:id', () => {
        let testMeter;
        let reading1;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Zähler zum Löschen', unit: 'Stk', userId: adminUser.id });
            reading1 = await MeterReading.create({ meterId: testMeter.id, value: 100, date: '2023-01-01', recordedByUserId: adminUser.id });
        });

        it('Admin should delete a meter and its readings successfully (due to CASCADE)', async () => {
            const res = await request(app)
                .delete(`/api/meters/${testMeter.id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(200);
            expect(res.body.msg).toContain('erfolgreich gelöscht');

            const foundMeter = await Meter.findByPk(testMeter.id);
            expect(foundMeter).toBeNull();
            const foundReading = await MeterReading.findByPk(reading1.id);
            expect(foundReading).toBeNull();
        });
    });

    // --- Tests für MeterReadings ---
    describe('POST /api/meters/:meterId/readings', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Zähler für Ablesungen', unit: 'kWh', userId: adminUser.id });
        });

        it('Admin should create a meter reading successfully', async () => {
            const readingData = { value: 123.45, date: '2023-03-15' }; // date als String YYYY-MM-DD
            const res = await request(app)
                .post(`/api/meters/${testMeter.id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(readingData);
            expect(res.statusCode).toEqual(201);
            expect(res.body.value).toBe(123.45);
            expect(res.body.meterId).toBe(testMeter.id);
            expect(res.body.recordedByUserId).toBe(adminUser.id);
            expect(res.body.meter).toBeDefined();
            expect(res.body.meter.name).toBe('Zähler für Ablesungen');
            expect(res.body.recordedBy).toBeDefined();
            expect(res.body.recordedBy.displayName).toBe('Admin Test');
        });

        it('Should return 400 if value or date is missing for reading', async () => {
            const resNoValue = await request(app)
                .post(`/api/meters/${testMeter.id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ date: '2023-03-15' });
            expect(resNoValue.statusCode).toEqual(400);
        });
    });

    describe('GET /api/meters/:meterId/readings', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Zähler mit Ablesungen', unit: 'm³', userId: adminUser.id });
            await MeterReading.create({ meterId: testMeter.id, value: 10, date: '2023-01-01', recordedByUserId: adminUser.id });
            await MeterReading.create({ meterId: testMeter.id, value: 20, date: '2023-02-01', recordedByUserId: adminUser.id });
        });

        it('Admin should get all readings for a specific meter', async () => {
            const res = await request(app)
                .get(`/api/meters/${testMeter.id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
            expect(res.body[0].recordedBy).toBeDefined();
        });

        it('Should return 404 if meter for readings does not exist', async () => {
            const nonExistentMeterId = 99999;
            const res = await request(app)
                .get(`/api/meters/${nonExistentMeterId}/readings`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res.statusCode).toEqual(404); // Erwartet 404 von der Route, wenn der Zähler nicht gefunden wird
        });
    });
    // Hier würden Tests für GET /reading/:id, PUT /reading/:id, DELETE /reading/:id folgen
});
