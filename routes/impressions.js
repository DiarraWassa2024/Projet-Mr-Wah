/**
 * Route /api/impressions
 * Données + QR codes + exports Excel pour le module d'impression
 */
const router = require('express').Router();
const QRCode = require('qrcode');
const auth   = require('../middleware/auth');
const AdherentRepository     = require('../repositories/AdherentRepository');
const BeneficiaireRepository = require('../repositories/BeneficiaireRepository');
const { ok, serverError }    = require('../helpers/response');

const adhRepo = AdherentRepository;
const benRepo = BeneficiaireRepository;

// ── Helpers ────────────────────────────────────────────────────
async function makeQR(text, size = 200) {
  return QRCode.toDataURL(text, {
    width: size, margin: 1,
    color: { dark: '#1e293b', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

function xmlEscape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function sendExcel(res, sheetName, headers, rows) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
  <Style ss:ID="Header">
    <Font ss:Bold="1" ss:Size="11"/>
    <Interior ss:Color="#1e40af" ss:Pattern="Solid"/>
    <Font ss:Bold="1" ss:Color="#FFFFFF"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="Row1"><Interior ss:Color="#f0f4ff" ss:Pattern="Solid"/></Style>
</Styles>
<Worksheet ss:Name="${xmlEscape(sheetName)}">
<Table>
<Row>
${headers.map(h => `  <Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('\n')}
</Row>
${rows.map((row, i) => `<Row${i % 2 === 0 ? ' ss:StyleID="Row1"' : ''}>${row.map(c => `<Cell><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`).join('')}</Row>`).join('\n')}
</Table>
</Worksheet>
</Workbook>`;

  const filename = encodeURIComponent(`${sheetName}_${new Date().toISOString().slice(0,10)}.xls`);
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=UTF-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
}

// ══════════════════════════════════════════════════════════════
// ADHÉRENTS
// ══════════════════════════════════════════════════════════════
router.get('/adherents', auth, async (req, res) => {
  try {
    const rows = await adhRepo.findAll(req.query);
    ok(res, rows);
  } catch (e) { serverError(res, e); }
});

router.get('/adherents/:id', auth, async (req, res) => {
  try {
    const adh = await adhRepo.findByIdFull(+req.params.id);
    if (!adh) return res.status(404).json({ message: 'Adhérent non trouvé' });
    adh.qrCode = await makeQR(`SOLIDEV:ADH:${adh.NumAdherent}|${adh.NomAdh} ${adh.PrenAdh}`);
    ok(res, adh);
  } catch (e) { serverError(res, e); }
});

// QR codes batch pour tous les adhérents filtrés
router.get('/adherents-qr', auth, async (req, res) => {
  try {
    const rows = await adhRepo.findAll(req.query);
    const withQR = await Promise.all(rows.map(async r => {
      r.qrCode = await makeQR(`SOLIDEV:ADH:${r.NumAdherent}`);
      return r;
    }));
    ok(res, withQR);
  } catch (e) { serverError(res, e); }
});

router.get('/excel/adherents', auth, async (req, res) => {
  try {
    const rows = await adhRepo.findAll(req.query);
    const headers = ['N° Adhérent','Nom','Prénom','Sexe','Email','Téléphone','Fonction','Profession',
                     'Organisation','Rôle','Statut','Date Adhésion','Pays'];
    const data = rows.map(r => [
      r.NumAdherent, r.NomAdh, r.PrenAdh, r.Sexe||'', r.EmailAdh||'', r.TelAdh||'',
      r.FonctionAdh||'', r.Profession||'',
      r.LibOrg||'', r.LibRole||'', r.LibStatut||'',
      r.DateAdhesion ? r.DateAdhesion.slice(0,10) : '', r.CodePays||'',
    ]);
    sendExcel(res, 'Adhérents', headers, data);
  } catch (e) { serverError(res, e); }
});

// ══════════════════════════════════════════════════════════════
// BÉNÉFICIAIRES
// ══════════════════════════════════════════════════════════════
router.get('/beneficiaires', auth, async (req, res) => {
  try {
    const rows = await benRepo.findAll(req.query);
    ok(res, rows);
  } catch (e) { serverError(res, e); }
});

router.get('/beneficiaires/:id', auth, async (req, res) => {
  try {
    const ben = await benRepo.findByIdFull(+req.params.id);
    if (!ben) return res.status(404).json({ message: 'Bénéficiaire non trouvé' });
    ben.qrCode = await makeQR(`SOLIDEV:BEN:${ben.NumBenef}|${ben.NomBenef} ${ben.PrenomBenef}`);
    ok(res, ben);
  } catch (e) { serverError(res, e); }
});

router.get('/beneficiaires-qr', auth, async (req, res) => {
  try {
    const rows = await benRepo.findAll(req.query);
    const withQR = await Promise.all(rows.map(async r => {
      r.qrCode = await makeQR(`SOLIDEV:BEN:${r.NumBenef}`);
      return r;
    }));
    ok(res, withQR);
  } catch (e) { serverError(res, e); }
});

router.get('/excel/beneficiaires', auth, async (req, res) => {
  try {
    const rows = await benRepo.findAll(req.query);
    const headers = ['N° Bénéf.','Nom','Prénom','Date Naiss.','Email','Téléphone',
                     'Lien Parenté','Type','Organisation','Adhérent','Statut','Pays'];
    const data = rows.map(r => [
      r.NumBenef, r.NomBenef, r.PrenomBenef,
      r.DateNaissBenef ? r.DateNaissBenef.slice(0,10) : '',
      r.EmailBenef||'', r.TelBenef||'', r.LienParente||'', r.TypeBenef||'',
      r.LibOrg||'',
      r.NomAdh ? `${r.NomAdh} ${r.PrenAdh}` : '',
      r.LibStatut||'', r.CodePays||'',
    ]);
    sendExcel(res, 'Bénéficiaires', headers, data);
  } catch (e) { serverError(res, e); }
});

// ── QR code unique (image PNG inline) ─────────────────────────
router.get('/qr-png/:type/:id', auth, async (req, res) => {
  try {
    const { type, id } = req.params;
    let text, label;
    if (type === 'adh') {
      const a = await adhRepo.findByIdFull(+id);
      if (!a) return res.status(404).end();
      text  = `SOLIDEV:ADH:${a.NumAdherent}|${a.NomAdh} ${a.PrenAdh}`;
      label = `${a.NumAdherent}`;
    } else {
      const b = await benRepo.findByIdFull(+id);
      if (!b) return res.status(404).end();
      text  = `SOLIDEV:BEN:${b.NumBenef}|${b.NomBenef} ${b.PrenomBenef}`;
      label = `${b.NumBenef}`;
    }
    const buf = await QRCode.toBuffer(text, { width: 300, margin: 2, errorCorrectionLevel: 'H' });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr_${label}.png"`);
    res.send(buf);
  } catch (e) { serverError(res, e); }
});

module.exports = router;
