const DemandeRepository      = require('../repositories/DemandeRepository');
const AdherentRepository     = require('../repositories/AdherentRepository');
const OrganisationRepository = require('../repositories/OrganisationRepository');
const AuditService           = require('./AuditService');
const emailSvc               = require('./email');
const { nowISO }             = require('../helpers/dateHelper');

const TYPE_ORG_ID = { 'Association': 1, 'ONG': 2, 'Mutuelle': 6 };

const STATUTS_MANUELS = ['Actif', 'Suspendu', 'Radié', 'Exclu', 'Démissionnaire'];

const TRANSITIONS = {
  'Actif':    ['Suspendu', 'Radié', 'Exclu', 'Démissionnaire'],
  'Suspendu': ['Actif',    'Radié', 'Exclu', 'Démissionnaire'],
};

const DemandeService = {
  async accept(id, adminUser) {
    const demande = await DemandeRepository.findById(id);
    if (!demande) throw Object.assign(new Error('Demande introuvable'), { status: 404 });

    const current = demande.statutAdhesion || 'En attente de validation';
    if (current !== 'En attente de validation')
      throw Object.assign(new Error(`La demande a déjà le statut : ${current}`), { status: 400 });

    const now = nowISO();
    await DemandeRepository.accept(id, adminUser, now, current);

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
          IdStatut:             1,
          CodePays:             demande.codePays     || null,
          Description:          demande.description  || null,
          SiteWeb:              demande.siteWeb      || null,
          NomRepresentant:      [demande.repPrenom, demande.repNom].filter(Boolean).join(' ') || null,
          FonctionRepresentant: demande.repFonction  || null,
        });
      }
    }

    // Créer l'adhérent dans GPOTB02_Adherent si c'est une demande individuelle
    if (demande.typeOrg === 'Individu') {
      const numAdherent = await AdherentRepository.generateNumAdherent(demande.numAgr || 'IND');
      await AdherentRepository.create({
        NomAdh:        demande.repNom       || demande.nomOrg,
        PrenAdh:       demande.repPrenom    || null,
        DateNaissAdh:  demande.dateCrea     || null,
        EmailAdh:      demande.emailOrg     || null,
        TelAdh:        demande.telOrg       || null,
        AdrAdh:        demande.repAdresse   || demande.siegeOrg || null,
        NumAgr:        demande.numAgr       || null,
        IdStatut:      1,
        DateAdhesion:  now,
        Photo:         demande.photoCNI     || null,
        NumCNI:        demande.repCNI       || null,
        Profession:    demande.profession   || null,
        FonctionAdh:   demande.fonctionSouhaitee || null,
        Sexe:          demande.sexe         || null,
        CodePays:      demande.codePays     || null,
        NumAdherent:   numAdherent,
      });
    }

    const mailResult = await emailSvc.sendMail(emailSvc.emailAcceptee(demande));
    await AuditService.log(
      'ACCEPTER_DEMANDE', 'SD_DemandeAdhesion', demande.idDemande,
      `Organisation: ${demande.nomOrg} | Email: ${mailResult.ok ? 'envoyé' : 'échec'}`,
      adminUser
    );

    return { message: 'Demande acceptée', emailSent: mailResult.ok };
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
    await AuditService.log(
      'REFUSER_DEMANDE', 'SD_DemandeAdhesion', demande.idDemande,
      `Organisation: ${demande.nomOrg} | Motif: ${motif || 'aucun'} | Email: ${mailResult.ok ? 'envoyé' : 'échec'}`,
      adminUser
    );

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

    await AuditService.log(
      'CHANGER_STATUT', 'SD_DemandeAdhesion', demande.idDemande,
      `${result.ancienStatut} → ${nouveauStatut}${commentaire ? ' | ' + commentaire : ''}`,
      adminUser
    );

    return { message: `Statut changé en "${nouveauStatut}"`, ...result };
  },
};

module.exports = DemandeService;
