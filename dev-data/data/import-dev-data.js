const fs = require('fs');
const mongoose = require('mongoose');
const slugify = require('slugify');
require('dotenv').config({ path: './config.env', quiet: true });
const Tour = require('../../models/tourModel');
const Review = require('../../models/reviewModel');
const User = require('../../models/userModel');
const Booking = require('../../models/bookingModel');

const read = file => JSON.parse(fs.readFileSync(`${__dirname}/${file}.json`, 'utf8'));
const insertMissing = (Model, records) => Model.bulkWrite(records.map(record => ({
  updateOne: { filter: { _id: record._id }, update: { $setOnInsert: record }, upsert: true }
})));

(async () => {
  const action = process.argv[2];
  if (!['--import', '--delete'].includes(action)) throw new Error('Use --import or --delete --confirm-delete.');
  if (action === '--delete' && !process.argv.includes('--confirm-delete')) throw new Error('Deletion requires --confirm-delete and removes all application records.');
  if (!process.env.DATABASE) throw new Error('DATABASE is missing from config.env.');
  await mongoose.connect(process.env.DATABASE);
  if (action === '--import') {
    // Seed passwords are already hashes. Bulk insertion avoids hashing them again.
    await insertMissing(User, read('users'));
    const tours = read('tours').map(tour => ({ ...tour, slug: slugify(tour.name, { lower: true }) }));
    await insertMissing(Tour, tours);
    await insertMissing(Review, read('reviews'));
    for (const tour of tours) await Review.calcAverageRatings(new mongoose.Types.ObjectId(tour._id));
    console.log('Sample data imported. Existing records were preserved.');
  } else {
    await Promise.all([Tour.deleteMany(), User.deleteMany(), Review.deleteMany(), Booking.deleteMany()]);
    console.log('Application records deleted.');
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
