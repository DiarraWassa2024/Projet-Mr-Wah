/**
 * Middleware de validation des entrées.
 *
 * Usage :
 *   const { body } = require('express-validator');
 *   router.post('/', validate([
 *     body('email').isEmail().withMessage('Email invalide'),
 *     body('nom').notEmpty().withMessage('Nom obligatoire'),
 *   ]), controller);
 */
const { validationResult } = require('express-validator');

const validate = (rules) => async (req, res, next) => {
  await Promise.all(rules.map(rule => rule.run(req)));
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(422).json({
    message: 'Données invalides',
    errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
  });
};

module.exports = validate;
