const mongoose = require('mongoose');
const slugify = require('slugify');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [
        40,
        'A tour name must have less or equal then 40 characters'
      ],
      minlength: [
        10,
        'A tour name must have more or equal then 10 characters'
      ]
    },

    slug: String,

    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
      min: [1, 'Duration must be at least one day']
    },

    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
      min: [1, 'Group size must be at least one']
    },

    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult'
      }
    },

    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: val => Math.round(val * 10) / 10
    },

    ratingsQuantity: {
      type: Number,
      default: 0
    },

    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
      min: [0, 'Price cannot be negative']
    },

    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          return val < this.price;
        },
        message: 'Discount price ({VALUE}) should be below regular price'
      }
    },

    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description']
    },

    description: {
      type: String,
      trim: true
    },

    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image']
    },

    images: [String],

    createdAt: {
      type: Date,
      default: Date.now,
      select: false
    },

    startDates: [Date],

    secretTour: {
      type: Boolean,
      default: false
    },

    startLocation: {
      type: new mongoose.Schema({
        type: { type: String, default: 'Point', enum: ['Point'] },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: coordinates => coordinates.length === 2 &&
              coordinates.every(Number.isFinite) &&
              Math.abs(coordinates[0]) <= 180 && Math.abs(coordinates[1]) <= 90,
            message: 'Location requires valid longitude and latitude coordinates'
          }
        },
        address: String,
        description: String
      }, { _id: false }),
      default: undefined
    },

    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ],

    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User'
      }
    ]
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// INDEXES
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

// VIRTUAL
tourSchema.virtual('durationWeeks').get(function () {
  return this.duration / 7;
});

// VIRTUAL POPULATE
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id'
});

// DOCUMENT MIDDLEWARE
tourSchema.pre('save', function () {
  if (this.isModified('name')) this.slug = slugify(this.name, { lower: true });
});

tourSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate();
  const name = update.name || update.$set?.name;
  if (name) {
    if (update.$set) update.$set.slug = slugify(name, { lower: true });
    else update.slug = slugify(name, { lower: true });
  }
});

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function () {
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
});

tourSchema.pre(/^find/, function () {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  });
});

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;
