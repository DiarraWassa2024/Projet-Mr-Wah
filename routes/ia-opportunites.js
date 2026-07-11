/**
 * IA Opportunités — moteur de recherche intelligent (SSE streaming)
 * Deux modes :
 *   1. AVEC ANTHROPIC_API_KEY → Claude Haiku analyse et génère
 *   2. SANS clé → moteur de correspondance interne + base de connaissances
 */
const router = require('express').Router();
const auth   = require('../middleware/auth');
const db     = require('../config/database');

/* ── base de connaissances africaine ─────────────────────────── */
const KB = [
  { titre:'Fonds Africain de Développement (FAD)', categorie:'Financement', domaine:'Développement économique',
    description:'La BAD finance des projets de développement communautaire, infrastructures et autonomisation économique en Afrique.',
    budget:50000, codeDevise:'USD', lien:'https://www.afdb.org', pays:null, score:0 },
  { titre:'Programme Petites Subventions — FEM/PNUD', categorie:'Financement', domaine:'Environnement',
    description:'Le Programme de Petites Subventions du Fonds pour l\'Environnement Mondial soutient des initiatives locales de conservation et développement durable.',
    budget:50000, codeDevise:'USD', lien:'https://sgp.undp.org', pays:null, score:0 },
  { titre:'Appel à projets PNUD — Innovations locales', categorie:'Financement', domaine:'Innovation sociale',
    description:'Le PNUD soutient des projets d\'innovation sociale portés par des organisations de la société civile africaine.',
    budget:25000, codeDevise:'USD', lien:'https://www.undp.org', pays:null, score:0 },
  { titre:'Fonds USAID — Initiatives communautaires', categorie:'Financement', domaine:'Société civile',
    description:'USAID finance des initiatives locales dans les domaines de la gouvernance, la santé, l\'agriculture et l\'éducation.',
    budget:75000, codeDevise:'USD', lien:'https://www.usaid.gov', pays:null, score:0 },
  { titre:'Agence Française de Développement — Facilité ONG', categorie:'Financement', domaine:'Développement durable',
    description:'L\'AFD soutient des projets portés par des ONG françaises et africaines dans les pays partenaires.',
    budget:200000, codeDevise:'EUR', lien:'https://www.afd.fr', pays:null, score:0 },
  { titre:'Programme CODESRIA — Bourses de recherche', categorie:'Formation', domaine:'Recherche académique',
    description:'CODESRIA offre des bourses et subventions pour la recherche en sciences sociales en Afrique.',
    budget:5000, codeDevise:'USD', lien:'https://www.codesria.org', pays:null, score:0 },
  { titre:'Fonds pour la Consolidation de la Paix — ONU', categorie:'Financement', domaine:'Paix et sécurité',
    description:'Subventions pour des projets de réconciliation, dialogue inter-communautaire et cohésion sociale.',
    budget:100000, codeDevise:'USD', lien:'https://www.un.org/peacebuilding', pays:null, score:0 },
  { titre:'Alliance pour la Révolution Verte en Afrique (AGRA)', categorie:'Partenariat', domaine:'Agriculture',
    description:'AGRA soutient des projets d\'agriculture durable et de sécurité alimentaire en Afrique subsaharienne.',
    budget:30000, codeDevise:'USD', lien:'https://agra.org', pays:null, score:0 },
  { titre:'OMS/AFRO — Renforcement des systèmes de santé', categorie:'Partenariat', domaine:'Santé',
    description:'Partenariats pour le renforcement des capacités des acteurs de santé communautaire en Afrique.',
    budget:20000, codeDevise:'USD', lien:'https://www.afro.who.int', pays:null, score:0 },
  { titre:'UNESCO — Éducation pour Tous', categorie:'Financement', domaine:'Éducation',
    description:'Financement pour des programmes d\'alphabétisation, éducation non formelle et formation professionnelle.',
    budget:40000, codeDevise:'USD', lien:'https://www.unesco.org', pays:null, score:0 },
  { titre:'Banque Mondiale — Fonds Social', categorie:'Financement', domaine:'Protection sociale',
    description:'Soutien aux projets de protection sociale, inclusion des couches vulnérables et développement communautaire.',
    budget:150000, codeDevise:'USD', lien:'https://www.worldbank.org', pays:null, score:0 },
  { titre:'Rotary International — Subventions mondiales', categorie:'Financement', domaine:'Eau et assainissement',
    description:'Financement pour des projets d\'accès à l\'eau potable, assainissement et hygiène en milieu rural.',
    budget:30000, codeDevise:'USD', lien:'https://www.rotary.org', pays:null, score:0 },
  { titre:'Programme SWAP — Renforcement associatif', categorie:'Formation', domaine:'Gouvernance associative',
    description:'Formations et appui technique pour le renforcement organisationnel des associations africaines.',
    budget:8000, codeDevise:'EUR', lien:null, pays:null, score:0 },
  { titre:'Fonds LACUNA — Données pour l\'Afrique', categorie:'Financement', domaine:'Technologie et données',
    description:'Soutien à la création de jeux de données et outils technologiques pour le développement africain.',
    budget:100000, codeDevise:'USD', lien:'https://lacunafund.org', pays:null, score:0 },
  { titre:'Union Européenne — Instrument pour la démocratie (IEDDH)', categorie:'Financement', domaine:'Droits humains',
    description:'L\'UE finance des projets de promotion des droits fondamentaux, démocratie et État de droit en Afrique.',
    budget:300000, codeDevise:'EUR', lien:'https://ec.europa.eu', pays:null, score:0 },
  { titre:'Fondation Ford — Afrique', categorie:'Financement', domaine:'Justice sociale',
    description:'La Fondation Ford soutient des organisations africaines engagées dans la justice sociale, égalité et inclusion.',
    budget:500000, codeDevise:'USD', lien:'https://www.fordfoundation.org', pays:null, score:0 },
  { titre:'ILO — Programme d\'emploi des jeunes', categorie:'Emploi', domaine:'Emploi et formation',
    description:'L\'OIT finance des programmes d\'insertion professionnelle et de formation des jeunes africains.',
    budget:60000, codeDevise:'USD', lien:'https://www.ilo.org', pays:null, score:0 },
  { titre:'GIZ — Coopération germano-africaine', categorie:'Partenariat', domaine:'Développement rural',
    description:'La GIZ propose des partenariats pour le développement rural, l\'agriculture et la formation professionnelle.',
    budget:80000, codeDevise:'EUR', lien:'https://www.giz.de', pays:null, score:0 },
  { titre:'Compassion International — Protection de l\'enfance', categorie:'Financement', domaine:'Enfance et jeunesse',
    description:'Financement de programmes de protection, éducation et développement holistique des enfants vulnérables.',
    budget:20000, codeDevise:'USD', lien:'https://www.compassion.com', pays:null, score:0 },
  { titre:'FIDA — Agriculture familiale en Afrique', categorie:'Financement', domaine:'Agriculture',
    description:'Le FIDA soutient des projets d\'agriculture familiale durable, accès au crédit et marchés ruraux.',
    budget:200000, codeDevise:'USD', lien:'https://www.ifad.org', pays:null, score:0 },
];

