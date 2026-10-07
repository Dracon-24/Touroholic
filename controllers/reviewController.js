const Review = require('../models/reviewModel');
const Tour = require('../models/tourModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.setTourUserIds = (req, res, next) => {
  req.body = {
    review: req.body.review,
    rating: req.body.rating,
    tour: req.params.tourId || req.body.tour,
    user: req.user.id
  };
  next();
};

exports.getAllReviews = factory.getAll(Review);
exports.getReview = factory.getOne(Review);
exports.createReview = catchAsync(async (req, res, next) => {
  if (!(await Tour.findById(req.body.tour))) {
    return next(new AppError('No tour found with that ID.', 404));
  }
  const review = await Review.create(req.body);
  res.status(201).json({ status: 'success', data: { data: review } });
});

const editableFilter = req => ({
  _id: req.params.id,
  ...(req.user.role === 'admin' ? {} : { user: req.user.id })
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const changes = {};
  for (const field of ['review', 'rating']) {
    if (req.body[field] !== undefined) changes[field] = req.body[field];
  }
  const review = await Review.findOneAndUpdate(editableFilter(req), changes, {
    returnDocument: 'after', runValidators: true
  });
  if (!review) return next(new AppError('Review not found or you cannot edit it.', 404));
  res.status(200).json({ status: 'success', data: { data: review } });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOneAndDelete(editableFilter(req));
  if (!review) return next(new AppError('Review not found or you cannot delete it.', 404));
  res.status(204).end();
});
