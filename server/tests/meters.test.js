// server/tests/meters.test.js
const request = require('supertest');
const express = require('express');
const meterRoutes = require('../routes/meters');
// const authMiddleware = require('../middleware/authMiddleware'); // Wird gemockt
const User = require('../models/User');
const Meter = require('../models/Meter');
const MeterReading = require('../models/MeterReading');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { sequelize, connectDB } = require('../config/database'); // Sequelize Instanz

let app;
let mongoServer;
let adminUser, normalUser;
let adminToken, normalUserToken;

// --- Mocking Section ---
// Mock User.findByPk for adminOnly middleware
// Dieses Mock muss VOR der Initialisierung von meterRoutes erfolgen, falls es dort direkt verwendet wird.
// Sicherer ist es, wenn meterRoutes das User-Modell als Abhängigkeit erhält (Dependency Injection)
// oder wenn der Jest-Mock-Mechanismus korrekt greift.
jest.mock('../models/User', () => {
    const SequelizeMock = require('sequelize-mock');
    const DBMock = new SequelizeMock();
    const UserMock = DBMock.define('user', {
        id: 1, // Standardwerte für den Mock
        email: 'test@example.com',
        displayName: 'Test User',
        isAdmin: false,
    });

    // Mock für findByPk
    UserMock.findByPk = jest.fn(async (id) => {
        if (id === 100) return Promise.resolve({ id: 100, email: 'admin@test.com', displayName: 'Admin Test', isAdmin: true, save: jest.fn() });
        if (id === 200) return Promise.resolve({ id: 200, email: 'user@test.com', displayName: 'Normal User', isAdmin: false, save: jest.fn() });
        return Promise.resolve(null);
    });
    return UserMock;
});


// Mock authMiddleware
jest.mock('../middleware/authMiddleware', () => jest.fn((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (token === 'ADMIN_TOKEN_VALID') {
            req.user = { id: 100, isAdmin: true, displayName: 'Admin Test' }; // id muss mit UserMock.findByPk übereinstimmen
        } else if (token === 'USER_TOKEN_VALID') {
            req.user = { id: 200, isAdmin: false, displayName: 'Normal User' }; // id muss mit UserMock.findByPk übereinstimmen
        } else {
            // Kein req.user setzen, um unauthentifizierten Fall zu simulieren
        }
    }
    next();
}));


// Setup In-Memory MongoDB und Sequelize (mit SQLite z.B.)
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    // Verwende die echte Sequelize-Instanz, die idealerweise für Tests auf SQLite :memory: konfiguriert ist.
    // In database.js sollte process.env.NODE_ENV === 'test' berücksichtigt werden.
    // Für dieses Beispiel nehmen wir an, dass connectDB() und sequelize.sync() die Test-DB korrekt initialisieren.
    await connectDB(); // Stellt sicher, dass die Verbindung besteht
    await sequelize.sync({ force: true }); // force:true setzt die DB für jeden Testlauf zurück

    // Erstelle Test-User direkt in der DB, falls User-Mocking nicht ausreicht oder für andere Tests benötigt wird.
    // Hier verwenden wir die gemockten IDs 100 und 200, die der User-Mock zurückgibt.
    adminToken = 'ADMIN_TOKEN_VALID';
    normalUserToken = 'USER_TOKEN_VALID';

    // Admin User ID 100, Normal User ID 200 as per User mock
    adminUser = { id: 100, displayName: 'Admin Test', isAdmin: true };
    normalUser = { id: 200, displayName: 'Normal User', isAdmin: false };


    app = express();
    app.use(express.json());
    app.use('/api/meters', meterRoutes);
});

afterEach(async () => {
    // Clear all mock calls and instances after each test
    jest.clearAllMocks();
    // Delete all meter and meter reading data after each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        await collection.deleteMany({});
    }
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
    await sequelize.close();
});


