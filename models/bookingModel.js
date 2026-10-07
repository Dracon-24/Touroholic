const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  tour: {
    type: mongoose.Schema.ObjectId,
    ref: 'Tour',
    required: [true, 'Booking must belong to a Tour!']
  },

  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a User!']
  },

  price: {
    type: Number,
    required: [true, 'Booking must have a price.']
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  demo: { type: Boolean, default: false },
  demoKey: { type: String, select: false },

  paid: {
    type: Boolean,
    default: true
  }
});

bookingSchema.index({ demoKey: 1 }, { unique: true, sparse: true });

bookingSchema.pre(/^find/, function () {
  this.populate('user').populate({
    path: 'tour',
    select: 'name slug'
  });
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;