const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-test-secret-with-sufficient-length';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_COOKIE_EXPIRES_IN = '1';
process.env.EMAIL_DISABLED = 'true';
const app = require('../../app');
const User = require('../../models/userModel');
const Tour = require('../../models/tourModel');
const Review = require('../../models/reviewModel');
const Booking = require('../../models/bookingModel');
let server, origin, tour, otherTour, alice, bob, admin;

async function request(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(origin + path, { method, redirect: 'manual',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers,
    cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function register(name) {
  const result = await request('/api/v1/users/signup', { method: 'POST', body: {
    name, email: `${name.toLowerCase()}@example.test`, password: 'test-password-123', passwordConfirm: 'test-password-123'
  } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(result.cookie); return { ...result.data.data.user, cookie: result.cookie };
}
before(async () => {
  // This database is always isolated; the application's DATABASE value is never used.
  await mongoose.connect(`mongodb://127.0.0.1:27019/touroholic_test_${process.pid}`, { serverSelectionTimeoutMS: 5000 });
  await Promise.all([User.init(), Tour.init(), Review.init(), Booking.init()]);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const fields = { duration: 5, maxGroupSize: 12, difficulty: 'easy', price: 497,
    summary: 'Test tour summary', description: 'Test tour description', imageCover: 'tour-1-cover.jpg',
    images: ['tour-1-1.jpg'], startDates: ['2027-01-01'], startLocation: { type: 'Point', coordinates: [-80, 25], description: 'Test location' } };
  tour = await Tour.create({ ...fields, name: 'The Test Adventure' });
  otherTour = await Tour.create({ ...fields, name: 'The Second Adventure' });
  alice = await register('Alice'); bob = await register('Bob'); admin = await register('Admin');
  await User.findByIdAndUpdate(admin._id, { role: 'admin' });
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (mongoose.connection.name?.startsWith('touroholic_test_')) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('signup establishes a cookie session without welcome email', async () => {
  const result = await request('/api/v1/users/me', { cookie: alice.cookie });
  assert.equal(result.status, 200); assert.equal(result.data.data.data.email, 'alice@example.test');
  assert.equal((await request('/me', { cookie: alice.cookie })).status, 200);
});
test('login normalizes email, rejects bad credentials and unsafe request bodies', async () => {
  assert.equal((await request('/api/v1/users/login', { method: 'POST', body: { email: ' ALICE@EXAMPLE.TEST ', password: 'test-password-123' } })).status, 200);
  assert.equal((await request('/api/v1/users/login', { method: 'POST', body: { email: 'alice@example.test', password: 'wrong' } })).status, 401);
  assert.equal((await request('/api/v1/users/login', { method: 'POST', body: { email: { $ne: null }, password: 'anything' } })).status, 400);
});
test('tour lists, top-five alias, JSON updates and renamed slugs work', async () => {
  const list = await request('/api/v1/tours/top-5-cheap'); assert.equal(list.status, 200); assert.ok(list.data.results <= 5);
  const update = await request(`/api/v1/tours/${tour.id}`, { method: 'PATCH', cookie: admin.cookie, body: { name: 'The Updated Adventure', price: 550 } });
  assert.equal(update.status, 200, JSON.stringify(update.data)); assert.equal(update.data.data.data.slug, 'the-updated-adventure');
  assert.equal((await request('/tour/the-updated-adventure')).status, 200);
});
test('demo booking requires authentication and concurrent retries produce one reservation', async () => {
  assert.equal((await request(`/api/v1/bookings/demo/${tour.id}`, { method: 'POST' })).status, 401);
  const results = await Promise.all(Array.from({ length: 4 }, () => request(`/api/v1/bookings/demo/${tour.id}`, {
    method: 'POST', cookie: alice.cookie, body: { user: bob._id, price: 1, paid: true }
  })));
  assert.ok(results.every(result => [200, 201].includes(result.status)), JSON.stringify(results));
  const bookings = await Booking.find({ tour: tour.id, user: alice._id });
  assert.equal(bookings.length, 1); assert.equal(bookings[0].paid, false); assert.equal(bookings[0].price, 550);
  const history = await request('/billing', { cookie: alice.cookie }); assert.equal(history.status, 200); assert.match(history.data, /no payment collected/);
  assert.match((await request('/my-tours', { cookie: alice.cookie })).data, /The Updated Adventure/);
});
test('review identity, ownership, validation, edits and aggregate ratings are enforced', async () => {
  const created = await request('/api/v1/reviews', { method: 'POST', cookie: alice.cookie, body: { tour: tour.id, user: bob._id, rating: 4, review: 'A great test tour.' } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const review = created.data.data.data;
  assert.equal(String(review.user), String(alice._id));
  assert.equal((await request(`/api/v1/reviews/${review.id}`, { method: 'PATCH', cookie: bob.cookie, body: { review: 'Unauthorized change' } })).status, 404);
  assert.equal((await request(`/api/v1/reviews/${review.id}`, { method: 'DELETE', cookie: bob.cookie })).status, 404);
  const updated = await request(`/api/v1/reviews/${review.id}`, { method: 'PATCH', cookie: alice.cookie, body: { rating: 5, user: bob._id, tour: otherTour.id } });
  assert.equal(updated.status, 200, JSON.stringify(updated.data));
  assert.equal((await Tour.findById(tour.id)).ratingsAverage, 5);
  assert.equal(String(updated.data.data.data.tour), tour.id);
  assert.equal((await request('/api/v1/reviews', { method: 'POST', cookie: alice.cookie, body: { tour: tour.id, rating: 3, review: 'Duplicate' } })).status, 400);
  assert.equal((await request(`/api/v1/reviews/${review.id}`, { method: 'DELETE', cookie: alice.cookie })).status, 204);
  const fresh = await Tour.findById(tour.id); assert.equal(fresh.ratingsQuantity, 0); assert.equal(fresh.ratingsAverage, 4.5);
});
test('account changes retain permissions and password recovery pages use the existing API', async () => {
  const profile = await request('/api/v1/users/updateMe', { method: 'PATCH', cookie: alice.cookie, body: { name: 'Alice Updated', role: 'admin' } });
  assert.equal(profile.status, 200); assert.equal(profile.data.data.user.role, 'user');
  assert.equal((await request('/api/v1/users/updateMyPassword', { method: 'PATCH', cookie: alice.cookie, body: { passwordCurrent: 'wrong', password: 'new-password-123', passwordConfirm: 'new-password-123' } })).status, 401);
  assert.equal((await request('/forgot-password')).status, 200);
  assert.equal((await request('/api/v1/users/forgotPassword', { method: 'POST', body: { email: 'alice@example.test' } })).status, 503);
  const account = await User.findById(alice._id); const token = account.createPasswordResetToken(); await account.save({ validateBeforeSave: false });
  assert.equal((await request(`/reset-password/${token}`)).status, 200);
  const reset = await request(`/api/v1/users/resetPassword/${token}`, { method: 'PATCH', body: { password: 'new-password-123', passwordConfirm: 'new-password-123' } });
  assert.equal(reset.status, 200); assert.ok(reset.cookie);
  assert.equal((await request(`/api/v1/users/resetPassword/${token}`, { method: 'PATCH', body: { password: 'new-password-123', passwordConfirm: 'new-password-123' } })).status, 400);
});
test('admin pages require administrator access and ordinary pages have no placeholder routes', async () => {
  for (const resource of ['tours', 'users', 'reviews', 'bookings']) {
    assert.equal((await request(`/admin/${resource}`, { cookie: bob.cookie })).status, 403);
    assert.equal((await request(`/admin/${resource}`, { cookie: admin.cookie })).status, 200);
  }
  assert.equal((await request('/about')).status, 200);
  assert.equal((await request('/me')).headers.get('location'), '/login');
  assert.equal((await request('/overview.html')).headers.get('location'), '/');
  assert.equal((await request('/not-a-real-route')).status, 404);
});

test('new admin tours render without optional dates, photos, guides or description', async () => {
  const result = await request('/api/v1/tours', { method: 'POST', cookie: admin.cookie, body: {
    name: 'The Minimal Adventure', duration: 3, maxGroupSize: 8, difficulty: 'easy', price: 100,
    summary: 'A newly created demo tour.', imageCover: 'tour-1-cover.jpg'
  } });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.equal((await request('/tour/the-minimal-adventure')).status, 200);
  const overview = await request('/');
  assert.equal(overview.status, 200);
  assert.match(overview.data, /Location to be announced/);
  const invalidLocation = await request(`/api/v1/tours/${result.data.data.data.id}`, {
    method: 'PATCH', cookie: admin.cookie, body: { startLocation: { coordinates: [999, 25] } }
  });
  assert.equal(invalidLocation.status, 400);
});

test('invalid coordinates and malformed JSON return useful errors', async () => {
  assert.equal((await request('/api/v1/tours/tours-within/nope/center/25,-80/unit/mi')).status, 400);
  assert.equal((await request('/api/v1/tours/distances/999,999/unit/km')).status, 400);
  const response = await fetch(origin + '/api/v1/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad-json'
  });
  assert.equal(response.status, 400);
});
