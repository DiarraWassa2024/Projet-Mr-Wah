const crypto                = require('crypto');
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
    candidate = `${base}${Math.floor(100 + Math.random() * 900)}`;
  }
  throw new Error("Impossible de générer un identifiant de connexion unique");
}

function genererMotDePasse() {
  return crypto.randomBytes(9).toString('base64url'); // ~12 caractères lisibles, URL-safe
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

    // Créer l'adhérent dans GPOTB02_Adherent si c'est une demande individuelle
    if (demande.typeOrg === 'Individu') {
      const numAdherent = await AdherentRepository.generateNumAdherent(demande.numAgr || 'IND');
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
        CodePays:      demande.codePays     || null,
        NumAdherent:   numAdherent,
      });
      idAdhCible = result.insertId;
    }

    // Créer le paiement de cotisation en attente (individus et organisations)
    const codeDevise = demande.codeDevise || deviseDuPays(demande.codePays);
    const formules    = await getFormulesCotisation(numAgrCible, codeDevise);
    const montantAnnuel = formules.Annuelle;

    const codeConfirmation = await genererCodeConfirmationUnique();

    const payResult = await PaiementRepository.create({
      DatePaiement:      todayDate(),
      MontantPaiement:   montantAnnuel,
      Statut:            'En attente',
      TypePaiement:      'Adhésion',
      idAdh:             idAdhCible,
      NumAgr:            numAgrCible,
      CodeDevise:        codeDevise,
      CodePays:          demande.codePays || null,
      idDemande:         demande.idDemande,
      ObjetPaiement:     'Cotisation annuelle — adhésion SoliDev',
      CodeConfirmation:  codeConfirmation,
    });
    const idPaiement = payResult.insertId;

    await DemandeRepository.accept(id, adminUser, now, current, 'En attente de paiement');

    // Générer et envoyer les identifiants de connexion immédiatement (le paiement se fait après connexion)
    const userBase = idAdhCible
      ? ((await AdherentRepository.findByIdFull(idAdhCible)).NumAdherent || `adh${idAdhCible}`).toLowerCase()
      : numAgrCible.toLowerCase().replace(/[^a-z0-9]/g, '');
    const role = idAdhCible ? 'adherent' : 'gestionnaire';

    let username = null, password = null;
    const existingUser = await UserRepository.findByEmail(demande.emailOrg);
    if (!existingUser && demande.emailOrg) {
      username = await genererIdentifiantUnique(userBase);
      password = genererMotDePasse();
      const passwordHash = await AuthService.hashPassword(password);
      await UserRepository.create({
        username, email: demande.emailOrg, passwordHash, role, isActive: 1,
        NumAgr: numAgrCible || null, idAdh: idAdhCible || null,
      });
    }

    const mailResult = await emailSvc.sendMail(
      emailSvc.emailAccepteeAvecIdentifiants(demande, { username, password, montantAnnuel, codeDevise: formules.CodeDevise })
    );

    // Code de confirmation par SMS/WhatsApp — alternative pour payer sans se connecter
    const telephone = (demande.telOrg || demande.repTel || '').trim();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const smsResult = await notificationSvc.sendNotification({
      to: telephone,
      channel: process.env.NOTIFICATION_CHANNEL || 'whatsapp',
      message: `SoliDev ✅ Votre demande d'adhésion est acceptée ! Vos identifiants de connexion viennent de vous être envoyés par email.\n`
        + `Vous pouvez aussi régler votre cotisation (${Number(formules.Annuelle).toLocaleString('fr-FR')} ${formules.CodeDevise}/an) sans vous connecter avec ce code : ${codeConfirmation}\n`
        + `${appUrl}/verification`,
    });

    await AuditService.log('ACCEPTER_DEMANDE', null, {
      table: 'SD_DemandeAdhesion', id: demande.idDemande,
      details: `Organisation: ${demande.nomOrg} | En attente de paiement | Identifiants: ${username ? 'créés' : 'compte existant'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'} | SMS/WhatsApp: ${smsResult.ok ? 'envoyé' : 'échec'}`,
      user: adminUser,
    });

    return {
      message: 'Demande acceptée — identifiants envoyés par email',
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
};

module.exports = DemandeService;
