require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const bcrypt       = require('bcryptjs');

const app = express();

// ── Middleware globaux ────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const { publicLimiter, apiLimiter } = require('./middleware/rateLimiter');
app.use('/api/public', publicLimiter);
app.use('/api/auth',   publicLimiter);
app.use('/api',        apiLimiter);

// ── Piste d'audit — auto-instrumentation ─────────────────────
app.use(require('./middleware/auditMiddleware'));

// ── Routes API ────────────────────────────────────────────────
app.use('/api/public',        require('./routes/public'));
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/organisations', require('./routes/organisations'));
app.use('/api/adherents',     require('./routes/adherents'));
app.use('/api/personnes',     require('./routes/personnes'));
app.use('/api/beneficiaires', require('./routes/beneficiaires'));
app.use('/api/paiements',     require('./routes/paiements'));
app.use('/api/dons',          require('./routes/dons'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/remboursements', require('./routes/remboursements'));
app.use('/api/dettes',        require('./routes/dettes'));
app.use('/api/campagnes',     require('./routes/campagnes'));
app.use('/api/actualites',    require('./routes/actualites'));
app.use('/api/faq',           require('./routes/faq'));
app.use('/api/cotisations',   require('./routes/cotisations'));
app.use('/api/prestations',   require('./routes/prestations'));
app.use('/api/prestataires',  require('./routes/prestataires'));
app.use('/api/evenements',    require('./routes/evenements'));
app.use('/api/ref',           require('./routes/referentiels'));
app.use('/api/demandes',      require('./routes/demandes'));
app.use('/api/besoins-admin', require('./routes/besoins-admin'));
app.use('/api/opportunites',  require('./routes/opportunites'));
app.use('/api/utilisateurs',  require('./routes/utilisateurs'));
app.use('/api/piste-audit',            require('./routes/piste-audit'));
app.use('/api/sauvegarde',             require('./routes/sauvegarde'));
app.use('/api/pays',                   require('./routes/pays'));
app.use('/api/messages',               require('./routes/messages'));
app.use('/api/autorisations-ministere',require('./routes/autorisations-ministere'));
app.use('/api/groupes',                require('./routes/groupes'));
app.use('/api/roles',                  require('./routes/roles'));
app.use('/api/ia-opportunites',        require('./routes/ia-opportunites'));
app.use('/api/impressions',            require('./routes/impressions'));
app.use('/api/db-admin',               require('./routes/db-admin'));
app.use('/api/config-plateforme',      require('./routes/config-plateforme'));

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Gestionnaire d'erreurs global (doit être en dernier) ──────
app.use(require('./middleware/errorHandler'));

// ── Initialisation BD + démarrage ─────────────────────────────
async function initDB() {
  require('./config/schema')();

  const db = require('./config/database');
  const [[exists]] = await db.execute("SELECT idUser FROM GPOTB_Users WHERE email='admin@gpo.org'");
  if (!exists) {
    const hash = await bcrypt.hash('admin123', 10);
    await db.execute(
      "INSERT INTO GPOTB_Users (username,email,passwordHash,role) VALUES ('admin','admin@gpo.org',?,'admin')",
      [hash]
    );
    console.log('✅ Compte admin créé : admin@gpo.org / admin123');
  }
}

const PORT = process.env.PORT || 3000;
initDB()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`\n🚀 GPO Platform sur http://localhost:${PORT}\n`)))
  .catch(err => { console.error('Erreur init:', err.message); process.exit(1); });
