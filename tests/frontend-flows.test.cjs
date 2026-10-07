const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const signupSource = fs.readFileSync('public/js/signup.js', 'utf8');
const bookingSource = fs.readFileSync('public/js/booking.js', 'utf8')
  .replace(/^import .*;\n/gm, '')
  .replace('export const bookTour', 'const bookTour');
const success = { ok: true, status: 200, json: async () => ({ status: 'success' }) };
const failure = (status, message) => ({
  ok: false, status, json: async () => ({ status: 'fail', message })
});

function signup(replies) {
  const calls = [], redirects = [], handlers = {};
  const password = { value: 'example-password', addEventListener() {} };
  const confirm = {
    value: password.value, addEventListener() {},
    setCustomValidity(message) { this.validity = message; }
  };
  const button = { textContent: 'Sign up', disabled: false };
  const status = { textContent: '' };
  const form = {
    elements: {
      name: { value: ' Example User ' }, email: { value: ' example@example.com ' },
      password, passwordConfirm: confirm
    },
    querySelector: () => button,
    addEventListener: (name, handler) => { handlers[name] = handler; },
    reportValidity: () => !confirm.validity,
    reset() { this.wasReset = true; }
  };
  vm.runInNewContext(signupSource, {
    document: { querySelector: () => form, getElementById: () => status },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const reply = replies.shift();
      if (reply instanceof Error) throw reply;
      assert.ok(reply, 'Unexpected request: ' + url);
      return reply;
    },
    window: { setTimeout: fn => fn(), location: { assign: url => redirects.push(url) } }
  });
  return { calls, redirects, button, status, form,
    submit: () => handlers.submit({ preventDefault() {} }) };
}

async function booking(response) {
  const calls = [], redirects = [], alerts = [];
  const context = {
    axios: async options => { calls.push(options); if (response instanceof Error) throw response; return response; },
    URL, showAlert: (...args) => alerts.push(args),
    window: { location: { assign: url => redirects.push(url) } }
  };
  vm.createContext(context);
  vm.runInContext(bookingSource + '\nthis.bookTour = bookTour;', context);
  const result = await context.bookTour('tour-id');
  return { calls, redirects, alerts, result };
}

test('signup logs in, verifies the cookie session, then redirects', async () => {
  const state = signup([success, success, success]);
  await state.submit();
  assert.deepEqual(state.calls.map(call => call.url), [
    '/api/v1/users/signup', '/api/v1/users/login', '/api/v1/users/me'
  ]);
  assert.ok(state.calls.every(call => call.options.credentials === 'same-origin'));
  assert.deepEqual(JSON.parse(state.calls[1].options.body), {
    email: 'example@example.com', password: 'example-password'
  });
  assert.deepEqual(state.redirects, ['/']);
  assert.equal(state.form.wasReset, true);
});

test('signup recovers a saved account after a welcome-email server error', async () => {
  const state = signup([failure(500, 'Email unavailable'), success, success]);
  await state.submit();
  assert.deepEqual(state.redirects, ['/']);
});

test('signup validation errors do not trigger login', async () => {
  const state = signup([failure(400, 'Email already exists')]);
  await state.submit();
  assert.equal(state.calls.length, 1);
  assert.equal(state.status.textContent, 'Email already exists');
  assert.equal(state.button.disabled, false);
});

test('a login retry does not submit the created account a second time', async () => {
  const state = signup([success, failure(500, 'Login unavailable'), success, success]);
  await state.submit();
  assert.equal(state.button.textContent, 'Log in');
  assert.equal(state.button.disabled, false);
  await state.submit();
  assert.equal(state.calls.filter(call => call.url.endsWith('/signup')).length, 1);
  assert.deepEqual(state.redirects, ['/']);
});

test('signup does not claim login success when the session cookie is missing', async () => {
  const state = signup([success, success, failure(401, 'Not logged in')]);
  await state.submit();
  assert.deepEqual(state.redirects, []);
  assert.equal(state.button.disabled, false);
  assert.match(state.status.textContent, /session could not be verified/);
});

test('signup connection errors allow another attempt', async () => {
  const state = signup([new Error('Network unavailable')]);
  await state.submit();
  assert.equal(state.button.disabled, false);
  assert.deepEqual(state.redirects, []);
});

test('booking posts a demo booking and opens My bookings', async () => {
  const state = await booking({ data: { status: 'success', demo: true } });
  assert.equal(state.calls[0].method, 'POST');
  assert.equal(state.calls[0].url, '/api/v1/bookings/demo/tour-id');
  assert.deepEqual(state.redirects, ['/my-tours?alert=demo-booking']);
  assert.equal(state.result, true);
});

test('booking handles expired authentication', async () => {
  const error = new Error('Unauthorized'); error.response = { status: 401 };
  const state = await booking(error);
  assert.deepEqual(state.redirects, ['/login']);
});

test('booking shows API errors and allows retry', async () => {
  const error = new Error('Request failed');
  error.response = { status: 500, data: { message: 'Unable to save booking.' } };
  const state = await booking(error);
  assert.equal(state.result, false);
  assert.equal(state.alerts[0][1], error.response.data.message);
});

test('booking does not redirect after an unsuccessful response', async () => {
  const state = await booking({ data: { status: 'fail' } });
  assert.equal(state.result, false);
  assert.deepEqual(state.redirects, []);
});

test('built bundle wires booking even when the map fails and restores a failed button', async () => {
  const handlers = {}, requests = [];
  const button = {
    disabled: false, textContent: 'Book tour now!', dataset: { tourId: 'tour-id' },
    addEventListener: (event, handler) => { handlers[event] = handler; }
  };
  const body = { dataset: { alert: '' }, prepend() {} };
  const map = { dataset: { locations: '[]' }, closest: () => ({ hidden: false }) };
  const document = {
    cookie: '', body,
    createElement: () => ({ setAttribute() {} }),
    getElementById: id => id === 'map' ? map : id === 'book-tour' ? button : null,
    querySelector: selector => selector === 'body' ? body : null
  };
  class XMLHttpRequest {
    constructor() { this.onloadend = null; }
    open(method, url) { this.url = url; }
    setRequestHeader() {}
    getAllResponseHeaders() { return 'content-type: application/json'; }
    send() {
      requests.push(this.url); this.status = 500;
      this.responseText = JSON.stringify({ message: 'Booking unavailable' });
      this.onloadend();
    }
  }
  const location = { href: 'http://localhost:3000/tour/example', assign() {} };
  vm.runInNewContext(fs.readFileSync('public/js/dist/index.js', 'utf8'), {
    document, XMLHttpRequest, URL, URLSearchParams, AbortController,
    setTimeout, clearTimeout, console: { warn() {} },
    window: { location, setTimeout() {} }, location
  });
  assert.equal(typeof handlers.click, 'function');
  await handlers.click();
  assert.deepEqual(requests, ['/api/v1/bookings/demo/tour-id']);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'Book tour now!');
});

test('signup recovers a previous saved account when its email is duplicated', async () => {
  const state = signup([failure(400, 'Duplicate value for email: example@example.com. Please use another value!'), success, success]);
  await state.submit();
  assert.deepEqual(state.redirects, ['/']);
});

test('a duplicate email does not sign in without the correct password', async () => {
  const message = 'Duplicate value for email: example@example.com. Please use another value!';
  const state = signup([failure(400, message), failure(401, 'Incorrect email or password')]);
  await state.submit();
  assert.deepEqual(state.redirects, []);
  assert.equal(state.button.disabled, false);
  assert.equal(state.status.textContent, message);
});
