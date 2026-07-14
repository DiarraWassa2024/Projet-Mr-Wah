router.register('db-admin', async () => {
  const app = document.getElementById('app');
  let tables = [];
  let activeTable = null;
  let page = 1;
  const limit = 50;

  async function init() {
    app.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    try {
      tables = await api.get('/db-admin/tables');
      render();
    } catch (err) {
      app.innerHTML = `<div class="msg error">${err.message}</div>`;
    }
  }

  function render() {
    app.innerHTML = `
      <div class="dash-welcome">
        <div>
          <div class="dw-greet">🗄️ <strong>Base de données</strong></div>
          <div class="dw-date">Consultation des tables — lecture seule</div>
        </div>
      </div>

      <div style="display:flex;gap:20px;align-items:flex-start;margin-top:20px">
        <div class="dash-panel" style="width:260px;flex-shrink:0;padding:12px;max-height:70vh;overflow-y:auto">
          <div style="font-weight:700;font-size:13px;color:#64748b;padding:4px 8px 10px">TABLES (${tables.length})</div>
          ${tables.map(t => `
            <button class="dba-table-btn ${activeTable===t.code?'active':''}" data-name="${t.code}">
              <span>${t.code}</span>
              <span class="dba-count">${t.count ?? '—'}</span>
            </button>`).join('')}
          <div style="border-top:1px solid #e2e8f0;margin:10px 0"></div>
          <button class="dba-table-btn ${activeTable==='__console__'?'active':''}" data-name="__console__">
            <span>🔎 Console SQL (SELECT)</span>
          </button>
        </div>
        <div class="dash-panel dash-full" id="dbaContent" style="flex:1;min-width:0;padding:20px">
          <p class="dt-empty">Sélectionnez une table à gauche</p>
        </div>
      </div>`;

    document.querySelectorAll('.dba-table-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTable = btn.dataset.name;
        page = 1;
        if (activeTable === '__console__') renderConsole();
        else loadTable();
        document.querySelectorAll('.dba-table-btn').forEach(b => b.classList.toggle('active', b.dataset.name === activeTable));
      });
    });
  }

  async function loadTable() {
    const content = document.getElementById('dbaContent');
    content.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
    try {
      const data = await api.get(`/db-admin/tables/${encodeURIComponent(activeTable)}?page=${page}&limit=${limit}`);
      renderTableData(data);
    } catch (err) {
      content.innerHTML = `<div class="msg error">${err.message}</div>`;
    }
  }

  function renderTableData(data) {
    const content = document.getElementById('dbaContent');
    content.innerHTML = `
      <div class="dp-head" style="margin-bottom:12px">
        <div><div class="dp-title">${esc(data.realName)}</div><div class="dp-sub">${activeTable} — ${data.total} ligne(s) — page ${data.page}/${data.totalPages}</div></div>
        <div style="display:flex;gap:8px">
          <button class="dp-btn" id="dbaPrev" ${data.page<=1?'disabled':''}>← Précédent</button>
          <button class="dp-btn" id="dbaNext" ${data.page>=data.totalPages?'disabled':''}>Suivant →</button>
        </div>
      </div>
      <div class="dt-wrap" style="overflow-x:auto">
        <table class="dt-table">
          <thead><tr>${data.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${data.rows.length ? data.rows.map(r => `
              <tr>${data.columns.map(c => `<td>${fmtCell(r[c])}</td>`).join('')}</tr>
            `).join('') : `<tr><td colspan="${data.columns.length}" class="dt-empty">Aucune ligne</td></tr>`}
          </tbody>
        </table>
      </div>`;

    document.getElementById('dbaPrev')?.addEventListener('click', () => { if (page>1) { page--; loadTable(); } });
    document.getElementById('dbaNext')?.addEventListener('click', () => { if (page<data.totalPages) { page++; loadTable(); } });
  }

  function renderConsole() {
    const content = document.getElementById('dbaContent');
    content.innerHTML = `
      <div class="dp-title" style="margin-bottom:6px">🔎 Console SQL — lecture seule</div>
      <div class="dp-sub" style="margin-bottom:12px">Seules les requêtes SELECT sont autorisées ici (pas de modification possible).</div>
      <textarea id="dbaSqlInput" rows="4" style="width:100%;font-family:monospace;font-size:13px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px" placeholder="SELECT * FROM GPOTB01_Organisation LIMIT 20"></textarea>
      <div style="margin-top:10px">
        <button class="btn btn-primary" id="dbaRunQuery">▶️ Exécuter</button>
      </div>
      <div id="dbaResult" style="margin-top:16px"></div>`;

    document.getElementById('dbaRunQuery').addEventListener('click', async () => {
      const sql = document.getElementById('dbaSqlInput').value.trim();
      const resultEl = document.getElementById('dbaResult');
      if (!sql) return;
      resultEl.innerHTML = `<div class="dash-loading"><div class="dash-spinner"></div></div>`;
      try {
        const data = await api.post('/db-admin/query', { sql });
        if (!data.rows.length) {
          resultEl.innerHTML = `<p class="dt-empty">Aucun résultat</p>`;
          return;
        }
        const cols = Object.keys(data.rows[0]);
        resultEl.innerHTML = `
          <div class="dp-sub" style="margin-bottom:8px">${data.rowCount} résultat(s)</div>
          <div class="dt-wrap" style="overflow-x:auto">
            <table class="dt-table">
              <thead><tr>${cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
              <tbody>${data.rows.map(r => `<tr>${cols.map(c => `<td>${fmtCell(r[c])}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>`;
      } catch (err) {
        resultEl.innerHTML = `<div class="msg error">${err.message}</div>`;
      }
    });
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function fmtCell(v) {
    if (v === null || v === undefined) return '<span style="color:#cbd5e1">NULL</span>';
    const s = String(v);
    return esc(s.length > 80 ? s.slice(0, 80) + '…' : s);
  }

  init();
});
