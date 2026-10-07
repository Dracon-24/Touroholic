const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const express = require('express');

function controller({ tour = { id: 'tour-id', price: 497 }, existing = null } = {}) {
  const calls = [];
  const exported = {};
  const dependencies = {
    '../models/tourModel': { findById: async id => { calls.push(['tour', id]); return tour; } },
    '../models/bookingModel': {
      findOne: async query => { calls.push(['find', query]); return existing; },
      findOneAndUpdate: async (_filter, update) => { calls.push(['create', update.$setOnInsert]); return { id: 'booking-id', ...update.$setOnInsert }; }
    },
    '../utils/catchAsync': require('../utils/catchAsync'),
    '../utils/appError': require('../utils/appError'),
    './handlerFactory': Object.fromEntries(['createOne', 'getOne', 'getAll', 'updateOne', 'deleteOne']
      .map(name => [name, () => (_req, res) => res.end()]))
  };
  vm.runInNewContext(fs.readFileSync('controllers/bookingController.js', 'utf8'), {
    exports: exported, require: name => dependencies[name]
  });
  return { calls, exported };
}

function invoke(handler, req) {
  return new Promise(resolve => {
    const res = { status(code) { this.code = code; return this; },
      json(body) { resolve({ code: this.code, body }); } };
    handler(req, res, error => resolve({ error }));
  });
}

test('demo booking takes identity and price from the server and collects no payment', async () => {
  const { exported, calls } = controller();
  const result = await invoke(exported.createDemoBooking, {
    params: { tourId: 'tour-id' }, user: { id: 'signed-in-user' },
    body: { user: 'other-user', price: 0, paid: true }
  });
  assert.equal(result.code, 201);
  assert.equal(result.body.demo, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.find(call => call[0] === 'create')[1])), {
    tour: 'tour-id', user: 'signed-in-user', price: 497, paid: false, demo: true
  });
});

test('retrying a booking reuses it and preserves existing paid records', async () => {
  const existing = { id: 'existing-id', paid: true };
  const { exported, calls } = controller({ existing });
  const result = await invoke(exported.createDemoBooking, {
    params: { tourId: 'tour-id' }, user: { id: 'signed-in-user' }
  });
  assert.equal(result.code, 200);
  assert.equal(result.body.data.booking, existing);
  assert.equal(calls.filter(call => call[0] === 'create').length, 0);
});

test('missing tours return 404 without saving a booking', async () => {
  const { exported, calls } = controller({ tour: null });
  const result = await invoke(exported.createDemoBooking, {
    params: { tourId: 'missing' }, user: { id: 'signed-in-user' }
  });
  assert.equal(result.error.statusCode, 404);
  assert.equal(calls.filter(call => call[0] === 'create').length, 0);
});

test('demo route remains protected and is available before admin-only routes', () => {
  const { exported } = controller();
  const protect = (_req, _res, next) => next();
  const restrict = (_req, _res, next) => next();
  const auth = { protect, restrictTo: () => restrict };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('routes/bookingRoutes.js', 'utf8'), {
    module, require: name => name === 'express' ? express : name.includes('authController') ? auth : exported
  });
  const stack = module.exports.stack;
  assert.equal(stack[0].handle, protect);
  assert.equal(stack[1].route.path, '/demo/:tourId');
  assert.equal(stack[1].route.methods.post, true);
  assert.equal(stack[2].handle, restrict);
});
