const BaseRepository = require('./BaseRepository');

class UserRepository extends BaseRepository {
  constructor() { super('GPOTB_Users', 'idUser'); }

  async findAll() {
    return this.query(
      'SELECT idUser, username, email, role, isActive, createdAt FROM GPOTB_Users ORDER BY createdAt DESC'
    );
  }

  async findById(id) {
    return this.queryOne(
      'SELECT idUser, username, email, role, isActive, createdAt, NumAgr, idAdh FROM GPOTB_Users WHERE idUser = ?', [id]
    );
  }

  /** Un email est UNIQUE en base, actif ou non — on vérifie donc toutes les lignes, pas seulement les actives. */
  async findByEmail(email) {
    return this.queryOne('SELECT * FROM GPOTB_Users WHERE email = ?', [email]);
  }

  /** Résout un identifiant de connexion — accepte soit le username, soit l'email (tous deux uniques). */
  async findByLogin(identifiant) {
    return this.queryOne(
      'SELECT * FROM GPOTB_Users WHERE (username = ? OR email = ?) AND isActive = 1',
      [identifiant, identifiant]
    );
  }

  async countAdmins() {
    const row = await this.queryOne("SELECT COUNT(*) AS n FROM GPOTB_Users WHERE role='admin'");
    return row ? row.n : 0;
  }
}

module.exports = new UserRepository();
