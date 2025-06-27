// Placeholder for server/tests/bookings.test.js
// const request = require('supertest');
// const { app } = require('../index'); // Assuming app is exported from index.js for testing
// const { sequelize, User, Booking, Notification } = require('../models'); // Adjust path as needed
// const { generateToken } = require('../utils/authTestHelper'); // A helper to generate tokens

describe('Booking API Routes', () => {
  let testUserToken, adminUserToken;
  let user1, user2, adminUser;

  beforeAll(async () => {
    // Initialize database, create test users, get tokens
    // try {
    //   await sequelize.sync({ force: true }); // Reset DB
    //   user1 = await User.create({ username: 'testuser1', password: 'password123', displayName: 'Test User 1' });
    //   user2 = await User.create({ username: 'testuser2', password: 'password123', displayName: 'Test User 2' });
    //   adminUser = await User.create({ username: 'adminuser', password: 'password123', displayName: 'Admin User', isAdmin: true });
    //   testUserToken = generateToken(user1); // You'd need a real token generation mechanism
    //   adminUserToken = generateToken(adminUser);
    // } catch (error) {
    //   console.error("Error in beforeAll:", error);
    //   throw error;
    // }
  });

  afterEach(async () => {
    // Clear all bookings and notifications after each test
    // await Notification.destroy({ where: {}, truncate: true });
    // await Booking.destroy({ where: {}, truncate: true });
  });

  afterAll(async () => {
    // await sequelize.close();
  });

  describe('POST /api/bookings - Create Bookings', () => {
    it('should create a simple booking with no overlaps', async () => {
      // const response = await request(app)
      //   .post('/api/bookings')
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .send({ startDate: '2024-01-01', endDate: '2024-01-05', status: 'booked' });
      // expect(response.statusCode).toBe(201);
      // expect(response.body).toBeInstanceOf(Array);
      // expect(response.body.length).toBe(1);
      // expect(response.body[0].status).toBe('booked');
      // expect(response.body[0].userId).toBe(user1.id);
      // expect(response.body[0].isSplit).toBe(false);
      // expect(response.body[0].originalRequestId).toBeDefined();
      pending('Test not implemented due to sandbox limitations.');
    });

    it('should create an "angefragt" segment for a full overlap and notify primary booker', async () => {
      // Pre-create a booking for user2
      // await Booking.create({ userId: user2.id, displayName: user2.displayName, startDate: '2024-01-10', endDate: '2024-01-15', status: 'booked' });

      // const response = await request(app)
      //   .post('/api/bookings')
      //   .set('Authorization', `Bearer ${testUserToken}`)
      //   .send({ startDate: '2024-01-10', endDate: '2024-01-15', status: 'booked' }); // User1 requests overlap

      // expect(response.statusCode).toBe(201);
      // expect(response.body.length).toBe(1);
      // expect(response.body[0].status).toBe('angefragt');
      // expect(response.body[0].userId).toBe(user1.id);
      // expect(response.body[0].originalBookingId).toBeDefined(); // Should link to user2's booking
      // expect(response.body[0].isSplit).toBe(true);

      // Check for notification for user2
      // const notifications = await Notification.findAll({ where: { recipientUserId: user2.id, type: 'overlap_request' }});
      // expect(notifications.length).toBe(1);
      // expect(notifications[0].relatedBookingId).toBe(response.body[0].id);
      pending('Test not implemented due to sandbox limitations.');
    });

    it('should split booking for partial overlap (start) and create "angefragt" segment', async () => {
        // Pre-create a booking for user2: 2024-02-05 to 2024-02-10
        // const primaryBooking = await Booking.create({ userId: user2.id, displayName: user2.displayName, startDate: '2024-02-05', endDate: '2024-02-10', status: 'booked' });

        // User1 requests booking: 2024-02-01 to 2024-02-07
        // const response = await request(app)
        //   .post('/api/bookings')
        //   .set('Authorization', `Bearer ${testUserToken}`)
        //   .send({ startDate: '2024-02-01', endDate: '2024-02-07', status: 'booked' });

        // expect(response.statusCode).toBe(201);
        // expect(response.body.length).toBe(2); // One booked, one angefragt

        // const bookedSegment = response.body.find(b => b.status === 'booked');
        // const angefragtSegment = response.body.find(b => b.status === 'angefragt');

        // expect(bookedSegment).toBeDefined();
        // expect(bookedSegment.startDate).toBe('2024-02-01');
        // expect(bookedSegment.endDate).toBe('2024-02-05');
        // expect(bookedSegment.isSplit).toBe(true);

        // expect(angefragtSegment).toBeDefined();
        // expect(angefragtSegment.startDate).toBe('2024-02-05');
        // expect(angefragtSegment.endDate).toBe('2024-02-07');
        // expect(angefragtSegment.originalBookingId).toBe(primaryBooking.id);
        // expect(angefragtSegment.isSplit).toBe(true);

        // const notifications = await Notification.findAll({ where: { recipientUserId: user2.id, type: 'overlap_request' }});
        // expect(notifications.length).toBe(1);
        // expect(notifications[0].relatedBookingId).toBe(angefragtSegment.id);
      pending('Test not implemented due to sandbox limitations.');
    });

    // ... more POST /api/bookings tests based on strategy ...

    it('should return 400 for invalid date range (end before start)', async () => {
        // const response = await request(app)
        //   .post('/api/bookings')
        //   .set('Authorization', `Bearer ${testUserToken}`)
        //   .send({ startDate: '2024-03-10', endDate: '2024-03-05', status: 'booked' });
        // expect(response.statusCode).toBe(400);
      pending('Test not implemented due to sandbox limitations.');
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    it('should allow a user to delete their own booking', async () => {
        // const booking = await Booking.create({ userId: user1.id, displayName: user1.displayName, startDate: '2024-03-01', endDate: '2024-03-05', status: 'booked' });
        // const response = await request(app)
        //     .delete(`/api/bookings/${booking.id}`)
        //     .set('Authorization', `Bearer ${testUserToken}`);
        // expect(response.statusCode).toBe(200);
        // const deletedBooking = await Booking.findByPk(booking.id);
        // expect(deletedBooking).toBeNull();
      pending('Test not implemented due to sandbox limitations.');
    });

    it('should delete related overlap_request notification when an "angefragt" booking is deleted', async () => {
        // // 1. User2 creates a primary booking
        // const primary = await Booking.create({ userId: user2.id, displayName: user2.displayName, startDate: '2024-08-01', endDate: '2024-08-05', status: 'booked' });
        // // 2. User1 creates an overlapping 'angefragt' booking + notification for User2
        // const postResponse = await request(app)
        //   .post('/api/bookings')
        //   .set('Authorization', `Bearer ${testUserToken}`) // User1 makes the request
        //   .send({ startDate: '2024-08-01', endDate: '2024-08-05', status: 'booked' });
        // const angefragtBookingId = postResponse.body[0].id;
        // let notification = await Notification.findOne({ where: { recipientUserId: user2.id, relatedBookingId: angefragtBookingId }});
        // expect(notification).not.toBeNull();

        // // 3. User1 deletes their 'angefragt' booking
        // const deleteResponse = await request(app)
        //     .delete(`/api/bookings/${angefragtBookingId}`)
        //     .set('Authorization', `Bearer ${testUserToken}`);
        // expect(deleteResponse.statusCode).toBe(200);

        // // 4. Verify the 'angefragt' booking is deleted
        // const deletedBooking = await Booking.findByPk(angefragtBookingId);
        // expect(deletedBooking).toBeNull();

        // // 5. Verify the notification for User2 (primary booker) regarding this 'angefragt' booking is also deleted
        // notification = await Notification.findOne({ where: { recipientUserId: user2.id, relatedBookingId: angefragtBookingId }});
        // expect(notification).toBeNull();
      pending('Test not implemented due to sandbox limitations.');
    });
  });

  // ... more tests for PUT and GET /api/bookings ...

});

describe('Notification API Routes', () => {
  // ... similar setup for users and tokens if not globally defined in a helper
  let user1, user2, testUserToken, otherUserToken;
  let primaryBooking, angefragtBookingByOtherUser, notificationForUser1;

  beforeAll(async () => {
    // await sequelize.sync({ force: true });
    // user1 = await User.create({ username: 'notifyUser1', password: 'password123', displayName: 'Notify User 1' });
    // user2 = await User.create({ username: 'notifyUser2', password: 'password123', displayName: 'Notify User 2' });
    // testUserToken = generateToken(user1);
    // otherUserToken = generateToken(user2);
  });

  afterEach(async () => {
    // await Notification.destroy({ where: {}, truncate: true });
    // await Booking.destroy({ where: {}, truncate: true });
  });


  describe('GET /api/notifications', () => {
    it('should fetch notifications only for the authenticated user', async () => {
        // // User1 has a primary booking
        // primaryBooking = await Booking.create({ userId: user1.id, displayName: user1.displayName, startDate: '2024-04-01', endDate: '2024-04-05', status: 'booked' });
        // // User2 creates an overlapping 'angefragt' booking, which generates a notification for User1
        // const overlapResponse = await request(app)
        //   .post('/api/bookings')
        //   .set('Authorization', `Bearer ${otherUserToken}`) // User2 makes the request
        //   .send({ startDate: '2024-04-01', endDate: '2024-04-03', status: 'booked' });
        // angefragtBookingByOtherUser = overlapResponse.body[0];

        // // User1 fetches their notifications
        // const response = await request(app)
        //   .get('/api/notifications')
        //   .set('Authorization', `Bearer ${testUserToken}`); // User1 is authenticated

        // expect(response.statusCode).toBe(200);
        // expect(response.body.length).toBe(1);
        // expect(response.body[0].recipientUserId).toBe(user1.id);
        // expect(response.body[0].type).toBe('overlap_request');
        // expect(response.body[0].relatedBookingId).toBe(angefragtBookingByOtherUser.id);
      pending('Test not implemented due to sandbox limitations.');
    });
  });

  describe('POST /api/notifications/:id/respond', () => {
    beforeEach(async () => {
        // // Setup: User1 (testUser) has a primary booking. User2 (otherUser) makes an angefragt request.
        // // Notification is created for User1.
        // await Notification.destroy({ where: {}, truncate: true }); // Clear old notifications
        // await Booking.destroy({ where: {}, truncate: true }); // Clear old bookings

        // const user1Primary = await Booking.create({ userId: user1.id, displayName: user1.displayName, startDate: '2024-05-01', endDate: '2024-05-05', status: 'booked' });
        // const overlapPostResponse = await request(app)
        //     .post('/api/bookings')
        //     .set('Authorization', `Bearer ${otherUserToken}`) // User2 (otherUser) makes the request
        //     .send({ startDate: '2024-05-01', endDate: '2024-05-03', status: 'booked' });
        // angefragtBookingByOtherUser = overlapPostResponse.body.find(b => b.status === 'angefragt');
        // notificationForUser1 = await Notification.findOne({ where: { recipientUserId: user1.id, type: 'overlap_request' }});
        // expect(notificationForUser1).toBeDefined();
        // expect(angefragtBookingByOtherUser).toBeDefined();
    });

    it('should allow user to "acknowledge" an overlap_request notification', async () => {
        // const response = await request(app)
        //   .post(`/api/notifications/${notificationForUser1.id}/respond`)
        //   .set('Authorization', `Bearer ${testUserToken}`) // User1 responds
        //   .send({ response: 'acknowledged' });

        // expect(response.statusCode).toBe(200);
        // expect(response.body.notification.response).toBe('acknowledged');
        // expect(response.body.notification.isRead).toBe(true);

        // // The 'angefragt' booking status should remain 'angefragt'
        // const updatedAngefragtBooking = await Booking.findByPk(angefragtBookingByOtherUser.id);
        // expect(updatedAngefragtBooking.status).toBe('angefragt');

        // // A new notification should be created for User2 (otherUser)
        // const ackNotificationForUser2 = await Notification.findOne({
        //     where: { recipientUserId: user2.id, type: 'overlap_acknowledged', relatedBookingId: angefragtBookingByOtherUser.id }
        // });
        // expect(ackNotificationForUser2).toBeDefined();
      pending('Test not implemented due to sandbox limitations.');
    });

    it('should allow user to "reject_by_owner" an overlap_request, cancelling the "angefragt" booking', async () => {
        // const response = await request(app)
        //   .post(`/api/notifications/${notificationForUser1.id}/respond`)
        //   .set('Authorization', `Bearer ${testUserToken}`) // User1 responds
        //   .send({ response: 'rejected_by_owner' });

        // expect(response.statusCode).toBe(200);
        // expect(response.body.notification.response).toBe('rejected_by_owner');

        // // The 'angefragt' booking status should change to 'cancelled'
        // const updatedAngefragtBooking = await Booking.findByPk(angefragtBookingByOtherUser.id);
        // expect(updatedAngefragtBooking.status).toBe('cancelled');

        // // A new notification should be created for User2 (otherUser) about the rejection
        // const rejectNotificationForUser2 = await Notification.findOne({
        //     where: { recipientUserId: user2.id, type: 'overlap_rejected', relatedBookingId: angefragtBookingByOtherUser.id }
        // });
        // expect(rejectNotificationForUser2).toBeDefined();
      pending('Test not implemented due to sandbox limitations.');
    });

    it('should return 400 if trying to respond to an already actioned notification', async () => {
        // // First, respond successfully
        // await request(app)
        //   .post(`/api/notifications/${notificationForUser1.id}/respond`)
        //   .set('Authorization', `Bearer ${testUserToken}`)
        //   .send({ response: 'acknowledged' });

        // // Then, try to respond again
        // const secondResponse = await request(app)
        //   .post(`/api/notifications/${notificationForUser1.id}/respond`)
        //   .set('Authorization', `Bearer ${testUserToken}`)
        //   .send({ response: 'rejected_by_owner' });
        // expect(secondResponse.statusCode).toBe(400);
        // expect(secondResponse.body.msg).toContain('already been responded to');
      pending('Test not implemented due to sandbox limitations.');
    });
  });

  describe('POST /api/notifications/:id/mark-read', () => {
    it('should mark a notification as read', async () => {
        // // Setup: Create a simple notification for user1
        // const generalNotification = await Notification.create({
        //     recipientUserId: user1.id,
        //     type: 'general_info',
        //     message: 'This is a test notification.',
        //     isRead: false
        // });
        // expect(generalNotification.isRead).toBe(false);

        // const response = await request(app)
        //     .post(`/api/notifications/${generalNotification.id}/mark-read`)
        //     .set('Authorization', `Bearer ${testUserToken}`); // User1 marks as read

        // expect(response.statusCode).toBe(200);
        // expect(response.body.isRead).toBe(true);

        // const updatedNotification = await Notification.findByPk(generalNotification.id);
        // expect(updatedNotification.isRead).toBe(true);
      pending('Test not implemented due to sandbox limitations.');
    });
  });

});

// Helper for token generation (example)
// function generateToken(user) {
//   const jwt = require('jsonwebtoken');
//   return jwt.sign({ id: user.id, displayName: user.displayName, isAdmin: user.isAdmin }, process.env.JWT_SECRET, { expiresIn: '1h' });
// }
