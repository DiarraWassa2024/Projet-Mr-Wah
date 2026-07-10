router.register('sauvegarde', async () => {
  const app = document.getElementById('app');
  let stats = {};

  async function load() {
    try { stats = await api.get('/sauvegarde/stats'); } catch(_) { stats = {}; }
  }

  async function render() {
    await load();
    const fmt = d => d ? new Date(d).toLocaleString('fr-FR') : '—';

    app.innerHTML = `
      <div class="page-header">
        <h2>Sauvegarde / Restauration</h2>
      </div>

      <!-- Stats BD -->
      <div class="dem-kpi-row" style="grid-template-columns:repeat(3,1fr);max-width:600px;margin-bottom:28px">
        <div class="dem-kpi-card dem-kpi-total">
          <div class="dem-kpi-val">${stats.organisations||0}</div>
          <div class="dem-kpi-lbl">Organisations</div>
        </div>
        <div class="dem-kpi-card dem-kpi-ok">
          <div class="dem-kpi-val">${stats.adherents||0}</div>
          <div class="dem-kpi-lbl">Adhérents</div>
        </div>
        <div class="dem-kpi-card dem-kpi-pend">
          <div class="dem-kpi-val">${stats.paiements||0}</div>
          <div class="dem-kpi-lbl">Paiements</div>
        </div>
      </div>

      <div class="sav-grid">
        <!-- Télécharger -->
        <div class="sav-card">
          <div class="sav-icon">💾</div>
          <h3>Télécharger une sauvegarde</h3>
          <p>Exporte l'intégralité de la base de données SQLite dans un fichier <code>.db</code> horodaté.
             Conservez ce fichier en lieu sûr.</p>
          <div class="sav-info">
            <span>📅 Dernière sauvegarde : <strong>${fmt(stats.lastBackup)}</strong></span>
          </div>
          <button class="btn btn-primary sav-btn" id="btnDownload">⬇️ Télécharger la base de données</button>
        </div>

        <!-- Restaurer -->
        <div class="sav-card">
          <div class="sav-icon">🔄</div>
          <h3>Restaurer une sauvegarde</h3>
          <p>Importez un fichier <code>.db</code> précédemment exporté pour remplacer la base actuelle.</p>
          <div class="sav-warning">
            ⚠️ <strong>Attention :</strong> cette opération remplace toutes les données actuelles.
            Elle est irréversible. Faites une sauvegarde avant de restaurer.
          </div>
          <label class="sav-upload" id="uploadZone">
            <input type="file" id="fileInput" accept=".db,.sqlite" style="display:none">
            <span class="sav-upload-icon">📂</span>
            <span id="fileLabel">Choisir un fichier .db ou .sqlite</span>
          </label>
          <button class="btn sav-btn-restore" id="btnRestore" disabled>🔄 Restaurer</button>
        </div>
      </div>`;

    // Download
    document.getElementById('btnDownload').onclick = async () => {
      const btn = document.getElementById('btnDownload');
      btn.textContent = '⏳ Préparation…';
      btn.disabled = true;
      try {
        const token = localStorage.getItem('gpo_token');
        const res = await fetch('/api/sauvegarde/download', {
          headers: { Authorization: 'Bearer ' + token }
        });
        if (!res.ok) throw new Error(await res.text());
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `solidev_backup_${new Date().toISOString().slice(0,10)}.db`;
        a.click();
        URL.revokeObjectURL(url);
        btn.textContent = '✅ Téléchargement réussi';
        setTimeout(() => { btn.textContent = '⬇️ Télécharger la base de données'; btn.disabled = false; }, 3000);
      } catch(e) {
        alert('Erreur : ' + e.message);
        btn.textContent = '⬇️ Télécharger la base de données';
        btn.disabled = false;
      }
    };

    // File picker
    document.getElementById('uploadZone').onclick = () => document.getElementById('fileInput').click();
    document.getElementById('fileInput').onchange = e => {
      const f = e.target.files[0];
      if (f) {
        document.getElementById('fileLabel').textContent = `${f.name} (${(f.size/1024).toFixed(0)} Ko)`;
        document.getElementById('btnRestore').disabled = false;
      }
    };

    // Restore
    document.getElementById('btnRestore').onclick = async () => {
      const f = document.getElementById('fileInput').files[0];
      if (!f) return;
      if (!confirm('⚠️ Confirmer la restauration ? Toutes les données actuelles seront remplacées !')) return;
      const formData = new FormData();
      formData.append('database', f);
      const btn = document.getElementById('btnRestore');
      btn.textContent = '⏳ Restauration en cours…'; btn.disabled = true;
      try {
        const token = localStorage.getItem('gpo_token');
        const res = await fetch('/api/sauvegarde/restore', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
          body: formData
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.message);
        alert('✅ Restauration réussie ! La page va se recharger.');
        window.location.reload();
      } catch(e) {
        alert('Erreur : ' + e.message);
        btn.textContent = '🔄 Restaurer'; btn.disabled = false;
      }
    };
  }

  render();
});
