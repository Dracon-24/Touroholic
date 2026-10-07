const AppError = require('./appError');

const hasUnsafeKey = value => {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || ['__proto__', 'constructor', 'prototype'].includes(key) || hasUnsafeKey(child)
  );
};

module.exports = (req, res, next) => {
  req.body ||= {};
  if (hasUnsafeKey(req.body) || Object.keys(req.query).some(key => key.includes('$')) || hasUnsafeKey(req.query)) {
    return next(new AppError('Invalid request fields.', 400));
  }
  next();
};
