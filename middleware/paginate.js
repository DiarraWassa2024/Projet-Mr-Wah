/**
 * Middleware de pagination.
 * Injecte req.pagination = { page, limit, offset } depuis les query params.
 * Compatible avec toutes les routes GET de liste.
 */
const { extract } = require('../helpers/pagination');

module.exports = (req, res, next) => {
  req.pagination = extract(req.query);
  next();
};
