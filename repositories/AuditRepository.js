const BaseRepository = require('./BaseRepository');
const QueryBuilder   = require('../helpers/queryBuilder');

class AuditRepository extends BaseRepository {
  constructor() { super('SD_LogActivite', 'idLog'); }

  async log({ action, table_cible, id_cible, details, adminUser,
              ipAdresse, navigateur, module, userId, nomUtilisateur }) {
    return this.create({
      action,
      table_cible:    table_cible    || null,
      id_cible:       id_cible       || null,
      details:        details        || null,
      adminUser:      adminUser      || 'système',
      ipAdresse:      ipAdresse      || null,
      navigateur:     navigateur     || null,
      module:         module         || null,
      userId:         userId         || null,
      nomUtilisateur: nomUtilisateur || null,
    });
  }

  async findAll({
    dateFrom, dateTo, action, module, userId, ip, search,
    limit = 200, offset = 0,
  } = {}) {
    const sv = search ? `%${search}%` : null;
    const { clause, params } = QueryBuilder.where([
      ['dateAction >= ?',  dateFrom],
      ['dateAction <= ?',  dateTo ? QueryBuilder.endOfDay(dateTo) : null],
      ['action = ?',       action],
      ['module = ?',       module],
      ['userId = ?',       userId],
      ['ipAdresse LIKE ?', ip ? `%${ip}%` : null],
      ...(sv ? [[
        '(adminUser LIKE ? OR nomUtilisateur LIKE ? OR details LIKE ? OR module LIKE ? OR ipAdresse LIKE ? OR navigateur LIKE ?)',
        [sv, sv, sv, sv, sv, sv],
      ]] : []),
    ]);

    const rows = await this.query(
      `SELECT * FROM SD_LogActivite ${clause} ORDER BY dateAction DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)],
    );

    const [{ total }] = await this.query(
      `SELECT COUNT(*) AS total FROM SD_LogActivite ${clause}`,
      params,
    );

    return { rows, total: total || 0, limit: Number(limit), offset: Number(offset) };
  }

  stats({ dateFrom, dateTo } = {}) {
    const { clause, params } = QueryBuilder.where([
      ['dateAction >= ?', dateFrom],
      ['dateAction <= ?', dateTo ? QueryBuilder.endOfDay(dateTo) : null],
    ]);

    const db = require('../config/database').raw;

    const byAction = db.prepare(
      `SELECT action, COUNT(*) AS nb FROM SD_LogActivite ${clause} GROUP BY action ORDER BY nb DESC`
    ).all(...params);

    const byModule = db.prepare(
      `SELECT COALESCE(module,'—') AS module, COUNT(*) AS nb FROM SD_LogActivite ${clause} GROUP BY module ORDER BY nb DESC LIMIT 10`
    ).all(...params);

    const byUser = db.prepare(
      `SELECT COALESCE(adminUser,'système') AS user, COUNT(*) AS nb FROM SD_LogActivite ${clause} GROUP BY adminUser ORDER BY nb DESC LIMIT 8`
    ).all(...params);

    const byDay = db.prepare(
      `SELECT strftime('%Y-%m-%d', dateAction) AS jour, COUNT(*) AS nb FROM SD_LogActivite ${clause} GROUP BY jour ORDER BY jour DESC LIMIT 30`
    ).all(...params);

    const tot = db.prepare(
      `SELECT COUNT(*) AS nb FROM SD_LogActivite ${clause}`
    ).get(...params);

    return { total: tot?.nb || 0, byAction, byModule, byUser, byDay };
  }
}

module.exports = new AuditRepository();
