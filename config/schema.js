/* Schéma SQLite complet de la BD GPO — v2.0
   6 nouvelles tables | ~40 colonnes ajoutées | 16 index | données de référence complètes */
const db = require('./database').raw;

module.exports = function initSchema() {

  // ============================================================
  // PRAGMA
  // ============================================================
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
  -- ============================================================
  -- TABLES DE RÉFÉRENCE EXISTANTES
  -- ============================================================

  CREATE TABLE IF NOT EXISTS GPOTB03_Pays (
    CodePays      TEXT NOT NULL PRIMARY KEY,
    LibPays       TEXT NOT NULL,
    Latitude      REAL,
    Longitude     REAL,
    CodeIndicatif TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB07_TypeOrganisation (
    IdTypOrg  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibTypOrg TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB09_VocationOrganisation (
    IdVocOrg  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibVocOrg TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB10_ReglementInterieur (
    IdRegleInt  INTEGER PRIMARY KEY AUTOINCREMENT,
    NomRegleInt TEXT NOT NULL,
    DateAdoption TEXT,
    Contenu      TEXT,
    NumAgr       TEXT,
    Version      TEXT DEFAULT '1.0'
  );

  CREATE TABLE IF NOT EXISTS GPOTB11_Role (
    IdRole  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibRole TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB12_Sexe (
    IdSexe  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibSexe TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB13_MoyenPaiement (
    IdMoyPay  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibMoyPay TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB15_Statut (
    IdStatut  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibStatut TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB17_TypePrestation (
    IdTypPrest  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibTypPrest TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB19_PieceIdentite (
    IdPieceIdenti  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibPieceIdenti TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB20_SituationMatrimoniale (
    IdSituMat  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibSituMat TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB22_Filiation (
    idFil  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibFil TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS GPOTB23_TypeFiliation (
    idTypFil  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibTypFil TEXT NOT NULL UNIQUE
  );

  -- ============================================================
  -- NOUVELLES TABLES DE RÉFÉRENCE
  -- ============================================================

  -- Devises (support multi-monnaie)
  CREATE TABLE IF NOT EXISTS GPOTB27_Devise (
    CodeDevise         TEXT NOT NULL PRIMARY KEY,
    LibDevise          TEXT NOT NULL,
    Symbole            TEXT,
    TauxParRapportEuro REAL NOT NULL DEFAULT 1.0,
    EstActif           INTEGER NOT NULL DEFAULT 1 CHECK(EstActif IN (0,1))
  );

  -- Ministères de tutelle par pays
  CREATE TABLE IF NOT EXISTS GPOTB28_Ministere (
    IdMinistere  INTEGER PRIMARY KEY AUTOINCREMENT,
    LibMinistere TEXT NOT NULL,
    CodePays     TEXT NOT NULL REFERENCES GPOTB03_Pays(CodePays) ON UPDATE CASCADE,
    Domaine      TEXT,
    ContactEmail TEXT,
    ContactTel   TEXT
  );

  -- ============================================================
  -- TABLES PRINCIPALES EXISTANTES
  -- ============================================================

  CREATE TABLE IF NOT EXISTS GPOTB01_Organisation (
    NumAgr               TEXT NOT NULL PRIMARY KEY,
    LibOrg               TEXT NOT NULL,
    DateCreOrg           TEXT,
    SiegeOrg             TEXT,
    EmailOrg             TEXT,
    TelOrg               TEXT,
    IdTypOrg             INTEGER REFERENCES GPOTB07_TypeOrganisation(IdTypOrg),
    IdVocOrg             INTEGER REFERENCES GPOTB09_VocationOrganisation(IdVocOrg),
    IdStatut             INTEGER REFERENCES GPOTB15_Statut(IdStatut),
    CodePays             TEXT    REFERENCES GPOTB03_Pays(CodePays),
    IdRegleInt           INTEGER REFERENCES GPOTB10_ReglementInterieur(IdRegleInt),
    CodeDevise           TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
    IdMinistere          INTEGER REFERENCES GPOTB28_Ministere(IdMinistere),
    Description          TEXT,
    SiteWeb              TEXT,
    Logo                 TEXT,
    NomRepresentant      TEXT,
    FonctionRepresentant TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB04_Personne (
    idPers        INTEGER PRIMARY KEY AUTOINCREMENT,
    NomPers       TEXT NOT NULL,
    PrenomPers    TEXT,
    TelPers       TEXT,
    AdrPers       TEXT,
    EmailPers     TEXT,
    DateNaissPers TEXT,
    IdSexe        INTEGER REFERENCES GPOTB12_Sexe(IdSexe),
    IdSituMat     INTEGER REFERENCES GPOTB20_SituationMatrimoniale(IdSituMat),
    IdPieceIdenti INTEGER REFERENCES GPOTB19_PieceIdentite(IdPieceIdenti),
    NumeroPiece   TEXT,
    CodePays      TEXT REFERENCES GPOTB03_Pays(CodePays),
    Photo         TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB02_Adherent (
    idAdh        INTEGER PRIMARY KEY AUTOINCREMENT,
    NomAdh       TEXT NOT NULL,
    PrenAdh      TEXT,
    DateNaissAdh TEXT,
    EmailAdh     TEXT,
    AdrAdh       TEXT,
    TelAdh       TEXT,
    idPers       INTEGER REFERENCES GPOTB04_Personne(idPers),
    NumAgr       TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    IdRole       INTEGER REFERENCES GPOTB11_Role(IdRole),
    FonctionAdh  TEXT,
    IdStatut     INTEGER REFERENCES GPOTB15_Statut(IdStatut),
    DateAdhesion TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB05_PrestataireMoral (
    rcc      TEXT NOT NULL PRIMARY KEY,
    cptCot   TEXT,
    logo     TEXT,
    Siege    TEXT,
    DateCrea TEXT,
    NomOrg   TEXT NOT NULL,
    EmailOrg TEXT,
    TelOrg   TEXT,
    SiteWeb  TEXT,
    CodePays TEXT REFERENCES GPOTB03_Pays(CodePays)
  );

  CREATE TABLE IF NOT EXISTS GPOTB06_Beneficiaire (
    idBenef        INTEGER PRIMARY KEY AUTOINCREMENT,
    idPers         INTEGER NOT NULL REFERENCES GPOTB04_Personne(idPers),
    NumAgr         TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    DateDebut      TEXT,
    DateFin        TEXT,
    IdStatut       INTEGER REFERENCES GPOTB15_Statut(IdStatut),
    TypeBenef      TEXT DEFAULT 'Personne' CHECK(TypeBenef IN ('Personne','Famille','Groupe')),
    NombreMembres  INTEGER DEFAULT 1 CHECK(NombreMembres >= 1),
    Observations   TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB08_Paiement (
    IdPaiement      INTEGER PRIMARY KEY AUTOINCREMENT,
    DatePaiement    TEXT NOT NULL,
    MontantPaiement REAL NOT NULL CHECK(MontantPaiement >= 0),
    Statut          TEXT DEFAULT 'En attente' CHECK(Statut IN ('En attente','Validé','Rejeté','Remboursé')),
    TypePaiement    TEXT DEFAULT 'Cotisation' CHECK(TypePaiement IN ('Cotisation','Don','Prestation','Autres')),
    idAdh           INTEGER REFERENCES GPOTB02_Adherent(idAdh),
    IdMoyPay        INTEGER REFERENCES GPOTB13_MoyenPaiement(IdMoyPay),
    NumAgr          TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    CodeDevise      TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
    Reference       TEXT,
    NotePaiement    TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB14_Cotisation (
    IdCoti         INTEGER PRIMARY KEY AUTOINCREMENT,
    MontantCoti    REAL NOT NULL CHECK(MontantCoti >= 0),
    PeriodeCoti    TEXT,
    TypeCotisation TEXT DEFAULT 'Mensuelle'
                        CHECK(TypeCotisation IN ('Mensuelle','Trimestrielle','Semestrielle','Annuelle','Ponctuelle')),
    DateEcheance   TEXT,
    Obligatoire    INTEGER DEFAULT 1 CHECK(Obligatoire IN (0,1)),
    CodeDevise     TEXT REFERENCES GPOTB27_Devise(CodeDevise),
    NumAgr         TEXT REFERENCES GPOTB01_Organisation(NumAgr)
  );

  CREATE TABLE IF NOT EXISTS GPOTB16_Prestation (
    IdPrest      INTEGER PRIMARY KEY AUTOINCREMENT,
    LibPrest     TEXT NOT NULL,
    Description  TEXT,
    DatePrest    TEXT,
    MontantPrest REAL CHECK(MontantPrest >= 0),
    CodeDevise   TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
    IdTypPrest   INTEGER REFERENCES GPOTB17_TypePrestation(IdTypPrest),
    NumAgr       TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    rcc          TEXT    REFERENCES GPOTB05_PrestataireMoral(rcc),
    PieceJointe  TEXT,
    IdPaiement   INTEGER REFERENCES GPOTB08_Paiement(IdPaiement)
  );

  CREATE TABLE IF NOT EXISTS GPOTB18_PrestatairePhysique (
    IdPrestataire           INTEGER PRIMARY KEY AUTOINCREMENT,
    NomPrestataire          TEXT NOT NULL,
    PrenPrestataire         TEXT,
    DateNaissPrestataire    TEXT,
    TelPrestataire          TEXT,
    EmailPrestataire        TEXT,
    LienAcabitatPrestataire TEXT,
    Specialite              TEXT,
    CodePays                TEXT REFERENCES GPOTB03_Pays(CodePays)
  );

  CREATE TABLE IF NOT EXISTS GPOTB21_Evenement (
    IdEven              INTEGER PRIMARY KEY AUTOINCREMENT,
    LibEven             TEXT NOT NULL,
    DateDebut           TEXT,
    DateFin             TEXT,
    Heuraux             TEXT,
    LieuEven            TEXT,
    DescEven            TEXT,
    Statut              TEXT DEFAULT 'Planifié'
                             CHECK(Statut IN ('Planifié','En cours','Terminé','Annulé')),
    NombreParticipants  INTEGER DEFAULT 0 CHECK(NombreParticipants >= 0),
    PieceJointe         TEXT,
    NumAgr              TEXT REFERENCES GPOTB01_Organisation(NumAgr)
  );

  CREATE TABLE IF NOT EXISTS GPOTB24_Demande (
    IdDemande        INTEGER PRIMARY KEY AUTOINCREMENT,
    PrenomPers       TEXT,
    DateNaiss        TEXT,
    idPers           INTEGER REFERENCES GPOTB04_Personne(idPers),
    NumAgr           TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    TypeDemande      TEXT,
    DateDemande      TEXT DEFAULT (datetime('now')),
    IdStatut         INTEGER REFERENCES GPOTB15_Statut(IdStatut),
    MotifRefus       TEXT,
    DateTraitement   TEXT,
    AdminTraitement  TEXT,
    PiecesJointes    TEXT
  );

  CREATE TABLE IF NOT EXISTS GPOTB25_Enregistrement (
    IdEnregistrement   INTEGER PRIMARY KEY AUTOINCREMENT,
    dateEnregistrement TEXT NOT NULL DEFAULT (datetime('now')),
    NumAgr             TEXT REFERENCES GPOTB01_Organisation(NumAgr),
    idPers             INTEGER REFERENCES GPOTB04_Personne(idPers),
    TypeEnregistrement TEXT
  );

  -- Repurposed: Documents officiels liés aux organisations
  CREATE TABLE IF NOT EXISTS GPOTB26_Document (
    IdDoc         INTEGER PRIMARY KEY AUTOINCREMENT,
    LibDoc        TEXT NOT NULL,
    TypeDoc       TEXT DEFAULT 'Autre'
                       CHECK(TypeDoc IN ('Statuts','PV Assemblée','Rapport annuel','Attestation','Autre')),
    CheminFichier TEXT,
    DateDocument  TEXT,
    NumAgr        TEXT REFERENCES GPOTB01_Organisation(NumAgr),
    DateCreation  TEXT DEFAULT (datetime('now'))
  );

  -- ============================================================
  -- NOUVELLES TABLES PRINCIPALES
  -- ============================================================

  -- Autorisations accordées par les ministères aux organisations
  CREATE TABLE IF NOT EXISTS GPOTB29_AutorisationMinistere (
    IdAutorMin         INTEGER PRIMARY KEY AUTOINCREMENT,
    NumAgr             TEXT    NOT NULL REFERENCES GPOTB01_Organisation(NumAgr),
    IdMinistere        INTEGER NOT NULL REFERENCES GPOTB28_Ministere(IdMinistere),
    NumeroDecision     TEXT,
    DateAutorisation   TEXT    NOT NULL,
    DateExpiration     TEXT,
    StatutAutorisation TEXT NOT NULL DEFAULT 'Valide'
                           CHECK(StatutAutorisation IN ('Valide','Expirée','Révoquée','En attente')),
    DocumentPath       TEXT,
    Observations       TEXT
  );

  -- Messagerie interne (utilisateur ↔ utilisateur, broadcast org)
  CREATE TABLE IF NOT EXISTS GPOTB30_Message (
    IdMessage       INTEGER PRIMARY KEY AUTOINCREMENT,
    Sujet           TEXT NOT NULL,
    Contenu         TEXT NOT NULL,
    IdExpediteur    INTEGER REFERENCES GPOTB_Users(idUser),
    IdDestinataire  INTEGER REFERENCES GPOTB_Users(idUser),
    NumAgrDest      TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    DateEnvoi       TEXT NOT NULL DEFAULT (datetime('now')),
    Lu              INTEGER NOT NULL DEFAULT 0 CHECK(Lu IN (0,1)),
    DateLecture     TEXT,
    TypeMessage     TEXT NOT NULL DEFAULT 'direct'
                        CHECK(TypeMessage IN ('direct','broadcast','notification','alerte'))
  );

  -- Groupes d'utilisateurs (par organisation ou thématique)
  CREATE TABLE IF NOT EXISTS GPOTB31_GroupeUtilisateur (
    IdGroupe     INTEGER PRIMARY KEY AUTOINCREMENT,
    LibGroupe    TEXT NOT NULL,
    Description  TEXT,
    NumAgr       TEXT REFERENCES GPOTB01_Organisation(NumAgr),
    DateCreation TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ============================================================
  -- TABLES D'ASSOCIATION
  -- ============================================================

  CREATE TABLE IF NOT EXISTS GPOTB_PersonneFiliation (
    idPers    INTEGER NOT NULL REFERENCES GPOTB04_Personne(idPers),
    idPersLie INTEGER NOT NULL REFERENCES GPOTB04_Personne(idPers),
    idTypFil  INTEGER NOT NULL REFERENCES GPOTB23_TypeFiliation(idTypFil),
    idFil     INTEGER REFERENCES GPOTB22_Filiation(idFil),
    PRIMARY KEY (idPers, idPersLie, idTypFil)
  );

  CREATE TABLE IF NOT EXISTS GPOTB_PrestationBeneficiaire (
    IdPrest     INTEGER NOT NULL REFERENCES GPOTB16_Prestation(IdPrest),
    idBenef     INTEGER NOT NULL REFERENCES GPOTB06_Beneficiaire(idBenef),
    DateOctroie TEXT,
    PRIMARY KEY (IdPrest, idBenef)
  );

  -- Association utilisateur ↔ groupe
  CREATE TABLE IF NOT EXISTS GPOTB_UserGroupe (
    idUser    INTEGER NOT NULL REFERENCES GPOTB_Users(idUser)  ON DELETE CASCADE,
    IdGroupe  INTEGER NOT NULL REFERENCES GPOTB31_GroupeUtilisateur(IdGroupe) ON DELETE CASCADE,
    DateAjout TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (idUser, IdGroupe)
  );

  -- ============================================================
  -- TABLES SYSTÈME (SD_)
  -- ============================================================

  -- Demandes d'adhésion publiques (formulaire)
  CREATE TABLE IF NOT EXISTS SD_DemandeAdhesion (
    idDemande       INTEGER PRIMARY KEY AUTOINCREMENT,
    typeOrg         TEXT NOT NULL DEFAULT 'Association',
    nomOrg          TEXT NOT NULL,
    numAgr          TEXT,
    emailOrg        TEXT NOT NULL,
    telOrg          TEXT,
    codePays        TEXT,
    libPays         TEXT,
    siegeOrg        TEXT,
    siteWeb         TEXT,
    dateCrea        TEXT,
    description     TEXT,
    vocation        TEXT,
    ministere       TEXT,
    IdMinistere     INTEGER REFERENCES GPOTB28_Ministere(IdMinistere),
    docAgrement     TEXT,
    repNom          TEXT,
    repPrenom       TEXT,
    repFonction     TEXT,
    repAdresse      TEXT,
    repTel          TEXT,
    repEmail        TEXT,
    repCNI          TEXT,
    codeDevise      TEXT REFERENCES GPOTB27_Devise(CodeDevise),
    statut          TEXT NOT NULL DEFAULT 'En attente'
                         CHECK(statut IN ('En attente','Acceptée','Refusée')),
    dateDemande     TEXT NOT NULL DEFAULT (datetime('now')),
    dateTraitement  TEXT,
    adminTraitement TEXT,
    motifRefus      TEXT
  );

  -- Opportunités publiées
  CREATE TABLE IF NOT EXISTS SD_Opportunite (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    titre           TEXT NOT NULL,
    categorie       TEXT,
    domaine         TEXT,
    description     TEXT,
    dateLimite      TEXT,
    lien            TEXT,
    budget          REAL CHECK(budget >= 0),
    codeDevise      TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
    numAgr          TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    auteur          TEXT,
    statut          TEXT NOT NULL DEFAULT 'Active'
                         CHECK(statut IN ('Active','Clôturée','Annulée')),
    datePublication TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Besoins exprimés (expression de besoin)
  CREATE TABLE IF NOT EXISTS SD_BesoinExprime (
    IdDemande        INTEGER PRIMARY KEY AUTOINCREMENT,
    nom              TEXT NOT NULL,
    email            TEXT,
    organisation     TEXT,
    numAgr           TEXT REFERENCES GPOTB01_Organisation(NumAgr),
    typeBesoin       TEXT,
    typeEntite       TEXT,
    description      TEXT,
    budgetEstimatif  REAL CHECK(budgetEstimatif >= 0),
    codeDevise       TEXT REFERENCES GPOTB27_Devise(CodeDevise),
    priorite         TEXT NOT NULL DEFAULT 'Normale'
                          CHECK(priorite IN ('Faible','Normale','Haute','Urgente')),
    statut           TEXT NOT NULL DEFAULT 'En attente',
    DateDemande      TEXT NOT NULL DEFAULT (datetime('now')),
    dateTraitement   TEXT,
    adminTraitement  TEXT
  );

  -- Dons reçus
  CREATE TABLE IF NOT EXISTS SD_Don (
    idDon        INTEGER PRIMARY KEY AUTOINCREMENT,
    montant      REAL    NOT NULL CHECK(montant > 0),
    codeDevise   TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
    cause        TEXT,
    message      TEXT,
    nom          TEXT,
    email        TEXT,
    tel          TEXT,
    numAgr       TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    modePaiement TEXT    DEFAULT 'mobile_money',
    reference    TEXT,
    anonyme      INTEGER NOT NULL DEFAULT 0 CHECK(anonyme IN (0,1)),
    statut       TEXT    NOT NULL DEFAULT 'Reçu'
                         CHECK(statut IN ('Reçu','Validé','Remboursé','Annulé')),
    dateDon      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Journal d'activité (piste d'audit)
  CREATE TABLE IF NOT EXISTS SD_LogActivite (
    idLog       INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    table_cible TEXT,
    id_cible    INTEGER,
    details     TEXT,
    adminUser   TEXT,
    dateAction  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Utilisateurs (authentification)
  CREATE TABLE IF NOT EXISTS GPOTB_Users (
    idUser       INTEGER PRIMARY KEY AUTOINCREMENT,
    username     TEXT NOT NULL UNIQUE,
    email        TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT 'gestionnaire'
                      CHECK(role IN ('admin','gestionnaire','adherent')),
    isActive     INTEGER NOT NULL DEFAULT 1 CHECK(isActive IN (0,1)),
    NumAgr       TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
    idAdh        INTEGER REFERENCES GPOTB02_Adherent(idAdh),
    lastLoginAt  TEXT,
    avatar       TEXT,
    createdAt    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Index sur colonnes existantes dès le départ (tables + colonnes déjà présentes)
  CREATE INDEX IF NOT EXISTS idx_adherent_numAgr    ON GPOTB02_Adherent(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_adherent_statut    ON GPOTB02_Adherent(IdStatut);
  CREATE INDEX IF NOT EXISTS idx_adherent_role      ON GPOTB02_Adherent(IdRole);
  CREATE INDEX IF NOT EXISTS idx_paiement_idAdh     ON GPOTB08_Paiement(idAdh);
  CREATE INDEX IF NOT EXISTS idx_paiement_numAgr    ON GPOTB08_Paiement(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_paiement_statut    ON GPOTB08_Paiement(Statut);
  CREATE INDEX IF NOT EXISTS idx_paiement_date      ON GPOTB08_Paiement(DatePaiement);
  CREATE INDEX IF NOT EXISTS idx_org_statut         ON GPOTB01_Organisation(IdStatut);
  CREATE INDEX IF NOT EXISTS idx_org_pays           ON GPOTB01_Organisation(CodePays);
  CREATE INDEX IF NOT EXISTS idx_org_type           ON GPOTB01_Organisation(IdTypOrg);
  CREATE INDEX IF NOT EXISTS idx_benef_numAgr       ON GPOTB06_Beneficiaire(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_prestation_numAgr  ON GPOTB16_Prestation(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_personne_nom       ON GPOTB04_Personne(NomPers, PrenomPers);
  CREATE INDEX IF NOT EXISTS idx_demande_statut     ON SD_DemandeAdhesion(statut);
  CREATE INDEX IF NOT EXISTS idx_demande_date       ON SD_DemandeAdhesion(dateDemande);
  CREATE INDEX IF NOT EXISTS idx_log_table_cible    ON SD_LogActivite(table_cible, id_cible);
  CREATE INDEX IF NOT EXISTS idx_log_date           ON SD_LogActivite(dateAction);
  CREATE INDEX IF NOT EXISTS idx_ministere_pays     ON GPOTB28_Ministere(CodePays);
  CREATE INDEX IF NOT EXISTS idx_don_statut         ON SD_Don(statut);
  CREATE INDEX IF NOT EXISTS idx_users_role         ON GPOTB_Users(role);
  CREATE INDEX IF NOT EXISTS idx_evenement_numAgr   ON GPOTB21_Evenement(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_cotisation_numAgr  ON GPOTB14_Cotisation(NumAgr);

  -- Index sur nouvelles tables (créées ci-dessus — colonnes garanties)
  CREATE INDEX IF NOT EXISTS idx_automin_numAgr     ON GPOTB29_AutorisationMinistere(NumAgr);
  CREATE INDEX IF NOT EXISTS idx_automin_statut     ON GPOTB29_AutorisationMinistere(StatutAutorisation);
  CREATE INDEX IF NOT EXISTS idx_message_dest_lu    ON GPOTB30_Message(IdDestinataire, Lu);
  CREATE INDEX IF NOT EXISTS idx_message_exped      ON GPOTB30_Message(IdExpediteur);
  CREATE INDEX IF NOT EXISTS idx_message_org        ON GPOTB30_Message(NumAgrDest);
  `);

  // ============================================================
  // MIGRATIONS — colonnes ajoutées sur tables existantes
  // ============================================================
  const migrations = [
    // SD_DemandeAdhesion — colonnes déjà migrées précédemment (garde pour compatibilité)
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN ministere TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN docAgrement TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN repAdresse TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN repTel TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN repEmail TEXT`,
    // SD_DemandeAdhesion — nouvelles colonnes
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN vocation TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN IdMinistere INTEGER`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN codeDevise TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN siteWeb TEXT`,
    // GPOTB01_Organisation — nouvelles colonnes
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN CodeDevise TEXT`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN IdMinistere INTEGER`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN Description TEXT`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN SiteWeb TEXT`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN Logo TEXT`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN NomRepresentant TEXT`,
    `ALTER TABLE GPOTB01_Organisation ADD COLUMN FonctionRepresentant TEXT`,
    // GPOTB02_Adherent
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN TelAdh TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN FonctionAdh TEXT`,
    // GPOTB04_Personne
    `ALTER TABLE GPOTB04_Personne ADD COLUMN Photo TEXT`,
    // GPOTB05_PrestataireMoral
    `ALTER TABLE GPOTB05_PrestataireMoral ADD COLUMN SiteWeb TEXT`,
    `ALTER TABLE GPOTB05_PrestataireMoral ADD COLUMN IdStatut INTEGER REFERENCES GPOTB15_Statut(IdStatut)`,
    `ALTER TABLE GPOTB05_PrestataireMoral ADD COLUMN DateCreation TEXT`,
    // GPOTB06_Beneficiaire
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN TypeBenef TEXT DEFAULT 'Personne'`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN NombreMembres INTEGER DEFAULT 1`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN Observations TEXT`,
    // GPOTB08_Paiement
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN CodeDevise TEXT`,
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN TypePaiement TEXT DEFAULT 'Cotisation'`,
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN NotePaiement TEXT`,
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN idDemande INTEGER REFERENCES SD_DemandeAdhesion(idDemande)`,
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN Operateur TEXT`,
    `ALTER TABLE GPOTB08_Paiement ADD COLUMN CodeConfirmation TEXT`,
    // GPOTB10_ReglementInterieur
    `ALTER TABLE GPOTB10_ReglementInterieur ADD COLUMN DateAdoption TEXT`,
    `ALTER TABLE GPOTB10_ReglementInterieur ADD COLUMN Contenu TEXT`,
    `ALTER TABLE GPOTB10_ReglementInterieur ADD COLUMN NumAgr TEXT`,
    `ALTER TABLE GPOTB10_ReglementInterieur ADD COLUMN Version TEXT DEFAULT '1.0'`,
    // GPOTB14_Cotisation
    `ALTER TABLE GPOTB14_Cotisation ADD COLUMN CodeDevise TEXT`,
    `ALTER TABLE GPOTB14_Cotisation ADD COLUMN TypeCotisation TEXT DEFAULT 'Mensuelle'`,
    `ALTER TABLE GPOTB14_Cotisation ADD COLUMN Obligatoire INTEGER DEFAULT 1`,
    `ALTER TABLE GPOTB14_Cotisation ADD COLUMN EstDefaut INTEGER DEFAULT 0`,
    // GPOTB16_Prestation
    `ALTER TABLE GPOTB16_Prestation ADD COLUMN Description TEXT`,
    `ALTER TABLE GPOTB16_Prestation ADD COLUMN CodeDevise TEXT`,
    `ALTER TABLE GPOTB16_Prestation ADD COLUMN PieceJointe TEXT`,
    `ALTER TABLE GPOTB16_Prestation ADD COLUMN IdPaiement INTEGER`,
    // GPOTB18_PrestatairePhysique
    `ALTER TABLE GPOTB18_PrestatairePhysique ADD COLUMN EmailPrestataire TEXT`,
    `ALTER TABLE GPOTB18_PrestatairePhysique ADD COLUMN Specialite TEXT`,
    `ALTER TABLE GPOTB18_PrestatairePhysique ADD COLUMN IdStatut INTEGER REFERENCES GPOTB15_Statut(IdStatut)`,
    `ALTER TABLE GPOTB18_PrestatairePhysique ADD COLUMN DateCreation TEXT`,
    // GPOTB21_Evenement
    `ALTER TABLE GPOTB21_Evenement ADD COLUMN DateDebut TEXT`,
    `ALTER TABLE GPOTB21_Evenement ADD COLUMN DateFin TEXT`,
    `ALTER TABLE GPOTB21_Evenement ADD COLUMN Statut TEXT DEFAULT 'Planifié'`,
    `ALTER TABLE GPOTB21_Evenement ADD COLUMN NombreParticipants INTEGER DEFAULT 0`,
    `ALTER TABLE GPOTB21_Evenement ADD COLUMN PieceJointe TEXT`,
    // GPOTB24_Demande
    `ALTER TABLE GPOTB24_Demande ADD COLUMN MotifRefus TEXT`,
    `ALTER TABLE GPOTB24_Demande ADD COLUMN DateTraitement TEXT`,
    `ALTER TABLE GPOTB24_Demande ADD COLUMN AdminTraitement TEXT`,
    `ALTER TABLE GPOTB24_Demande ADD COLUMN PiecesJointes TEXT`,
    // SD_Opportunite
    `ALTER TABLE SD_Opportunite ADD COLUMN statut TEXT DEFAULT 'Active'`,
    `ALTER TABLE SD_Opportunite ADD COLUMN domaine TEXT`,
    `ALTER TABLE SD_Opportunite ADD COLUMN budget REAL`,
    `ALTER TABLE SD_Opportunite ADD COLUMN codeDevise TEXT`,
    // SD_BesoinExprime
    `ALTER TABLE SD_BesoinExprime ADD COLUMN organisation TEXT`,
    `ALTER TABLE SD_BesoinExprime ADD COLUMN numAgr TEXT`,
    `ALTER TABLE SD_BesoinExprime ADD COLUMN budgetEstimatif REAL`,
    `ALTER TABLE SD_BesoinExprime ADD COLUMN codeDevise TEXT`,
    `ALTER TABLE SD_BesoinExprime ADD COLUMN priorite TEXT DEFAULT 'Normale'`,
    // SD_Don
    `ALTER TABLE SD_Don ADD COLUMN codeDevise TEXT`,
    `ALTER TABLE SD_Don ADD COLUMN numAgr TEXT`,
    `ALTER TABLE SD_Don ADD COLUMN reference TEXT`,
    // GPOTB03_Pays — nouvelles colonnes pays complets
    `ALTER TABLE GPOTB03_Pays ADD COLUMN Langue TEXT`,
    `ALTER TABLE GPOTB03_Pays ADD COLUMN CodeDevise TEXT`,
    `ALTER TABLE GPOTB03_Pays ADD COLUMN DrapEau TEXT`,
    `ALTER TABLE GPOTB03_Pays ADD COLUMN DrapeauSvg TEXT`,
    `ALTER TABLE GPOTB03_Pays ADD COLUMN Armoirie TEXT`,
    `ALTER TABLE GPOTB03_Pays ADD COLUMN IdMinistereDefaut INTEGER`,
    // GPOTB_Users
    `ALTER TABLE GPOTB_Users ADD COLUMN NumAgr TEXT`,
    `ALTER TABLE GPOTB_Users ADD COLUMN idAdh INTEGER`,
    `ALTER TABLE GPOTB_Users ADD COLUMN lastLoginAt TEXT`,
    `ALTER TABLE GPOTB_Users ADD COLUMN avatar TEXT`,
    // GPOTB06_Beneficiaire — bénéficiaires enrichis
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN NumBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN NomBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN PrenomBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN DateNaissBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN LienParente TEXT DEFAULT 'Autre'`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN EmailBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN TelBenef TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN Photo TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN idAdh INTEGER`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN NumCNI TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN Nationalite TEXT`,
    `ALTER TABLE GPOTB06_Beneficiaire ADD COLUMN CodePays TEXT`,
    // GPOTB02_Adherent — adhérents enrichis
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN NumAdherent TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN Photo TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN NumCNI TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN Profession TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN Nationalite TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN CodePays TEXT`,
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN MotifRefus TEXT`,
    // GPOTB32_DocumentAdherent — documents propres aux adhérents
    `CREATE TABLE IF NOT EXISTS GPOTB32_DocumentAdherent (
      IdDocAdh      INTEGER PRIMARY KEY AUTOINCREMENT,
      LibDocAdh     TEXT NOT NULL,
      TypeDocAdh    TEXT DEFAULT 'Autre',
      CheminFichier TEXT NOT NULL,
      DateDocument  TEXT,
      idAdh         INTEGER REFERENCES GPOTB02_Adherent(idAdh) ON DELETE CASCADE,
      DateCreation  TEXT DEFAULT (datetime('now'))
    )`,
    // SD_EmailLog — journal des emails envoyés
    `CREATE TABLE IF NOT EXISTS SD_EmailLog (
      idEmail      INTEGER PRIMARY KEY AUTOINCREMENT,
      destinataire TEXT NOT NULL,
      sujet        TEXT NOT NULL,
      corps        TEXT,
      dateEnvoi    TEXT DEFAULT (datetime('now')),
      statut       TEXT DEFAULT 'envoyé',
      erreur       TEXT,
      idAdh        INTEGER REFERENCES GPOTB02_Adherent(idAdh)
    )`,
    // Rôles — enrichissement GPOTB11_Role (DEFAULT simple, pas d'expression)
    `ALTER TABLE GPOTB11_Role ADD COLUMN Description  TEXT`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN Niveau        INTEGER DEFAULT 2`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN Couleur       TEXT    DEFAULT '#6366f1'`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN Icone TEXT`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN idCreateur    INTEGER`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN DateCreation  TEXT`,
    `ALTER TABLE GPOTB11_Role ADD COLUMN isSysteme     INTEGER DEFAULT 0`,
    // Tables associées aux rôles
    `CREATE TABLE IF NOT EXISTS SD_RoleMenu (
       idRoleMenu INTEGER PRIMARY KEY AUTOINCREMENT,
       IdRole     INTEGER NOT NULL REFERENCES GPOTB11_Role(IdRole) ON DELETE CASCADE,
       MenuCode   TEXT    NOT NULL,
       UNIQUE(IdRole, MenuCode)
     )`,
    `CREATE TABLE IF NOT EXISTS SD_RolePermission (
       idPerm    INTEGER PRIMARY KEY AUTOINCREMENT,
       IdRole    INTEGER NOT NULL REFERENCES GPOTB11_Role(IdRole) ON DELETE CASCADE,
       Ressource TEXT    NOT NULL,
       Lire      INTEGER DEFAULT 0,
       Creer     INTEGER DEFAULT 0,
       Modifier  INTEGER DEFAULT 0,
       Supprimer INTEGER DEFAULT 0,
       Valider   INTEGER DEFAULT 0,
       Exporter  INTEGER DEFAULT 0,
       UNIQUE(IdRole, Ressource)
     )`,
    `CREATE TABLE IF NOT EXISTS SD_RoleHabilitation (
       idHab   INTEGER PRIMARY KEY AUTOINCREMENT,
       IdRole  INTEGER NOT NULL REFERENCES GPOTB11_Role(IdRole) ON DELETE CASCADE,
       CodeHab TEXT    NOT NULL,
       Valeur  INTEGER DEFAULT 1,
       UNIQUE(IdRole, CodeHab)
     )`,
    `CREATE TABLE IF NOT EXISTS SD_RoleHistorique (
       idHist     INTEGER PRIMARY KEY AUTOINCREMENT,
       IdRole     INTEGER REFERENCES GPOTB11_Role(IdRole),
       idUser     INTEGER REFERENCES GPOTB_Users(idUser),
       Action     TEXT NOT NULL,
       Detail     TEXT,
       DateAction TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
    // Groupe — créateur
    `ALTER TABLE GPOTB31_GroupeUtilisateur ADD COLUMN idCreateur INTEGER`,
    // SD_Opportunite — enrichissement (pays, domaine)
    `ALTER TABLE SD_Opportunite ADD COLUMN pays TEXT`,
    `ALTER TABLE SD_Opportunite ADD COLUMN domaine TEXT`,
    // SD_BesoinExprime — enrichissement (codePays, domaine)
    `ALTER TABLE SD_BesoinExprime ADD COLUMN codePays TEXT`,
    `ALTER TABLE SD_BesoinExprime ADD COLUMN domaine TEXT`,
    // SD_IARecherche — historique des recherches IA
    `CREATE TABLE IF NOT EXISTS SD_IARecherche (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       pays          TEXT,
       domaine       TEXT,
       besoinsText   TEXT,
       numAgr        TEXT,
       nbMatches     INTEGER DEFAULT 0,
       nbSuggestions INTEGER DEFAULT 0,
       idUser        INTEGER,
       dateRecherche TEXT DEFAULT NULL
     )`,
    // Individu multi-adhésion — référence groupée et email de recherche
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN refDossier TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_demande_ref   ON SD_DemandeAdhesion(refDossier)`,
    `CREATE INDEX IF NOT EXISTS idx_demande_email ON SD_DemandeAdhesion(emailOrg)`,
    // Individu — champs enrichis pour le dossier complet
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN photo             TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN photoCNI          TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN sexe              TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN profession        TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN ville             TEXT`,
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN fonctionSouhaitee TEXT`,
    // Organisation — sexe du déclarant / représentant légal
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN repSexe           TEXT`,
    // GPOTB02_Adherent — sexe de l'adhérent (texte direct : Homme / Femme)
    `ALTER TABLE GPOTB02_Adherent ADD COLUMN Sexe TEXT`,
    // ── Système de statuts d'adhésion (v3) ──────────────────────
    // Nouveau cycle de vie : En attente de validation → Actif / Refusé → Suspendu / Radié / Exclu / Démissionnaire
    `ALTER TABLE SD_DemandeAdhesion ADD COLUMN statutAdhesion TEXT DEFAULT 'En attente de validation'`,
    // Table d'historique des changements de statut
    `CREATE TABLE IF NOT EXISTS SD_HistoriqueStatut (
       id             INTEGER PRIMARY KEY AUTOINCREMENT,
       idDemande      INTEGER NOT NULL REFERENCES SD_DemandeAdhesion(idDemande),
       ancienStatut   TEXT,
       nouveauStatut  TEXT NOT NULL,
       commentaire    TEXT,
       auteur         TEXT,
       dateChangement TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
    `CREATE INDEX IF NOT EXISTS idx_histo_statut_demande ON SD_HistoriqueStatut(idDemande)`,
    // Migration des données existantes vers le nouveau cycle de vie
    `UPDATE SD_DemandeAdhesion SET statutAdhesion = 'Actif'  WHERE statut = 'Acceptée' AND statutAdhesion = 'En attente de validation'`,
    `UPDATE SD_DemandeAdhesion SET statutAdhesion = 'Refusé' WHERE statut = 'Refusée'  AND statutAdhesion = 'En attente de validation'`,
  ];
  migrations.forEach(sql => { try { db.exec(sql); } catch(_) {} });

  // ============================================================
  // MIGRATION Paiement v2 — TypePaiement étendu + nouvelles colonnes
  // ============================================================
  try {
    db.pragma('foreign_keys = OFF');
    const cols = db.prepare(`PRAGMA table_info(GPOTB08_Paiement)`).all().map(c => c.name);
    if (!cols.includes('NumRecu')) {
      db.exec(`ALTER TABLE GPOTB08_Paiement RENAME TO GPOTB08_Paiement_bak`);
      db.exec(`CREATE TABLE GPOTB08_Paiement (
        IdPaiement      INTEGER PRIMARY KEY AUTOINCREMENT,
        DatePaiement    TEXT    NOT NULL,
        MontantPaiement REAL    NOT NULL CHECK(MontantPaiement >= 0),
        Statut          TEXT    DEFAULT 'En attente'
                                CHECK(Statut IN ('En attente','Payé','Impayé','Validé','Rejeté','Remboursé')),
        TypePaiement    TEXT    DEFAULT 'Cotisation'
                                CHECK(TypePaiement IN ('Cotisation','Don','Prestation','Adhésion','Abonnement','Autres')),
        idAdh           INTEGER REFERENCES GPOTB02_Adherent(idAdh),
        IdMoyPay        INTEGER REFERENCES GPOTB13_MoyenPaiement(IdMoyPay),
        NumAgr          TEXT    REFERENCES GPOTB01_Organisation(NumAgr),
        CodeDevise      TEXT    REFERENCES GPOTB27_Devise(CodeDevise),
        CodePays        TEXT,
        Reference       TEXT,
        NumRecu         TEXT,
        NotePaiement    TEXT,
        DateEcheance    TEXT,
        ObjetPaiement   TEXT,
        EmailEnvoye     INTEGER DEFAULT 0
      )`);
      db.exec(`INSERT INTO GPOTB08_Paiement
        (IdPaiement,DatePaiement,MontantPaiement,Statut,TypePaiement,
         idAdh,IdMoyPay,NumAgr,CodeDevise,Reference,NotePaiement)
        SELECT IdPaiement,DatePaiement,MontantPaiement,
          CASE WHEN Statut IN ('En attente','Payé','Impayé','Validé','Rejeté','Remboursé')
               THEN Statut ELSE 'En attente' END,
          CASE WHEN TypePaiement IN ('Cotisation','Don','Prestation','Adhésion','Abonnement','Autres')
               THEN TypePaiement ELSE 'Cotisation' END,
          idAdh,IdMoyPay,NumAgr,CodeDevise,Reference,NotePaiement
        FROM GPOTB08_Paiement_bak`);
      db.exec(`DROP TABLE GPOTB08_Paiement_bak`);
    } else {
      ['DateEcheance TEXT DEFAULT NULL','ObjetPaiement TEXT DEFAULT NULL',
       'CodePays TEXT DEFAULT NULL','NumRecu TEXT DEFAULT NULL',
       'EmailEnvoye INTEGER DEFAULT 0'].forEach(def => {
        try { db.exec(`ALTER TABLE GPOTB08_Paiement ADD COLUMN ${def}`); } catch(_) {}
      });
    }
    db.pragma('foreign_keys = ON');
  } catch(e) {
    try { db.pragma('foreign_keys = ON'); } catch(_) {}
    console.error('[Schema] Migration Paiement v2:', e.message);
  }

  // ============================================================
  // MIGRATION SD_LogActivite v2 — audit enrichi (IP, navigateur, module, userId)
  // ============================================================
  try {
    const logCols = db.prepare(`PRAGMA table_info(SD_LogActivite)`).all().map(c => c.name);
    [
      'ipAdresse      TEXT    DEFAULT NULL',
      'navigateur     TEXT    DEFAULT NULL',
      'module         TEXT    DEFAULT NULL',
      'userId         INTEGER DEFAULT NULL',
      'nomUtilisateur TEXT    DEFAULT NULL',
    ].forEach(def => {
      const col = def.split(/\s+/)[0];
      if (!logCols.includes(col)) {
        try { db.exec(`ALTER TABLE SD_LogActivite ADD COLUMN ${def}`); } catch(_) {}
      }
    });
    // Index sur les nouvelles colonnes
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_log_action ON SD_LogActivite(action)`); } catch(_) {}
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_log_module ON SD_LogActivite(module)`); } catch(_) {}
    try { db.exec(`CREATE INDEX IF NOT EXISTS idx_log_userId ON SD_LogActivite(userId)`); } catch(_) {}
  } catch(e) {
    console.error('[Schema] Migration LogActivite v2:', e.message);
  }

  // ============================================================
  // MIGRATION types d'organisation (Coopérative → Mutuelle)
  // ============================================================
  try {
    db.pragma('foreign_keys = OFF');
    db.exec(`UPDATE GPOTB01_Organisation SET IdTypOrg = NULL WHERE IdTypOrg IN (
      SELECT IdTypOrg FROM GPOTB07_TypeOrganisation WHERE LibTypOrg IN ('Coopérative','Fondation','Groupement')
    )`);
    db.exec(`DELETE FROM GPOTB07_TypeOrganisation WHERE LibTypOrg IN ('Coopérative','Fondation','Groupement')`);
    const hasM = db.prepare(`SELECT COUNT(*) as c FROM GPOTB07_TypeOrganisation WHERE LibTypOrg='Mutuelle'`).get();
    if (hasM.c === 0) db.exec(`INSERT INTO GPOTB07_TypeOrganisation(LibTypOrg) VALUES('Mutuelle')`);
    db.pragma('foreign_keys = ON');
  } catch(_) { db.pragma('foreign_keys = ON'); }

  // Index sur colonnes ajoutées par les migrations (exécuté après ALTER TABLE)
  const idxPost = [
    `CREATE INDEX IF NOT EXISTS idx_opportunite_statut ON SD_Opportunite(statut)`,
    `CREATE INDEX IF NOT EXISTS idx_opportunite_limite ON SD_Opportunite(dateLimite)`,
    `CREATE INDEX IF NOT EXISTS idx_evenement_statut   ON GPOTB21_Evenement(Statut)`,
    `CREATE INDEX IF NOT EXISTS idx_users_numAgr       ON GPOTB_Users(NumAgr)`,
    `CREATE INDEX IF NOT EXISTS idx_besoin_numAgr      ON SD_BesoinExprime(numAgr)`,
    `CREATE INDEX IF NOT EXISTS idx_besoin_priorite    ON SD_BesoinExprime(priorite)`,
    `CREATE INDEX IF NOT EXISTS idx_don_numAgr         ON SD_Don(numAgr)`,
    `CREATE INDEX IF NOT EXISTS idx_benef_idAdh         ON GPOTB06_Beneficiaire(idAdh)`,
    `CREATE INDEX IF NOT EXISTS idx_benef_numBenef      ON GPOTB06_Beneficiaire(NumBenef)`,
    `CREATE INDEX IF NOT EXISTS idx_adh_numAdherent    ON GPOTB02_Adherent(NumAdherent)`,
    `CREATE INDEX IF NOT EXISTS idx_adh_numAgr_statut  ON GPOTB02_Adherent(NumAgr, IdStatut)`,
    `CREATE INDEX IF NOT EXISTS idx_docadh_idAdh        ON GPOTB32_DocumentAdherent(idAdh)`,
    `CREATE INDEX IF NOT EXISTS idx_emaillog_idAdh      ON SD_EmailLog(idAdh)`,
    `CREATE INDEX IF NOT EXISTS idx_rolemenu_role        ON SD_RoleMenu(IdRole)`,
    `CREATE INDEX IF NOT EXISTS idx_roleperm_role        ON SD_RolePermission(IdRole)`,
    `CREATE INDEX IF NOT EXISTS idx_rolehab_role         ON SD_RoleHabilitation(IdRole)`,
    `CREATE INDEX IF NOT EXISTS idx_rolehist_role        ON SD_RoleHistorique(IdRole)`,
    `CREATE INDEX IF NOT EXISTS idx_rolehist_date        ON SD_RoleHistorique(DateAction)`,
    `CREATE INDEX IF NOT EXISTS idx_groupe_createur      ON GPOTB31_GroupeUtilisateur(idCreateur)`,
    `CREATE INDEX IF NOT EXISTS idx_paiement_idDemande   ON GPOTB08_Paiement(idDemande)`,
    `CREATE INDEX IF NOT EXISTS idx_prestmoral_statut    ON GPOTB05_PrestataireMoral(IdStatut)`,
    `CREATE INDEX IF NOT EXISTS idx_prestphys_statut     ON GPOTB18_PrestatairePhysique(IdStatut)`,
    `CREATE INDEX IF NOT EXISTS idx_paiement_code        ON GPOTB08_Paiement(CodeConfirmation)`,
  ];
  idxPost.forEach(sql => { try { db.exec(sql); } catch(_) {} });

  // Prestataires existants sans statut : positionner "En attente" (IdStatut 4) par défaut
  try { db.exec(`UPDATE GPOTB05_PrestataireMoral SET IdStatut = 4 WHERE IdStatut IS NULL`); } catch(_) {}
  try { db.exec(`UPDATE GPOTB18_PrestatairePhysique SET IdStatut = 4 WHERE IdStatut IS NULL`); } catch(_) {}

  // ============================================================
  // SEED — 7 rôles système (idempotent)
  // ============================================================
  try {
    const ROLES_SYSTEME = [
      { lib: 'Admin plateforme',  niveau: 1, couleur: '#dc2626', icone: '👑', desc: 'Accès complet à toute la plateforme.' },
      { lib: 'Admin organisation',niveau: 2, couleur: '#7c3aed', icone: '🏛️', desc: 'Gestion complète de son organisation.' },
      { lib: 'Président',          niveau: 2, couleur: '#1d4ed8', icone: '🎖️', desc: 'Dirige l\'organisation, représentation officielle.' },
      { lib: 'Vice-président',     niveau: 2, couleur: '#0369a1', icone: '🏅', desc: 'Seconde le président, coordination générale.' },
      { lib: 'Secrétaire',         niveau: 2, couleur: '#0f766e', icone: '📝', desc: 'Gestion administrative, procès-verbaux, adhérents.' },
      { lib: 'Trésorier',          niveau: 2, couleur: '#b45309', icone: '💰', desc: 'Gestion financière, paiements, cotisations.' },
      { lib: 'Membre',             niveau: 2, couleur: '#374151', icone: '👤', desc: 'Accès en lecture à ses propres données.' },
    ];

    const MENUS_TOUS = ['dashboard','organisations','adherents','beneficiaires','paiements',
                        'prestations','evenements','demandes','besoins-admin','opportunites',
                        'utilisateurs','habilitation','piste-audit','sauvegarde'];

    const RESSOURCES_TOUS = ['organisation','adherent','beneficiaire','paiement','cotisation',
                              'prestation','evenement','demande','besoin','opportunite',
                              'utilisateur','role','groupe','document'];

    const ALL_PERM = { Lire:1, Creer:1, Modifier:1, Supprimer:1, Valider:1, Exporter:1 };
    const READ     = { Lire:1, Creer:0, Modifier:0, Supprimer:0, Valider:0, Exporter:0 };
    const READ_EXP = { Lire:1, Creer:0, Modifier:0, Supprimer:0, Valider:0, Exporter:1 };
    const RCM      = { Lire:1, Creer:1, Modifier:1, Supprimer:0, Valider:0, Exporter:0 };
    const RCM_V    = { Lire:1, Creer:1, Modifier:1, Supprimer:0, Valider:1, Exporter:0 };
    const NONE     = { Lire:0, Creer:0, Modifier:0, Supprimer:0, Valider:0, Exporter:0 };

    const ROLE_CFG = {
      'Admin plateforme': {
        menus: MENUS_TOUS,
        perms: Object.fromEntries(RESSOURCES_TOUS.map(r => [r, ALL_PERM])),
        habs:  ['voir_toutes_orgs','voir_tous_adherents','changer_statut_adh','valider_paiements',
                 'gerer_budget','signer_documents','representer_org','inviter_membres','exclure_membres',
                 'modifier_statuts','acceder_audit','exporter_donnees','gerer_utilisateurs','sauvegarder'],
      },
      'Admin organisation': {
        menus: ['dashboard','organisations','adherents','beneficiaires','paiements','prestations',
                'evenements','demandes','besoins-admin','opportunites','utilisateurs','habilitation'],
        perms: {
          organisation:ALL_PERM, adherent:ALL_PERM, beneficiaire:ALL_PERM, paiement:ALL_PERM,
          cotisation:ALL_PERM, prestation:ALL_PERM, evenement:ALL_PERM, demande:ALL_PERM,
          besoin:ALL_PERM, opportunite:ALL_PERM, utilisateur:RCM, role:READ, groupe:ALL_PERM, document:ALL_PERM,
        },
        habs: ['voir_tous_adherents','changer_statut_adh','valider_paiements','gerer_budget',
                'inviter_membres','exclure_membres','gerer_utilisateurs','exporter_donnees'],
      },
      'Président': {
        menus: ['dashboard','organisations','adherents','beneficiaires','paiements','prestations',
                'evenements','demandes','utilisateurs','habilitation','piste-audit'],
        perms: {
          organisation:RCM_V, adherent:ALL_PERM, beneficiaire:RCM, paiement:RCM_V,
          cotisation:RCM_V, prestation:RCM_V, evenement:ALL_PERM, demande:RCM_V,
          besoin:READ, opportunite:READ, utilisateur:READ, role:READ, groupe:RCM, document:RCM_V,
        },
        habs: ['voir_tous_adherents','changer_statut_adh','representer_org','signer_documents',
                'inviter_membres','exclure_membres','modifier_statuts','acceder_audit'],
      },
      'Vice-président': {
        menus: ['dashboard','organisations','adherents','beneficiaires','paiements',
                'prestations','evenements','demandes','utilisateurs'],
        perms: {
          organisation:RCM, adherent:RCM, beneficiaire:RCM, paiement:READ,
          cotisation:READ, prestation:RCM, evenement:RCM, demande:RCM,
          besoin:READ, opportunite:READ, utilisateur:READ, role:READ, groupe:RCM, document:RCM,
        },
        habs: ['voir_tous_adherents','changer_statut_adh','representer_org','inviter_membres'],
      },
      'Secrétaire': {
        menus: ['dashboard','adherents','beneficiaires','evenements','demandes','piste-audit'],
        perms: {
          organisation:READ, adherent:RCM, beneficiaire:RCM, paiement:READ,
          cotisation:READ, prestation:READ, evenement:RCM, demande:RCM,
          besoin:READ, opportunite:READ, utilisateur:NONE, role:NONE, groupe:READ, document:RCM,
        },
        habs: ['voir_tous_adherents','inviter_membres','signer_documents','acceder_audit'],
      },
      'Trésorier': {
        menus: ['dashboard','paiements','prestations'],
        perms: {
          organisation:READ, adherent:READ, beneficiaire:READ, paiement:ALL_PERM,
          cotisation:ALL_PERM, prestation:RCM_V, evenement:READ, demande:READ,
          besoin:NONE, opportunite:NONE, utilisateur:NONE, role:NONE, groupe:READ, document:RCM_V,
        },
        habs: ['valider_paiements','gerer_budget','exporter_donnees'],
      },
      'Membre': {
        menus: ['dashboard','evenements','opportunites'],
        perms: Object.fromEntries(RESSOURCES_TOUS.map(r => [r, READ])),
        habs:  [],
      },
    };

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const insRole   = db.prepare(`INSERT OR IGNORE INTO GPOTB11_Role(LibRole,Description,Niveau,Couleur,Icone,isSysteme,DateCreation) VALUES(?,?,?,?,?,1,?)`);
    const insMenu   = db.prepare(`INSERT OR IGNORE INTO SD_RoleMenu(IdRole,MenuCode) VALUES(?,?)`);
    const insPerm   = db.prepare(`INSERT OR IGNORE INTO SD_RolePermission(IdRole,Ressource,Lire,Creer,Modifier,Supprimer,Valider,Exporter) VALUES(?,?,?,?,?,?,?,?)`);
    const insHab    = db.prepare(`INSERT OR IGNORE INTO SD_RoleHabilitation(IdRole,CodeHab,Valeur) VALUES(?,?,1)`);

    for (const r of ROLES_SYSTEME) {
      insRole.run(r.lib, r.desc, r.niveau, r.couleur, r.icone, now);
      const row = db.prepare(`SELECT IdRole FROM GPOTB11_Role WHERE LibRole=?`).get(r.lib);
      if (!row) continue;
      const id = row.IdRole;
      const cfg = ROLE_CFG[r.lib];
      if (!cfg) continue;
      for (const m of cfg.menus) insMenu.run(id, m);
      for (const [res, p] of Object.entries(cfg.perms)) {
        insPerm.run(id, res, p.Lire, p.Creer, p.Modifier, p.Supprimer, p.Valider, p.Exporter);
      }
      for (const h of cfg.habs) insHab.run(id, h);
    }
  } catch(e) { console.warn('Seed rôles:', e.message); }

  // ============================================================
  // DONNÉES INITIALES
  // ============================================================

  // Mise à jour des données pays (Langue, Devise, Drapeau, Armoirie, Ministère défaut)
  // Récupération des IDs ministères par pays (insérés via seed plus haut)
  const updatePays = () => {
    const paysData = [
      { code: 'CIV', langue: 'Français',          devise: 'XOF', drapeau: '🇨🇮',
        svg: '/images/drapeaux/civ.svg', armoirie: '/images/armoiries/civ.svg',
        minLib: "Ministère de l'Intérieur et de la Sécurité" },
      { code: 'MLI', langue: 'Français',          devise: 'XOF', drapeau: '🇲🇱',
        svg: '/images/drapeaux/mli.svg', armoirie: '/images/armoiries/mli.svg',
        minLib: "Ministère de l'Administration Territoriale et de la Décentralisation" },
      { code: 'BEN', langue: 'Français',          devise: 'XOF', drapeau: '🇧🇯',
        svg: '/images/drapeaux/ben.svg', armoirie: '/images/armoiries/ben.svg',
        minLib: "Ministère de l'Intérieur et de la Sécurité Publique" },
      { code: 'BFA', langue: 'Français',          devise: 'XOF', drapeau: '🇧🇫',
        svg: '/images/drapeaux/bfa.svg', armoirie: '/images/armoiries/bfa.svg',
        minLib: "Ministère de l'Administration Territoriale et de la Décentralisation" },
      { code: 'NGA', langue: 'Anglais',           devise: 'NGN', drapeau: '🇳🇬',
        svg: '/images/drapeaux/nga.svg', armoirie: '/images/armoiries/nga.svg',
        minLib: "Ministère Fédéral du Budget et de la Planification Nationale" },
      { code: 'MDG', langue: 'Français, Malgache', devise: 'MGA', drapeau: '🇲🇬',
        svg: '/images/drapeaux/mdg.svg', armoirie: '/images/armoiries/mdg.svg',
        minLib: "Ministère de l'Intérieur et de la Décentralisation" },
    ];
    const stmtMin = db.prepare(
      `SELECT IdMinistere FROM GPOTB28_Ministere WHERE CodePays=? AND LibMinistere=?`
    );
    const stmtUpd = db.prepare(
      `UPDATE GPOTB03_Pays SET Langue=?, CodeDevise=?, DrapEau=?, DrapeauSvg=?, Armoirie=?, IdMinistereDefaut=?
       WHERE CodePays=?`
    );
    for (const p of paysData) {
      const min = stmtMin.get(p.code, p.minLib);
      stmtUpd.run(p.langue, p.devise, p.drapeau, p.svg, p.armoirie,
                  min ? min.IdMinistere : null, p.code);
    }
    console.log('✅ Données pays complètes mises à jour');
  };
  try { updatePays(); } catch(_) {}

  // Pays (déjà géré)
  const hasPays = db.prepare('SELECT COUNT(*) as c FROM GPOTB03_Pays').get();
  if (hasPays.c === 0) {
    db.exec(`
      INSERT INTO GPOTB03_Pays VALUES('MDG','Madagascar',-18.766947,46.869107,'+261');
      INSERT INTO GPOTB03_Pays VALUES('MLI','Mali',17.570692,-3.996166,'+223');
      INSERT INTO GPOTB03_Pays VALUES('CIV','Côte d''Ivoire',7.539989,-5.547080,'+225');
      INSERT INTO GPOTB03_Pays VALUES('BFA','Burkina Faso',12.364566,-1.535150,'+226');
      INSERT INTO GPOTB03_Pays VALUES('BEN','Bénin',9.307690,2.315834,'+229');
      INSERT INTO GPOTB03_Pays VALUES('NGA','Nigeria',9.081999,8.675277,'+234');

      INSERT INTO GPOTB07_TypeOrganisation(LibTypOrg) VALUES('Association'),('ONG'),('Mutuelle');
      INSERT INTO GPOTB09_VocationOrganisation(LibVocOrg) VALUES('Entraide'),('Développement'),('Santé'),('Éducation'),('Agriculture'),('Microfinance');
      INSERT INTO GPOTB10_ReglementInterieur(NomRegleInt) VALUES('Règlement standard'),('Statuts loi 1901'),('Règlement coopérative');
      INSERT INTO GPOTB11_Role(LibRole) VALUES('Président'),('Vice-Président'),('Secrétaire Général'),('Trésorier'),('Membre actif'),('Membre fondateur');
      INSERT INTO GPOTB12_Sexe(LibSexe) VALUES('Masculin'),('Féminin'),('Autre');
      INSERT INTO GPOTB13_MoyenPaiement(LibMoyPay) VALUES('Espèces'),('Mobile Money'),('Virement bancaire'),('Orange Money'),('Wave'),('MTN Mobile Money');
      INSERT INTO GPOTB15_Statut(LibStatut) VALUES('Actif'),('Inactif'),('Suspendu'),('En attente'),('Clôturé');
      INSERT INTO GPOTB17_TypePrestation(LibTypPrest) VALUES('Médicale'),('Juridique'),('Financière'),('Formation'),('Alimentaire'),('Scolaire');
      INSERT INTO GPOTB19_PieceIdentite(LibPieceIdenti) VALUES('Carte Nationale d''Identité'),('Passeport'),('Permis de conduire'),('Acte de naissance');
      INSERT INTO GPOTB20_SituationMatrimoniale(LibSituMat) VALUES('Célibataire'),('Marié(e)'),('Divorcé(e)'),('Veuf/Veuve'),('Union libre');
      INSERT INTO GPOTB22_Filiation(LibFil) VALUES('Biologique'),('Adoptive'),('Légale');
      INSERT INTO GPOTB23_TypeFiliation(LibTypFil) VALUES('Père'),('Mère'),('Enfant'),('Tuteur légal'),('Frère/Sœur');
    `);
    console.log('✅ Données de référence initialisées');
  }

  // Devises
  const hasDevise = db.prepare('SELECT COUNT(*) as c FROM GPOTB27_Devise').get();
  if (hasDevise.c === 0) {
    db.exec(`
      INSERT INTO GPOTB27_Devise VALUES('XOF','Franc CFA BCEAO','F CFA',655.957,1);
      INSERT INTO GPOTB27_Devise VALUES('XAF','Franc CFA BEAC','F CFA',655.957,1);
      INSERT INTO GPOTB27_Devise VALUES('MGA','Ariary malgache','Ar',4800.0,1);
      INSERT INTO GPOTB27_Devise VALUES('NGN','Naira nigérian','₦',1650.0,1);
      INSERT INTO GPOTB27_Devise VALUES('EUR','Euro','€',1.0,1);
      INSERT INTO GPOTB27_Devise VALUES('USD','Dollar américain','$',0.92,1);
    `);
    console.log('✅ Devises initialisées');
  }

  // Ministères de tutelle
  const hasMinistere = db.prepare('SELECT COUNT(*) as c FROM GPOTB28_Ministere').get();
  if (hasMinistere.c === 0) {
    db.exec(`
      INSERT INTO GPOTB28_Ministere(LibMinistere,CodePays,Domaine) VALUES
        ('Ministère de l''Intérieur et de la Sécurité','CIV','Intérieur'),
        ('Ministère de la Solidarité et des Affaires Sociales','CIV','Social'),
        ('Ministère de l''Administration Territoriale et de la Décentralisation','MLI','Intérieur'),
        ('Ministère de la Solidarité et de l''Action Humanitaire','MLI','Social'),
        ('Ministère de l''Administration Territoriale et de la Décentralisation','BFA','Intérieur'),
        ('Ministère de l''Action Sociale et de la Solidarité Nationale','BFA','Social'),
        ('Ministère de l''Intérieur et de la Sécurité Publique','BEN','Intérieur'),
        ('Ministère des Affaires Sociales et de la Microfinance','BEN','Social'),
        ('Ministère Fédéral du Budget et de la Planification Nationale','NGA','Budget'),
        ('Ministère Fédéral des Affaires Humanitaires','NGA','Social'),
        ('Ministère de l''Intérieur et de la Décentralisation','MDG','Intérieur'),
        ('Ministère de la Population et des Affaires Sociales','MDG','Social');
    `);
    console.log('✅ Ministères initialisés');
  }
};
