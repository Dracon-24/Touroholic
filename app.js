const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const validateRequest = require('./utils/requestValidation');

const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');

const viewRouter = require('./routes/viewRoutes');

const app = express();

// VIEW ENGINE
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// GLOBAL MIDDLEWARES

// CORS
app.use(cors());
app.options('/{*splat}', cors());

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'https://tile.openstreetmap.org'],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  strictTransportSecurity: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.set('query parser', 'extended');
app.use(['/me', '/my-tours', '/billing', '/admin'], (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
// Old standalone examples now lead to the live, authenticated application.
app.get('/overview.html', (req, res) => res.redirect('/'));
app.get('/tour.html', (req, res) => res.redirect('/tour/the-park-camper'));
app.get('/signup', (req, res) => res.redirect('/signup.html'));
app.get('/my-reviews', (req, res) => res.redirect('/my-reviews.html'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: { status: 'fail', message: 'Too many requests. Please try again later.' }
});

app.use('/api', limiter);

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Cookies
app.use(cookieParser());
app.use(validateRequest);

// Parameter pollution protection
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

// Compression
app.use(compression());

// Request time
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

// ROUTES

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// 404
app.all('/{*splat}', (req, res, next) => {
  next(
    new AppError(
      `Can't find ${req.originalUrl} on this server!`,
      404
    )
  );
});

// GLOBAL ERROR HANDLER
app.use(globalErrorHandler);

module.exports = app;