/* ── correspondance domaine/mots-clés ───────────────────────── */
const DOMAIN_KEYWORDS = {
  'Santé':               ['santé','médecin','soins','hôpital','clinique','médical','maladie','patient','pharmacie','nutrition'],
  'Éducation':           ['éducation','école','formation','étude','enseignement','apprentissage','jeunesse','scolarité','alphabétisation'],
  'Agriculture':         ['agriculture','culture','récolte','fermier','paysan','sol','irrigat','semence','bétail','alimentation','nutrition'],
  'Eau & Assainissement':['eau','assainissement','puits','forage','latrine','hygiène','WaSH','potable'],
  'Environnement':       ['environnement','écologie','forêt','biodiversité','changement climatique','carbone','énergie renouvelable','solaire'],
  'Société civile':      ['société civile','droits','justice','gouvernance','démocratie','citoyenneté','participation','ONG'],
  'Protection sociale':  ['protection','vulnérable','pauvreté','femme','genre','handicap','migrant','réfugié','enfant'],
  'Emploi':              ['emploi','travail','jeune','profession','compétence','insertion','entrepreneuriat','startup'],
  'Technologie':         ['technologie','numérique','digital','informatique','internet','mobile','app','innovation','data'],
  'Microfinance':        ['microcrédit','microfinance','épargne','tontine','crédit','financement','caution'],
};

