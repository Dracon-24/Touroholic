const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Element {
  constructor() { this.children = []; this.handlers = {}; this.value = ''; this.textContent = ''; }
  replaceChildren() { this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  get firstChild() { return this.children[0]; }
  addEventListener(event, handler) { this.handlers[event] = handler; }
  reportValidity() { return true; }
  scrollIntoView() {}
}
const user = { _id: 'my-user', role: 'user' };
const tours = [{ _id: 'tour-one', name: 'The Forest Hiker', slug: 'the-forest-hiker' },
  { _id: 'tour-two', name: 'The Sea Explorer', slug: 'the-sea-explorer' }];
const review = { _id: 'review-one', user: { _id: user._id }, tour: tours[0]._id, rating: 4, review: 'Beautiful views.' };
const ok = data => ({ ok: true, status: 200, json: async () => ({ status: 'success', data: { data } }) });
const fail = (status, message) => ({ ok: false, status, json: async () => ({ status: 'fail', message }) });

async function page(reviews = [review], initialError) {
  const elements = {}, calls = [], redirects = [], replies = [];
  const context = vm.createContext({
    document: { getElementById: id => elements[id] ||= new Element(), createElement: () => new Element() },
    window: { confirm: () => true, location: { assign: url => redirects.push(url) } },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === '/api/v1/users/me') return initialError || ok(user);
      if (options.method === 'GET' && url.startsWith('/api/v1/reviews?')) return ok(reviews);
      if (options.method === 'GET' && url.startsWith('/api/v1/tours?')) return ok(tours);
      assert.ok(replies.length, 'Unexpected request: ' + url);
      return replies.shift();
    }
  });
  vm.runInContext(fs.readFileSync('public/js/reviews.js', 'utf8'), context);
  await vm.runInContext('reviewsReady', context);
  return { context, elements, calls, redirects, replies };
}

test('My reviews loads only the current user and resolves tour names', async () => {
  const state = await page([review, { ...review, _id: 'foreign-review', user: { _id: 'someone-else' } }]);
  const cards = state.elements['reviews-list'].children;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].children[0].textContent, 'The Forest Hiker');
  assert.ok(state.calls.find(call => call.url.includes('/reviews?user=my-user')));
  assert.ok(state.calls.every(call => call.options.credentials === 'same-origin'));
});

test('unauthenticated review pages redirect to login', async () => {
  const state = await page([], fail(401, 'Not logged in'));
  assert.deepEqual(state.redirects, ['/login']);
  assert.equal(state.calls.length, 1);
});

test('an empty review page offers a form and excludes already reviewed tours', async () => {
  const empty = await page([]);
  assert.match(empty.elements['reviews-status'].textContent, /not written/);
  assert.equal(empty.elements['review-editor'].hidden, false);
  const existing = await page();
  assert.deepEqual(existing.elements['review-tour'].children.map(option => option.value), ['', 'tour-two']);
});

test('new reviews send text and rating to the existing API without supplying user identity', async () => {
  const state = await page([]);
  state.elements['review-tour'].value = 'tour-two';
  state.elements['review-rating'].value = '5';
  state.elements['review-text'].value = ' Great trip! ';
  state.replies.push(ok({ ...review, tour: 'tour-two', rating: 5, review: 'Great trip!' }));
  await state.context.saveUserReview({ preventDefault() {} });
  const call = state.calls.at(-1);
  assert.equal(call.url, '/api/v1/reviews'); assert.equal(call.options.method, 'POST');
  assert.deepEqual(JSON.parse(call.options.body), { review: 'Great trip!', rating: 5, tour: 'tour-two' });
  assert.equal(state.elements['reviews-list'].children.length, 1);
});

test('editing does not change the review owner or tour association', async () => {
  const state = await page();
  vm.runInContext('editingReview = userReviews[0]; renderReviewEditor();', state.context);
  state.elements['review-rating'].value = '3';
  state.elements['review-text'].value = 'Updated review';
  state.replies.push(ok({ ...review, rating: 3, review: 'Updated review' }));
  await state.context.saveUserReview({ preventDefault() {} });
  const call = state.calls.at(-1);
  assert.equal(call.url, '/api/v1/reviews/review-one'); assert.equal(call.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.options.body), { review: 'Updated review', rating: 3 });
});

test('deleting accepts a 204 response without attempting to parse JSON', async () => {
  const state = await page();
  state.replies.push({ ok: true, status: 204, json: () => { throw new Error('Must not parse'); } });
  await state.context.deleteUserReview(review, new Element());
  assert.equal(state.calls.at(-1).options.method, 'DELETE');
  assert.equal(state.elements['reviews-list'].children.length, 0);
});

test('failed saves retain the review text and re-enable retry', async () => {
  const state = await page([]);
  state.elements['review-tour'].value = 'tour-one';
  state.elements['review-rating'].value = '5';
  state.elements['review-text'].value = '<script>not HTML</script>';
  state.replies.push(fail(500, 'Unable to save'));
  await state.context.saveUserReview({ preventDefault() {} });
  assert.equal(state.elements['review-save'].disabled, false);
  assert.equal(state.elements['review-text'].value, '<script>not HTML</script>');
  assert.equal(state.elements['reviews-status'].textContent, 'Unable to save');
});
