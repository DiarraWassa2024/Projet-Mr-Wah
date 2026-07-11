/* ====================================================
   dateFilter — filtre de dates global (sessionStorage)
   ==================================================== */
const dateFilter = (() => {
  const SK = 'sd_dateFilter';

  /* ── state ──────────────────────────────────────── */
  function getState() {
    try { return JSON.parse(sessionStorage.getItem(SK)) || { preset:'all', dateFrom:'', dateTo:'' }; }
    catch { return { preset:'all', dateFrom:'', dateTo:'' }; }
  }
  function setState(s) { sessionStorage.setItem(SK, JSON.stringify(s)); }

  /* ── local date string (YYYY-MM-DD) without UTC shift ── */
  function localDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /* ── preset → dates ─────────────────────────────── */
  function datesForPreset(preset) {
    const now = new Date();
    const today = localDate(now);
    switch (preset) {
      case 'today': return { dateFrom: today, dateTo: today };
      case 'yesterday': {
        const d = new Date(now); d.setDate(d.getDate() - 1);
        const s = localDate(d);
        return { dateFrom: s, dateTo: s };
      }
      case 'week': {
        const d = new Date(now);
        const day = d.getDay() || 7;
        d.setDate(d.getDate() - day + 1);
        return { dateFrom: localDate(d), dateTo: today };
      }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return { dateFrom: localDate(d), dateTo: today };
      }
      case '30d': {
        const d = new Date(now); d.setDate(d.getDate() - 30);
        return { dateFrom: localDate(d), dateTo: today };
      }
      case 'year': {
        const d = new Date(now.getFullYear(), 0, 1);
        return { dateFrom: localDate(d), dateTo: today };
      }
      default: return { dateFrom: '', dateTo: '' };
    }
  }

  /* ── label for active filter ─────────────────────── */
  function getLabel(s) {
    const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) : '';
    if (!s.dateFrom && !s.dateTo) return '';
    if (s.dateFrom === s.dateTo) return `Le ${fmtDate(s.dateFrom)}`;
    if (s.dateFrom && s.dateTo) return `Du ${fmtDate(s.dateFrom)} au ${fmtDate(s.dateTo)}`;
    if (s.dateFrom) return `À partir du ${fmtDate(s.dateFrom)}`;
    return `Jusqu'au ${fmtDate(s.dateTo)}`;
  }

  /* ── public: query string fragment ──────────────── */
  function getQS() {
    const s = getState();
    const parts = [];
    if (s.dateFrom) parts.push(`dateFrom=${s.dateFrom}`);
    if (s.dateTo)   parts.push(`dateTo=${s.dateTo}`);
    return parts.length ? '&' + parts.join('&') : '';
  }

  /* ── build URL for API calls ─────────────────────── */
  function buildUrl(base, extraParams = {}) {
    const s = getState();
    const p = new URLSearchParams();
    Object.entries(extraParams).forEach(([k,v]) => { if (v) p.set(k,v); });
    if (s.dateFrom) p.set('dateFrom', s.dateFrom);
    if (s.dateTo)   p.set('dateTo', s.dateTo);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  }

  /* ── presets config ──────────────────────────────── */
  const PRESETS = [
    { key:'all',       label:'Tout' },
    { key:'today',     label:"Aujourd'hui" },
    { key:'yesterday', label:'Hier' },
    { key:'week',      label:'Cette semaine' },
    { key:'month',     label:'Ce mois' },
    { key:'30d',       label:'30 derniers jours' },
    { key:'year',      label:'Cette année' },
    { key:'custom',    label:'Personnalisé' },
  ];

  /* ── render bar HTML ─────────────────────────────── */
  function renderBar() {
    const s = getState();
    const label = getLabel(s);
    const isActive = s.preset !== 'all';

    return `<div class="df-bar" id="dfBar">
      <div class="df-presets">
        ${PRESETS.map(p=>`
          <button class="df-preset ${s.preset===p.key?'active':''}" data-preset="${p.key}">${p.label}</button>
        `).join('')}
      </div>
      <div class="df-custom ${s.preset==='custom'?'':'df-hidden'}" id="dfCustom">
        <input type="date" id="dfFrom" value="${s.dateFrom}" placeholder="Date début">
        <span class="df-arrow">→</span>
        <input type="date" id="dfTo" value="${s.dateTo}" placeholder="Date fin">
        <button class="df-apply" id="dfApply">Appliquer</button>
      </div>
      ${isActive ? `<div class="df-active">
        <span class="df-active-icon">📅</span>
        <span class="df-active-label">${label}</span>
        <button class="df-reset" id="dfReset">✕ Réinitialiser</button>
      </div>` : ''}
    </div>`;
  }

  /* ── init bar events (call after render) ─────────── */
  function initBar(onRefresh) {
    const bar = document.getElementById('dfBar');
    if (!bar) return;

    // Preset buttons
    bar.querySelectorAll('.df-preset').forEach(btn => {
      btn.onclick = () => {
        const preset = btn.dataset.preset;
        const dates  = datesForPreset(preset);
        setState({ preset, ...dates });

        if (preset === 'custom') {
          // Show custom inputs, don't refresh yet
          document.getElementById('dfCustom')?.classList.remove('df-hidden');
          return;
        }
        onRefresh();
      };
    });

    // Custom apply button
    document.getElementById('dfApply')?.addEventListener('click', () => {
      const from = document.getElementById('dfFrom')?.value || '';
      const to   = document.getElementById('dfTo')?.value || '';
      setState({ preset:'custom', dateFrom: from, dateTo: to });
      onRefresh();
    });

    // Reset button
    document.getElementById('dfReset')?.addEventListener('click', () => {
      setState({ preset:'all', dateFrom:'', dateTo:'' });
      onRefresh();
    });
  }

  /* ── public API ──────────────────────────────────── */
  return { getState, getQS, buildUrl, renderBar, initBar, getLabel };
})();
