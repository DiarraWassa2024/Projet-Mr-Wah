/**
 * QueryBuilder — construit dynamiquement les clauses WHERE / ORDER BY
 *
 * Usage :
 *   const { clause, params } = QueryBuilder.where([
 *     ['o.CodePays = ?',   req.query.pays],
 *     ['o.DateCreOrg >= ?', req.query.dateFrom],
 *   ]);
 *   const sql = `SELECT * FROM T ${clause} ORDER BY T.nom`;
 */
class QueryBuilder {
  /**
   * @param {Array<[string, any]>} filters  – paires [condition_sql, valeur]
   *   Si la valeur est undefined / null / '', la condition est ignorée.
   *   Si la valeur est un tableau, ses éléments sont tous ajoutés aux params.
   */
  static where(filters = []) {
    const conditions = [];
    const params     = [];

    for (const [cond, val] of filters) {
      if (val === undefined || val === null || val === '') continue;
      conditions.push(cond);
      if (Array.isArray(val)) params.push(...val);
      else                    params.push(val);
    }

    return {
      clause: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '',
      params,
    };
  }

  /** Surcharge de dateTo : ajoute ' 23:59:59' si la valeur est une date courte */
  static endOfDay(val) {
    if (!val) return null;
    return val.includes(' ') ? val : val + ' 23:59:59';
  }
}

module.exports = QueryBuilder;