/* ── score une opportunité vs le contexte ────────────────────── */
function scoreOpportunity(opp, { pays, domaine, besoinsText }) {
  let score = 0;
  const text = [opp.titre, opp.description, opp.categorie, opp.domaine].join(' ').toLowerCase();
  const kws = (besoinsText || '').toLowerCase().split(/[\s,;.]+/).filter(w => w.length > 3);

  if (pays && opp.pays && opp.pays.toLowerCase() === pays.toLowerCase()) score += 4;
  if (domaine && opp.domaine && opp.domaine.toLowerCase().includes(domaine.toLowerCase())) score += 4;
  if (domaine) {
    const dk = DOMAIN_KEYWORDS[domaine] || [];
    dk.forEach(k => { if (text.includes(k)) score += 2; });
  }
  kws.forEach(kw => { if (text.includes(kw)) score += 1; });

  // Bonus catégorie
  const catWords = (besoinsText || '').toLowerCase();
  if (opp.categorie === 'Financement' && (catWords.includes('financ') || catWords.includes('subvention') || catWords.includes('fonds'))) score += 2;
  if (opp.categorie === 'Formation'   && (catWords.includes('format') || catWords.includes('renforcement') || catWords.includes('capacit'))) score += 2;
  if (opp.categorie === 'Partenariat' && (catWords.includes('partenariat') || catWords.includes('collabor') || catWords.includes('appui'))) score += 2;

  return score;
}

/* ── génère des suggestions depuis la base de connaissances ─── */
function buildSuggestions({ pays, domaine, besoinsText }, existingIds = new Set()) {
  const scored = KB.map(opp => ({
    ...opp,
    score: scoreOpportunity(opp, { pays, domaine, besoinsText }),
    source: 'ia',
  })).filter(o => o.score > 0).sort((a, b) => b.score - a.score);

  return scored.slice(0, 6);
}

