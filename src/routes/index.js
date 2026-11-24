'use strict';

const { Router } = require('express');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const courseRoutes = require('./course.routes');
const reviewRoutes = require('./review.routes');
const couponRoutes = require('./coupon.routes');
const instructorRoutes = require('./instructor.routes');
const adminRoutes = require('./admin.routes');
const { paymentRouter } = require('./payment.routes');
const { categoryRouter, certificateRouter, uploadRouter } = require('./misc.routes');

const api = Router();

api.use('/auth', authRoutes);
api.use('/users', userRoutes);
api.use('/categories', categoryRouter);
api.use('/courses', courseRoutes);
api.use('/reviews', reviewRoutes);
api.use('/payments', paymentRouter);
api.use('/coupons', couponRoutes);
api.use('/certificates', certificateRouter);
api.use('/uploads', uploadRouter);
api.use('/instructor', instructorRoutes);
api.use('/admin', adminRoutes);

module.exports = api;
