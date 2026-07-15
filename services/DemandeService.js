const db                     = require('../config/database');
const DemandeRepository      = require('../repositories/DemandeRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const PaiementRepository     = require('../repositories/PaiementRepository');
const UserRepository         = require('../repositories/UserRepository');
const AuthService            = require('./AuthService');
const AuditService           = require('./AuditService');
const emailSvc               = require('./email');
const notificationSvc        = require('./notification');
const NotificationService    = require('./NotificationService');
const { fermerOrganisation, fermerAdherent } = require('./OrganisationLifecycleService');
const { getTauxRemboursementPct } = require('../config/remboursement');
const { nowISO, todayDate }  = require('../helpers/dateHelper');
const PAYMENT_PROVIDERS      = require('../config/paymentProviders');

const TYPE_ORG_ID = { 'Association': 1, 'ONG': 2, 'Mutuelle': 6 };

const STATUTS_MANUELS = ['Actif', 'Suspendu', 'Radié', 'Exclu', 'Démissionnaire'];

const TRANSITIONS = {
  'Actif':    ['Suspendu', 'Radié', 'Exclu', 'Démissionnaire'],
  'Suspendu': ['Actif',    'Radié', 'Exclu', 'Démissionnaire'],
};

// Montants de cotisation par défaut (utilisés si l'organisation n'a configuré aucune formule),
// exprimés dans la devise du pays de la demande.
const COTISATION_DEFAUT = {
  XOF: { Mensuelle: 2000,  Annuelle: 20000 },
  NGN: { Mensuelle: 1500,  Annuelle: 15000 },
  MGA: { Mensuelle: 10000, Annuelle: 100000 },
};

function deviseDuPays(codePays) {
  return (PAYMENT_PROVIDERS[codePays] || {}).devise || 'XOF';
}

async function getFormulesCotisation(numAgr, codeDevise) {
  const defauts = COTISATION_DEFAUT[codeDevise] || COTISATION_DEFAUT.XOF;
  const formules = { Mensuelle: defauts.Mensuelle, Annuelle: defauts.Annuelle, CodeDevise: codeDevise };
  if (!numAgr) return formules;

  const [rows] = await db.execute(
    `SELECT TypeCotisation, MontantCoti, CodeDevise FROM GPOTB14_Cotisation
     WHERE NumAgr = ? AND TypeCotisation IN ('Mensuelle','Annuelle') ORDER BY EstDefaut DESC`,
    [numAgr]
  );
  for (const r of rows) {
    if (r.TypeCotisation === 'Mensuelle') formules.Mensuelle = r.MontantCoti;
    if (r.TypeCotisation === 'Annuelle')  formules.Annuelle  = r.MontantCoti;
    if (r.CodeDevise) formules.CodeDevise = r.CodeDevise;
  }
  return formules;
}

async function genererIdentifiantUnique(base) {
  let candidate = base;
  for (let i = 0; i < 20; i++) {
    const [rows] = await db.execute('SELECT 1 FROM GPOTB_Users WHERE username = ?', [candidate]);
    if (!rows.length) return candidate;
    candidate = `${base}${Math.floor(10 + Math.random() * 90)}`;
  }
  throw new Error("Impossible de générer un identifiant de connexion unique");
}

/** Retire les accents/ponctuation, tout en minuscules, pour construire des identifiants lisibles. */
const ACCENTS_RE = new RegExp('[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g');
function slugifier(s) {
  return (s || '')
    .normalize('NFD').replace(ACCENTS_RE, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/** Identifiant d'organisation basé sur les initiales de son nom (ex. "Solidarité et Entraide" → "see"). */
function baseIdentifiantOrganisation(nomOrg) {
  const mots = slugifier(nomOrg).split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return (mots[0] || 'org').slice(0, 6);
  return mots.map(m => m[0]).join('');
}

// Mots simples (thème solidarité/nature) utilisés pour générer des mots de passe mémorisables
// plutôt qu'une suite de caractères aléatoires illisible.
const MOTS_MDP = [
  'Soleil','Etoile','Riviere','Baobab','Colombe','Racine','Horizon','Lumiere','Village','Sourire',
  'Recolte','Semence','Tresor','Panier','Chemin','Espoir','Union','Fleuve','Montagne','Prairie',
  'Aurore','Foret','Perle','Corail','Jardin','Cascade','Vallee','Palmier','Etincelle','Ruche',
  'Grenier','Sentier','Rosee','Brise','Nuage','Comete','Faucon','Gazelle','Antilope','Flamme',
  'Boussole','Phare','Volcan','Oasis','Cocotier','Manguier','Tamtam','Griot','Caravane','Ecureuil',
];

/** Mot de passe mémorisable : deux mots + un nombre, unique et stable une fois envoyé. */
function genererMotDePasse() {
  const w1 = MOTS_MDP[Math.floor(Math.random() * MOTS_MDP.length)];
  let w2 = MOTS_MDP[Math.floor(Math.random() * MOTS_MDP.length)];
  while (w2 === w1) w2 = MOTS_MDP[Math.floor(Math.random() * MOTS_MDP.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${w1}${w2}${n}`;
}

async function genererCodeConfirmationUnique() {
  for (let i = 0; i < 20; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 chiffres
    const [rows] = await db.execute('SELECT 1 FROM GPOTB08_Paiement WHERE CodeConfirmation = ?', [code]);
    if (!rows.length) return code;
  }
  throw new Error('Impossible de générer un code de confirmation unique');
}

const DemandeService = {
  async accept(id, adminUser) {
    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    if (current !== 'En attente de validation')
      throw Object.assign(new Error(`La demande a déjà le statut : ${current}`), { status: 400 });

    const now = nowISO();
    let numAgrCible = demande.numAgr || null;

    // Créer l'organisation dans GPOTB01_Organisation si ce n'est pas une demande individuelle
    if (demande.typeOrg !== 'Individu' && demande.numAgr) {
      const existing = await OrganisationRepository.findById(demande.numAgr);
      if (!existing) {
        await OrganisationRepository.create({
          NumAgr:               demande.numAgr,
          LibOrg:               demande.nomOrg,
          DateCreOrg:           demande.dateCrea     || null,
          SiegeOrg:             demande.siegeOrg     || null,
          EmailOrg:             demande.emailOrg     || null,
          TelOrg:               (demande.telOrg || '').trim() || demande.repTel || null,
          IdTypOrg:             TYPE_ORG_ID[demande.typeOrg] || null,
          IdStatut:             4, // En attente — activée après paiement de la cotisation
          CodePays:             demande.codePays     || null,
          Description:          demande.description  || null,
          SiteWeb:              demande.siteWeb      || null,
          NomRepresentant:      [demande.repPrenom, demande.repNom].filter(Boolean).join(' ') || null,
          FonctionRepresentant: demande.repFonction  || null,
        });
      }
      numAgrCible = demande.numAgr;
    }

    let idAdhCible = null;
    let numAdherent = null;

    // Créer l'adhérent dans GPOTB02_Adherent si c'est une demande individuelle
    if (demande.typeOrg === 'Individu') {
      // Une même personne (même email) peut adhérer à plusieurs organisations : son numéro
      // d'adhérent (suffixe après le dernier tiret) doit rester identique partout — seul
      // l'identifiant de l'organisation change. On réutilise donc le suffixe déjà attribué s'il
      // existe (adhésion précédente ailleurs sur la plateforme).
      const suffixeExistant = demande.emailOrg ? await AdherentRepository.findSuffixByEmail(demande.emailOrg) : null;
      numAdherent = await AdherentRepository.generateNumAdherent(demande.numAgr || 'IND', suffixeExistant);
      const result = await AdherentRepository.create({
        NomAdh:        demande.repNom       || demande.nomOrg,
        PrenAdh:       demande.repPrenom    || null,
        DateNaissAdh:  demande.dateCrea     || null,
        EmailAdh:      demande.emailOrg     || null,
        TelAdh:        demande.telOrg       || null,
        AdrAdh:        demande.repAdresse   || demande.siegeOrg || null,
        NumAgr:        demande.numAgr       || null,
        IdStatut:      4, // En attente — activé après paiement de la cotisation
        DateAdhesion:  now,
        Photo:         demande.photoCNI     || null,
        NumCNI:        demande.repCNI       || null,
        Profession:    demande.profession   || null,
        FonctionAdh:   demande.fonctionSouhaitee || null,
        Sexe:          demande.sexe         || null,
        SituationMatrimoniale: demande.situationMatrimoniale || null,
        CodePays:      demande.codePays     || null,
        Nationalite:   demande.nationalite  || null,
        NumAdherent:   numAdherent,
      });
      idAdhCible = result.insertId;
    }

    // Une organisation peut avoir déjà réglé sa cotisation à l'inscription (routes/public.js /adhesion) —
    // dans ce cas, ne pas recréer un paiement ni redemander à payer : activer directement.
    const [[paiementExistant]] = await db.execute(
      `SELECT * FROM GPOTB08_Paiement WHERE idDemande = ? AND TypePaiement = 'Adhésion' ORDER BY IdPaiement DESC LIMIT 1`,
      [demande.idDemande]
    );
    const dejaPayee = !!(paiementExistant && paiementExistant.Statut === 'Payé');

    let idPaiement, montantAnnuel, codeDeviseFinal, codeConfirmation = null;

    if (dejaPayee) {
      idPaiement      = paiementExistant.IdPaiement;
      montantAnnuel   = paiementExistant.MontantPaiement;
      codeDeviseFinal = paiementExistant.CodeDevise;
      if (idAdhCible)       await AdherentRepository.update(idAdhCible, { IdStatut: 1 });
      else if (numAgrCible) await OrganisationRepository.update(numAgrCible, { IdStatut: 1 });
    } else {
      const codeDevise = demande.codeDevise || deviseDuPays(demande.codePays);
      const formules    = await getFormulesCotisation(numAgrCible, codeDevise);
      montantAnnuel   = formules.Annuelle;
      codeDeviseFinal = formules.CodeDevise;
      codeConfirmation = await genererCodeConfirmationUnique();

      const payResult = await PaiementRepository.create({
        DatePaiement:      todayDate(),
        MontantPaiement:   montantAnnuel,
        Statut:            'En attente',
        TypePaiement:      'Adhésion',
        idAdh:             idAdhCible,
        NumAgr:            numAgrCible,
        CodeDevise:        codeDeviseFinal,
        CodePays:          demande.codePays || null,
        idDemande:         demande.idDemande,
        ObjetPaiement:     'Cotisation annuelle — adhésion SoliDev',
        CodeConfirmation:  codeConfirmation,
      });
      idPaiement = payResult.insertId;
    }

    await DemandeRepository.accept(id, adminUser, now, current, dejaPayee ? 'Actif' : 'En attente de paiement');

    // Générer et envoyer les identifiants de connexion immédiatement (le paiement se fait après connexion)
    const role = idAdhCible ? 'adherent' : 'gestionnaire';

    // Un email n'est utilisable qu'une seule fois sur la plateforme (contrainte UNIQUE en base) :
    // chaque organisation/adhérent a donc un compte permanent et unique, dont l'identifiant et le
    // mot de passe — communiqués une seule fois par email — ne sont plus jamais régénérés. Si ce
    // point est atteint pour un email déjà lié à un compte (ne devrait pas arriver, la soumission
    // publique le bloque en amont), on réutilise ce compte sans le modifier plutôt que d'échouer.
    let username = null, password = null, idUserCible = null;
    let usernameExistant = null;
    if (demande.emailOrg) {
      const existingUser = await UserRepository.findByEmail(demande.emailOrg);
      if (existingUser) {
        // Compte déjà créé lors d'une adhésion précédente (même email, autre organisation) —
        // on ne régénère ni identifiant ni mot de passe, la personne se connecte avec ceux
        // qu'elle a déjà reçus ; on les rappelle dans l'email pour éviter toute confusion.
        idUserCible = existingUser.idUser;
        usernameExistant = existingUser.username;
      } else {
        // L'identifiant de connexion d'un adhérent est son NumAdherent codifié (CodePays+CodeType+
        // XXXX de l'organisation + YYYY de l'adhérent), en minuscules et sans tirets.
        const userBase = idAdhCible
          ? numAdherent.toLowerCase().replace(/-/g, '')
          : baseIdentifiantOrganisation(demande.nomOrg);
        username = await genererIdentifiantUnique(userBase);
        password = genererMotDePasse();
        const passwordHash = await AuthService.hashPassword(password);
        const userResult = await UserRepository.create({
          username, email: demande.emailOrg, passwordHash, role, isActive: 1,
          NumAgr: numAgrCible || null, idAdh: idAdhCible || null,
        });
        idUserCible = userResult.insertId;
      }
    }

    const mailResult = await emailSvc.sendMail(
      emailSvc.emailAccepteeAvecIdentifiants(demande, {
        username, password, montantAnnuel, codeDevise: codeDeviseFinal, dejaPayee,
        numAgrOrganisation: idAdhCible ? numAgrCible : null,
        usernameExistant,
      })
    );

    // Code de confirmation par SMS/WhatsApp — alternative pour payer sans se connecter (si pas déjà payé)
    const telephone = (demande.telOrg || demande.repTel || '').trim();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const smsResult = await notificationSvc.sendNotification({
      to: telephone,
      channel: process.env.NOTIFICATION_CHANNEL || 'whatsapp',
      message: dejaPayee
        ? `SoliDev ✅ Votre demande d'adhésion est acceptée et votre compte est actif ! Vos identifiants de connexion viennent de vous être envoyés par email.`
        : `SoliDev ✅ Votre demande d'adhésion est acceptée ! Vos identifiants de connexion viennent de vous être envoyés par email.\n`
          + `Vous pouvez aussi régler votre cotisation (${Number(montantAnnuel).toLocaleString('fr-FR')} ${codeDeviseFinal}/an) sans vous connecter avec ce code : ${codeConfirmation}\n`
          + `${appUrl}/verification`,
    });

    await AuditService.log('ACCEPTER_DEMANDE', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `Organisation: ${demande.nomOrg} | ${dejaPayee ? 'Cotisation déjà réglée — activée' : 'En attente de paiement'} | Identifiants: ${username ? 'créés (compte dédié)' : 'aucun email fourni'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'} | SMS/WhatsApp: ${smsResult.ok ? 'envoyé' : 'échec'}`,
      user: adminUser,
    });

    if (idUserCible) {
      await NotificationService.notifier({
        idUser: idUserCible,
        titre: '🎉 Demande d\'adhésion acceptée',
        contenu: dejaPayee
          ? `Votre compte pour "${demande.nomOrg}" est actif.`
          : `Votre demande pour "${demande.nomOrg}" est acceptée — réglez votre cotisation pour activer votre compte.`,
        type: 'demande',
        lien: dejaPayee ? '/dashboard' : '/paiements',
      });
    }

    return {
      message: dejaPayee ? 'Demande acceptée — compte activé (cotisation déjà réglée)' : 'Demande acceptée — identifiants envoyés par email',
      emailSent: mailResult.ok,
      notificationSent: smsResult.ok,
      idPaiement,
    };
  },

  /**
   * Appelée après confirmation d'un paiement d'adhésion (PaymentService.payer()), quel que soit le
   * canal utilisé (code public, lien public ou paiement authentifié depuis l'espace personnel) :
   * active simplement l'organisation/l'adhérent — les identifiants ont déjà été envoyés à l'acceptation.
   * Idempotent : ne fait rien si la demande n'est plus "En attente de paiement".
   */
  async completerApresPaiement(idDemande) {
    const demande = await DemandeRepository.findById(idDemande);
    if (!demande) return null;
    if (demande.statutAdhesion !== 'En attente de paiement') return null; // déjà traité ou statut manuel

    // Retrouver l'adhérent / l'organisation liés à cette demande via le paiement d'adhésion
    const [[pay]] = await db.execute(
      `SELECT idAdh, NumAgr FROM GPOTB08_Paiement WHERE idDemande = ? AND TypePaiement = 'Adhésion' ORDER BY IdPaiement DESC LIMIT 1`,
      [idDemande]
    );
    if (!pay) return null;

    let nom;
    if (pay.idAdh) {
      await AdherentRepository.update(pay.idAdh, { IdStatut: 1 });
      const adh = await AdherentRepository.findByIdFull(pay.idAdh);
      nom = `${adh.PrenAdh || ''} ${adh.NomAdh || ''}`.trim();
    } else if (pay.NumAgr) {
      await OrganisationRepository.update(pay.NumAgr, { IdStatut: 1 });
      const org = await OrganisationRepository.findByIdFull(pay.NumAgr);
      nom = org.LibOrg;
    } else {
      return null;
    }

    // Clôt le cycle de vie de la demande (empêche un second appel de réactiver/relancer l'activation)
    await DemandeRepository.update(idDemande, { statutAdhesion: 'Actif' });

    await AuditService.log('ACTIVER_ADHESION', null, {
      table: 'SD_DemandeAdhesion', id: idDemande,
      details: `${nom} activé après paiement de la cotisation`, user: 'système',
    });

    return { activated: true };
  },

  async refuse(id, adminUser, motif) {
    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    if (current !== 'En attente de validation')
      throw Object.assign(new Error(`La demande a déjà le statut : ${current}`), { status: 400 });

    const now = nowISO();
    await DemandeRepository.refuse(id, adminUser, now, motif, current);

    const mailResult = await emailSvc.sendMail(emailSvc.emailRefusee(demande, motif));
    await AuditService.log('REFUSER_DEMANDE', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `Organisation: ${demande.nomOrg} | Motif: ${motif || 'aucun'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'}`,
      user: adminUser,
    });

    return { message: 'Demande refusée', emailSent: mailResult.ok };
  },

  /**
   * Rejet pour document justificatif (agrément ministériel) jugé non authentique par l'admin
   * après vérification. Contrairement à refuse(), fonctionne à n'importe quel stade — y compris
   * après acceptation et paiement — puisqu'une fraude peut être découverte a posteriori. Aucun
   * remboursement n'est jamais déclenché ici : le paiement reste tel quel (statut inchangé),
   * conformément à l'avertissement donné à l'organisation/l'adhérent au moment du paiement.
   */
  async rejeterDocumentInvalide(id, adminUser, motif) {
    if (!motif || !motif.trim())
      throw Object.assign(new Error("Le motif est obligatoire pour un rejet pour document non authentique"), { status: 400 });

    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    const ETATS_TERMINAUX = ['Refusé', 'Radié', 'Exclu', 'Démissionnaire'];
    if (ETATS_TERMINAUX.includes(current))
      throw Object.assign(new Error(`La demande a déjà un statut définitif : ${current}`), { status: 400 });

    const now = nowISO();

    // Retrouve l'organisation/l'adhérent éventuellement déjà créé(e) pour cette demande, et si
    // sa cotisation a déjà été réglée — via le paiement d'adhésion, seul lien fiable vers idAdh/
    // NumAgr (la demande elle-même ne les conserve pas après acceptation).
    const [[paiement]] = await db.execute(
      `SELECT idAdh, NumAgr, Statut FROM GPOTB08_Paiement WHERE idDemande = ? ORDER BY IdPaiement DESC LIMIT 1`,
      [demande.idDemande]
    );
    const dejaReglee = !!(paiement && paiement.Statut === 'Payé');

    await DemandeRepository.refuse(id, adminUser, now, motif, current);

    if (paiement?.idAdh)          await fermerAdherent(paiement.idAdh);
    else if (paiement?.NumAgr)    await fermerOrganisation(paiement.NumAgr);

    const motifComplet = dejaReglee
      ? `${motif} Aucun remboursement ne sera effectué, conformément aux conditions communiquées lors du paiement de la cotisation.`
      : motif;
    const mailResult = await emailSvc.sendMail(emailSvc.emailRefusee(demande, motifComplet));

    await AuditService.log('REJETER_DOCUMENT_INVALIDE', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `${demande.nomOrg} | Document jugé non authentique | Motif: ${motif} | Paiement: ${dejaReglee ? 'conservé (aucun remboursement)' : 'aucun'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'}`,
      user: adminUser,
    });

    return { message: 'Rejetée pour document non authentique — aucun remboursement effectué', emailSent: mailResult.ok };
  },

  /**
   * Refus volontaire de l'admin pour un motif autre qu'un document non authentique (le document
   * reste valide) : contrairement à rejeterDocumentInvalide(), si la cotisation a déjà été
   * réglée, un remboursement partiel (taux configurable, cf. config/remboursement.js) est
   * exécuté immédiatement (pas d'offre
   * à accepter — c'est l'admin qui refuse, pas le demandeur qui se rétracte). Fonctionne à
   * n'importe quel stade, comme rejeterDocumentInvalide().
   */
  async refuserAvecRemboursement(id, adminUser, motif) {
    if (!motif || !motif.trim())
      throw Object.assign(new Error('Le motif est obligatoire pour ce refus'), { status: 400 });

    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    const ETATS_TERMINAUX = ['Refusé', 'Radié', 'Exclu', 'Démissionnaire'];
    if (ETATS_TERMINAUX.includes(current))
      throw Object.assign(new Error(`La demande a déjà un statut définitif : ${current}`), { status: 400 });

    const now = nowISO();
    const [[paiement]] = await db.execute(
      `SELECT IdPaiement, idAdh, NumAgr, Statut, MontantPaiement, CodeDevise FROM GPOTB08_Paiement
       WHERE idDemande = ? ORDER BY IdPaiement DESC LIMIT 1`,
      [demande.idDemande]
    );
    const dejaReglee = !!(paiement && paiement.Statut === 'Payé');
    const tauxRemboursementPct = getTauxRemboursementPct();
    const montantOffert = dejaReglee ? Math.round(paiement.MontantPaiement * tauxRemboursementPct / 100) : 0;

    await DemandeRepository.refuse(id, adminUser, now, motif, current);

    if (dejaReglee) {
      const [[admin]] = await db.execute(`SELECT idUser FROM GPOTB_Users WHERE username = ?`, [adminUser]);
      await db.execute(
        `INSERT INTO SD_Remboursement (idPaiement, numAgr, idAdh, montantRembourse, montantOffert, motif, statut, idValidateur, dateTraitement)
         VALUES (?, ?, ?, ?, ?, ?, 'Effectué', ?, ?)`,
        [paiement.IdPaiement, paiement.NumAgr || null, paiement.idAdh || null, paiement.MontantPaiement, montantOffert, motif, admin?.idUser || null, now]
      );
      await PaiementRepository.update(paiement.IdPaiement, { Statut: 'Remboursé' });
    }

    if (paiement?.idAdh)          await fermerAdherent(paiement.idAdh);
    else if (paiement?.NumAgr)    await fermerOrganisation(paiement.NumAgr);

    const motifComplet = dejaReglee
      ? `${motif} ${montantOffert.toLocaleString('fr-FR')} ${paiement.CodeDevise || ''} (${tauxRemboursementPct}% de votre cotisation) vous seront remboursés sous peu.`
      : motif;
    const mailResult = await emailSvc.sendMail(emailSvc.emailRefusee(demande, motifComplet));

    await AuditService.log('REFUSER_DEMANDE_AVEC_REMBOURSEMENT', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `${demande.nomOrg} | Refus volontaire (document valide) | Motif: ${motif} | Remboursement: ${dejaReglee ? montantOffert + ' (' + tauxRemboursementPct + '%)' : 'aucun paiement'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'}`,
      user: adminUser,
    });

    return {
      message: dejaReglee
        ? `Rejetée — remboursement de ${tauxRemboursementPct}% effectué (${montantOffert.toLocaleString('fr-FR')})`
        : 'Rejetée',
      emailSent: mailResult.ok,
      montantOffert,
    };
  },

  async changeStatut(id, nouveauStatut, adminUser, commentaire) {
    if (!STATUTS_MANUELS.includes(nouveauStatut))
      throw Object.assign(new Error(`Statut invalide : ${nouveauStatut}`), { status: 400 });

    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    if (current === 'En attente de validation')
      throw Object.assign(new Error('Utilisez Accepter ou Refuser pour les demandes en attente'), { status: 400 });

    const allowed = TRANSITIONS[current];
    if (allowed && !allowed.includes(nouveauStatut))
      throw Object.assign(new Error(`Transition non autorisée : ${current} → ${nouveauStatut}`), { status: 400 });

    const result = await DemandeRepository.changeStatut(id, nouveauStatut, adminUser, commentaire || null);

    await AuditService.log('CHANGER_STATUT', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `${result.ancienStatut} → ${nouveauStatut}${commentaire ? ' | ' + commentaire : ''}`,
      user: adminUser,
    });

    return { message: `Statut changé en "${nouveauStatut}"`, ...result };
  },

  /**
   * Un email ne peut servir qu'à une seule inscription sur la plateforme (compte permanent et
   * unique). À appeler à la soumission d'une demande (adhésion individu/organisation) pour
   * rejeter tout de suite un email déjà pris — par un compte existant ou une demande encore en
   * attente — plutôt que de laisser l'admin tomber sur un conflit au moment de l'acceptation.
   */
  async emailDejaUtilise(email) {
    if (!email) return false;
    const [[userRow]] = await db.execute('SELECT 1 FROM GPOTB_Users WHERE email = ?', [email]);
    if (userRow) return true;
    const [[demandeRow]] = await db.execute(
      `SELECT 1 FROM SD_DemandeAdhesion WHERE emailOrg = ? AND statutAdhesion = 'En attente de validation'`,
      [email]
    );
    return !!demandeRow;
  },

  /** Rôle du compte déjà lié à cet email sur la plateforme, ou null si l'email est libre. */
  async roleCompteExistant(email) {
    if (!email) return null;
    const [[row]] = await db.execute('SELECT role FROM GPOTB_Users WHERE email = ?', [email]);
    return row ? row.role : null;
  },

  /**
   * Un même individu (même email) peut adhérer à PLUSIEURS organisations — seule une nouvelle
   * demande vers une organisation où il est déjà membre (ou déjà en attente de validation) doit
   * être bloquée, pas les demandes vers les autres organisations.
   */
  async dejaMembreDe(email, numAgr) {
    if (!email || !numAgr) return false;
    const [[adhRow]] = await db.execute(
      `SELECT 1 FROM GPOTB02_Adherent WHERE EmailAdh = ? AND NumAgr = ?`, [email, numAgr]
    );
    if (adhRow) return true;
    const [[demandeRow]] = await db.execute(
      `SELECT 1 FROM SD_DemandeAdhesion WHERE emailOrg = ? AND numAgr = ? AND statutAdhesion = 'En attente de validation'`,
      [email, numAgr]
    );
    return !!demandeRow;
  },
};

module.exports = DemandeService;
module.exports.getFormulesCotisation = getFormulesCotisation;
module.exports.deviseDuPays = deviseDuPays;
module.exports.genererCodeConfirmationUnique = genererCodeConfirmationUnique;
module.exports.genererIdentifiantUnique = genererIdentifiantUnique;
module.exports.genererMotDePasse = genererMotDePasse;
module.exports.baseIdentifiantOrganisation = baseIdentifiantOrganisation;
