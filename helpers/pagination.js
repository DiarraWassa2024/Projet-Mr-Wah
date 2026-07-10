/**
 * Pagination helper
 *
 * Extrait page / limit depuis req.query et calcule l'offset.
 * Formatte la réponse paginée standard.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 500;

/**
 * Extrait les paramètres de pagination depuis req.query.
 * @returns {{ page, limit, offset }}
 */
function extract(query = {}) {
  const page  = Math.max(1, parseInt(query.page)  || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * Formate une réponse paginée.
 * @param {any[]} rows      – éléments de la page courante
 * @param {number} total    – total d'éléments (COUNT(*))
 * @param {{ page, limit }} pagination
 */
function format(rows, total, { page, limit }) {
  return {
    data:       rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext:    page * limit < total,
      hasPrev:    page > 1,
    },
  };
}

module.exports = { extract, format, DEFAULT_LIMIT, MAX_LIMIT };
