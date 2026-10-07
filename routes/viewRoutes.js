const express = require('express');
const viewsController = require('../controllers/viewsController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(viewsController.alerts);

router.get('/', authController.isLoggedIn, viewsController.getOverview);

router.get('/tour/:slug', authController.isLoggedIn, viewsController.getTour);
router.get('/login', authController.isLoggedIn, viewsController.getLoginForm);
router.get('/forgot-password', authController.isLoggedIn, viewsController.getForgotPassword);
router.get('/reset-password/:token', authController.isLoggedIn, viewsController.getResetPassword);
router.get('/about', authController.isLoggedIn, viewsController.getAbout);
router.get('/billing', authController.protect, viewsController.getBilling);
router.get('/admin/:resource', authController.protect, authController.restrictTo('admin'), viewsController.getAdmin);
router.get('/me', authController.protect, viewsController.getAccount);

router.get('/my-tours', authController.protect, viewsController.getMyTours);

router.post(
  '/submit-user-data',
  authController.protect,
  viewsController.updateUserData
);

module.exports = router;