/* ── helper SSE ──────────────────────────────────────────────── */
function initSSE(res) {
  res.writeHead(200, {
    'Content-Type':  'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  return (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();
  };
}

/* ── POST /api/ia-opportunites/recherche ─────────────────────── */
router.post('/recherche', auth, async (req, res) => {
  const { pays, domaine, besoinsText, numAgr } = req.body;
  const send = initSSE(res);

  try {
    /* ── Étape 1 : scan base de données ── */
    send({ type:'status', message:'🔍 Scan de la base de données...', progress:10 });
    await pause(400);

    const [dbOpps] = await db.execute(`
      SELECT o.*, org.LibOrg FROM SD_Opportunite o
      LEFT JOIN GPOTB01_Organisation org ON org.NumAgr = o.numAgr
      WHERE o.statut = 'Active'
      ORDER BY o.datePublication DESC`);

    /* ── Étape 2 : scoring des opps existantes ── */
    send({ type:'status', message:'⚡ Évaluation de pertinence...', progress:25 });
    await pause(500);

    const scoredDB = dbOpps.map(o => ({
      ...o, score: scoreOpportunity(o, { pays, domaine, besoinsText }), source:'db'
    })).filter(o => o.score > 0).sort((a,b) => b.score - a.score);

    if (scoredDB.length > 0) {
      send({ type:'matches', data: scoredDB.slice(0,5), message:`✅ ${scoredDB.length} correspondance(s) dans votre base` });
    } else {
      send({ type:'status', message:'ℹ️ Aucune correspondance directe en base — analyse IA en cours...', progress:35 });
    }

    /* ── Étape 3 : analyse IA ── */
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const hasApi = apiKey && apiKey !== 'YOUR_API_KEY_HERE' && apiKey.length > 20;

    if (hasApi) {
      /* ── Avec Claude ── */
      send({ type:'status', message:'🤖 Claude analyse votre profil d\'organisation...', progress:45 });
      const Anthropic = require('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const orgInfo = numAgr ? (await db.execute(`SELECT LibOrg FROM GPOTB01_Organisation WHERE NumAgr=?`,[numAgr]))[0][0]?.LibOrg || '' : '';
      const prompt = buildClaudePrompt({ pays, domaine, besoinsText, orgInfo, dbOpps });

      send({ type:'ai_thinking', message:'🤖 Génération des recommandations personnalisées...', progress:55 });

      let buffer = '';
      const stream = client.messages.stream({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role:'user', content: prompt }],
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
          buffer += chunk.delta.text;
          send({ type:'stream_text', text: chunk.delta.text });
        }
      }

      send({ type:'status', message:'🔧 Traitement des résultats...', progress:85 });
      await pause(300);

      const suggestions = parseClaudeResponse(buffer);
      for (let i = 0; i < suggestions.length; i++) {
        send({ type:'suggestion', data:{ ...suggestions[i], source:'ia' }, index:i, progress: 85 + (i+1)*2 });
        await pause(200);
      }

    } else {
      /* ── Fallback : moteur interne ── */
      send({ type:'status', message:'🧠 Moteur de recherche intelligent...', progress:45 });
      await pause(600);
      send({ type:'status', message:`📚 Analyse des opportunités africaines pour : ${domaine||'tous domaines'} · ${pays||'tous pays'}`, progress:55 });
      await pause(500);

      const suggestions = buildSuggestions({ pays, domaine, besoinsText });
      send({ type:'status', message:`💡 ${suggestions.length} opportunités identifiées — présentation...`, progress:70 });
      await pause(300);

      for (let i = 0; i < suggestions.length; i++) {
        await pause(350);
        send({ type:'suggestion', data: suggestions[i], index: i, progress: 70 + (i+1) * 4 });
      }
    }

    /* ── Finalisation ── */
    send({ type:'status', message:'✅ Analyse terminée', progress:100 });

    /* Save to history */
    try {
      await db.execute(
        `INSERT INTO SD_IARecherche(pays,domaine,besoinsText,numAgr,nbMatches,nbSuggestions,idUser,dateRecherche) VALUES(?,?,?,?,?,?,?,?)`,
        [pays||null, domaine||null, besoinsText||null, numAgr||null,
         scoredDB.length, 6, req.user.idUser,
         new Date().toISOString().replace('T',' ').slice(0,19)]
      );
    } catch(_) {}

    send({ type:'done' });

  } catch (err) {
    console.error('[IA] erreur:', err.message);
    send({ type:'error', message: err.message });
  } finally {
    res.end();
  }
});

/* ── GET /api/ia-opportunites/historique ─────────────────────── */
router.get('/historique', auth, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.*, u.username FROM SD_IARecherche r
       LEFT JOIN GPOTB_Users u ON u.idUser = r.idUser
       ORDER BY r.dateRecherche DESC LIMIT 20`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ── helpers ─────────────────────────────────────────────────── */
function pause(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildClaudePrompt({ pays, domaine, besoinsText, orgInfo, dbOpps }) {
  const existingList = dbOpps.slice(0,10).map(o => `- [${o.categorie||'?'}] ${o.titre}`).join('\n') || 'Aucune opportunité en base.';
  return `Tu es un expert en développement associatif et opportunités de financement en Afrique subsaharienne.

Profil de l'organisation :
- Pays : ${pays || 'Non précisé'}
- Domaine d'activité : ${domaine || 'Non précisé'}
${orgInfo ? `- Organisation : ${orgInfo}` : ''}
- Besoins exprimés : ${besoinsText || 'Non précisé'}

Opportunités actuellement dans la base :
${existingList}

Génère exactement 5 nouvelles opportunités de financement/partenariat/formation pertinentes pour ce profil.
Chaque opportunité DOIT inclure : titre, categorie (Financement|Partenariat|Formation|Emploi|Appel à projets), domaine, description (2-3 phrases), budget (nombre ou null), codeDevise (USD|EUR|FCFA), lien (URL ou null), score (1-10).

Réponds UNIQUEMENT avec un JSON array dans un bloc \`\`\`json\`\`\`. Pas de texte avant ou après.`;
}

function parseClaudeResponse(text) {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1].trim());
    const arr = text.match(/\[[\s\S]*\]/);
    if (arr) return JSON.parse(arr[0]);
  } catch (_) {}
  return [];
}

module.exports = router;
