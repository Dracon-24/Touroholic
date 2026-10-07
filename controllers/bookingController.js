const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const factory = require('./handlerFactory');

exports.createDemoBooking = catchAsync(async (req, res, next) => {
  const tour = await Tour.findById(req.params.tourId);
  if (!tour) {
    return next(new AppError('No tour found with that ID.', 404));
  }

  // Reusing an existing booking makes a retry safe without charging anything.
  let booking = await Booking.findOne({ tour: tour.id, user: req.user.id });
  const existing = Boolean(booking);
  if (!booking) {
    const demoKey = `${req.user.id}:${tour.id}`;
    try {
      booking = await Booking.findOneAndUpdate({ demoKey }, {
        $setOnInsert: { tour: tour.id, user: req.user.id, price: tour.price, paid: false, demo: true }
      }, { upsert: true, returnDocument: 'after', runValidators: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      booking = await Booking.findOne({ demoKey });
    }
  }

  res.status(existing ? 200 : 201).json({
    status: 'success',
    demo: true,
    data: { booking }
  });
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);