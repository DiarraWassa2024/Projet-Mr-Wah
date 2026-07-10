/**
 * Repository de base — fournit les opérations CRUD génériques.
 * Tous les repositories spécialisés étendent cette classe.
 *
 * @param {string} table  – nom de la table SQLite
 * @param {string} pk     – colonne clé primaire
 */
class BaseRepository {
  constructor(table, pk) {
    this.db    = require('../config/database');
    this.table = table;
    this.pk    = pk;
  }

  /** SELECT * avec clause WHERE et ORDER BY optionnels */
  async findAll(clause = '', params = [], orderBy = '') {
    const sql = [
      `SELECT * FROM ${this.table}`,
      clause,
      orderBy ? `ORDER BY ${orderBy}` : '',
    ].filter(Boolean).join(' ');
    const [rows] = await this.db.execute(sql, params);
    return rows;
  }

  /** SELECT * WHERE pk = id */
  async findById(id) {
    const [[row]] = await this.db.execute(
      `SELECT * FROM ${this.table} WHERE ${this.pk} = ?`, [id]
    );
    return row || null;
  }

  /** COUNT(*) avec clause WHERE optionnelle */
  async count(clause = '', params = []) {
    const sql = `SELECT COUNT(*) AS n FROM ${this.table}${clause ? ' ' + clause : ''}`;
    const [[row]] = await this.db.execute(sql, params);
    return row.n;
  }

  /** INSERT générique — retourne { insertId, affectedRows } */
  async create(data) {
    const keys   = Object.keys(data);
    const values = Object.values(data);
    const sql    = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`;
    const [result] = await this.db.execute(sql, values);
    return result;
  }

  /** UPDATE générique — retourne { affectedRows } */
  async update(id, data) {
    const keys   = Object.keys(data);
    const values = [...Object.values(data), id];
    const sql    = `UPDATE ${this.table} SET ${keys.map(k => `${k}=?`).join(',')} WHERE ${this.pk}=?`;
    const [result] = await this.db.execute(sql, values);
    return result;
  }

  /** DELETE WHERE pk = id */
  async delete(id) {
    const [result] = await this.db.execute(
      `DELETE FROM ${this.table} WHERE ${this.pk}=?`, [id]
    );
    return result;
  }

  /** Exécute une requête SQL arbitraire (pour les JOINs complexes) */
  async query(sql, params = []) {
    const [rows] = await this.db.execute(sql, params);
    return rows;
  }

  /** Exécute et retourne le premier résultat */
  async queryOne(sql, params = []) {
    const [rows] = await this.db.execute(sql, params);
    return rows[0] || null;
  }
}

module.exports = BaseRepository;