describe('Meter API Endpoints (/api/meters)', () => {
    describe('POST /', () => {
        it('Admin should create a meter successfully', async () => {
            const response = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Main Power', unit: 'kWh' });
            expect(response.statusCode).toBe(201);
            expect(response.body.name).toBe('Main Power');
            expect(response.body.unit).toBe('kWh');
            expect(response.body.createdBy).toBe(adminUser.id.toString());
        });

        it('Non-admin should get 403 when trying to create a meter', async () => {
            const response = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${normalUserToken}`)
                .send({ name: 'My Power', unit: 'kWh' });
            expect(response.statusCode).toBe(403);
        });

        it('Should return 401 if no token is provided', async () => {
            const response = await request(app)
                .post('/api/meters')
                .send({ name: 'No Token Meter', unit: 'W' });
            expect(response.statusCode).toBe(401); // adminOnly middleware checks req.user.id
        });

        it('Should return 400 if name or unit is missing', async () => {
            const resNoName = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ unit: 'kWh' });
            expect(resNoName.statusCode).toBe(400);

            const resNoUnit = await request(app)
                .post('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Test Meter' });
            expect(resNoUnit.statusCode).toBe(400);
        });
    });

    describe('GET /', () => {
        it('Admin should get all meters', async () => {
            await Meter.create({ name: 'Meter 1', unit: 'kWh', createdBy: adminUser.id });
            await Meter.create({ name: 'Meter 2', unit: 'm3', createdBy: adminUser.id });

            const response = await request(app)
                .get('/api/meters')
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(200);
            expect(response.body.length).toBe(2);
            // Das 'populate' in der Route versucht, User-Daten zu laden.
            // Da User.findByPk gemockt ist, muss der Mock das richtige Format zurückgeben.
            // Und Mongoose muss wissen, wie es das 'User'-Modell findet.
            // In meters.js wurde `model: 'User'` bei populate hinzugefügt.
            // Der User-Mock gibt displayName zurück, also sollte es hier vorhanden sein.
            expect(response.body[0].createdBy.displayName).toBeDefined();
        });

        it('Non-admin should get 403 when trying to get all meters', async () => {
            const response = await request(app)
                .get('/api/meters')
                .set('Authorization', `Bearer ${normalUserToken}`);
            expect(response.statusCode).toBe(403);
        });
    });

    describe('GET /:id', () => {
        let testMeter;
        beforeEach(async () => {
             testMeter = await Meter.create({ name: 'Specific Meter', unit: 'units', createdBy: adminUser.id });
        });

        it('Admin should get a specific meter by ID', async () => {
            const response = await request(app)
                .get(`/api/meters/${testMeter._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(200);
            expect(response.body.name).toBe('Specific Meter');
        });

        it('Should return 404 if meter not found', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .get(`/api/meters/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(404);
        });
    });

    describe('PUT /:id', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'Old Name', unit: 'old unit', createdBy: adminUser.id });
        });

        it('Admin should update a meter successfully', async () => {
            const response = await request(app)
                .put(`/api/meters/${testMeter._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'New Name', unit: 'new unit' });
            expect(response.statusCode).toBe(200);
            expect(response.body.name).toBe('New Name');
            expect(response.body.unit).toBe('new unit');
        });

        it('Should return 404 when trying to update non-existing meter', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .put(`/api/meters/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Non Existent', unit: 'none' });
            expect(response.statusCode).toBe(404);
        });
    });

    describe('DELETE /:id', () => {
        let testMeter;
        let reading1, reading2;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'To Delete', unit: 'units', createdBy: adminUser.id });
            reading1 = await MeterReading.create({ meter: testMeter._id, value: 100, date: new Date(), recordedBy: adminUser.id });
            reading2 = await MeterReading.create({ meter: testMeter._id, value: 200, date: new Date(), recordedBy: adminUser.id });
        });

        it('Admin should delete a meter and its readings successfully', async () => {
            const response = await request(app)
                .delete(`/api/meters/${testMeter._id}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(200);
            expect(response.body.msg).toContain('erfolgreich gelöscht');

            const foundMeter = await Meter.findById(testMeter._id);
            expect(foundMeter).toBeNull();

            const readings = await MeterReading.find({ meter: testMeter._id });
            expect(readings.length).toBe(0);
        });

        it('Should return 404 when trying to delete non-existing meter', async () => {
            const fakeId = new mongoose.Types.ObjectId();
            const response = await request(app)
                .delete(`/api/meters/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(404);
        });
    });

    // --- Tests for Meter Readings ---
    describe('POST /:meterId/readings', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'MeterForReadings', unit: 'kWh', createdBy: adminUser.id });
        });

        it('Admin should create a meter reading successfully', async () => {
            const readingData = { value: 123, date: new Date().toISOString() };
            const response = await request(app)
                .post(`/api/meters/${testMeter._id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(readingData);
            expect(response.statusCode).toBe(201);
            expect(response.body.value).toBe(123);
            expect(response.body.meter._id.toString()).toBe(testMeter._id.toString()); // Check populated meter
            expect(response.body.recordedBy.displayName).toBeDefined(); // Check populated user
        });

        it('Should return 400 if value or date is missing for reading', async () => {
            const resNoValue = await request(app)
                .post(`/api/meters/${testMeter._id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ date: new Date().toISOString() });
            expect(resNoValue.statusCode).toBe(400);
        });

        it('Should return 404 if meter for reading does not exist', async () => {
            const fakeMeterId = new mongoose.Types.ObjectId();
            const readingData = { value: 100, date: new Date().toISOString() };
            const response = await request(app)
                .post(`/api/meters/${fakeMeterId}/readings`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send(readingData);
            expect(response.statusCode).toBe(404);
        });
    });

    describe('GET /:meterId/readings', () => {
        let testMeter;
        beforeEach(async () => {
            testMeter = await Meter.create({ name: 'MeterWithReadings', unit: 'kWh', createdBy: adminUser.id });
            await MeterReading.create({ meter: testMeter._id, value: 100, date: new Date(), recordedBy: adminUser.id });
            await MeterReading.create({ meter: testMeter._id, value: 150, date: new Date(), recordedBy: adminUser.id });
        });

        it('Admin should get all readings for a specific meter', async () => {
            const response = await request(app)
                .get(`/api/meters/${testMeter._id}/readings`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(response.statusCode).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
        });
    });

    // Tests for GET /reading/:readingId, PUT /reading/:readingId, DELETE /reading/:readingId
    // would follow a similar pattern.
});
