router.register('expression-besoins', async () => {
  let pays = [];
  try { pays = await api.get('/ref/pays'); } catch(e) {}

  let organisations = [];
  try { organisations = (await api.get('/public/organisations?all=1')).orgs || []; } catch(e) {}

  const typesBesoin = [
    'Aide alimentaire','Aide médicale','Soutien financier','Formation / éducation',
    'Assistance juridique','Logement','Emploi','Soutien psychosocial','Autre'
  ];

  document.body.className = '';
  document.body.innerHTML = `
    <div class="pub-form-wrap">
      <button class="pub-form-back" onclick="landingNav('landing')">
        ← Retour à l'accueil
      </button>
      <div class="pub-form-card">
        <div class="pub-form-logo">
          <img src="/images/logo.svg" class="logo-sm" alt="SoliDev">
          <span>SoliDev</span>
        </div>

        <h2>💬 Expression d'un besoin</h2>
        <p class="sub-desc">
          Exprimez votre besoin sans inscription. Ce formulaire est accessible à toute personne physique
          ou morale (entreprise, association, institution). Nous vous mettrons en relation avec
          les organisations compétentes.
        </p>

        <!-- Type d'entité -->
        <div class="entity-tabs" id="entityTabs">
          <button class="entity-tab active" data-entity="physique">👤 Personne physique</button>
          <button class="entity-tab" data-entity="morale">🏢 Personne morale</button>
        </div>

        <form id="besoinsForm">
          <input type="hidden" name="typeEntite" id="typeEntiteInput" value="physique">

          <!-- Champs personne physique -->
          <div id="champsPhysique">
            <div class="form-group">
              <label>Nom et prénom *</label>
              <input type="text" name="nomPhys" placeholder="Votre nom et prénom">
            </div>
          </div>

          <!-- Champs personne morale -->
          <div id="champsMorale" style="display:none">
            <div class="form-group">
              <label>Nom de l'organisation / entreprise *</label>
              <input type="text" name="nomMoral" placeholder="Ex : Société Bakoly SARL">
            </div>
          </div>

          <div class="form-group">
            <label>Organisation destinataire *</label>
            <select name="numAgr" required>
              <option value="">Sélectionner l'organisation qui recevra ce besoin…</option>
              ${organisations.map(o=>`<option value="${o.NumAgr}">${o.LibOrg}</option>`).join('')}
            </select>
          </div>

          <!-- Champs communs -->
          <div class="form-row">
            <div class="form-group">
              <label>Email *</label>
              <input type="email" name="email" required placeholder="contact@exemple.com">
            </div>
            <div class="form-group">
              <label>Téléphone</label>
              <input type="text" name="tel" placeholder="+223 70 00 00 00">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Pays *</label>
              <select name="pays" required>
                <option value="">Sélectionner…</option>
                ${pays.map(p=>`<option value="${p.id}">${p.lib}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Type de besoin *</label>
              <select name="typeBesoin" required>
                <option value="">Sélectionner…</option>
                ${typesBesoin.map(t=>`<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Description détaillée du besoin *</label>
            <textarea name="description" rows="5" required
              placeholder="Décrivez votre situation et votre besoin avec le plus de détails possible. Plus vous êtes précis, plus nos équipes pourront vous aider efficacement."></textarea>
          </div>

          <div id="besoinsMsg" class="msg" style="display:none"></div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" onclick="landingNav('landing')">Annuler</button>
            <button type="submit" class="btn btn-primary">📤 Soumettre mon besoin</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Toggle physique / morale
  document.getElementById('entityTabs').addEventListener('click', e => {
    const btn = e.target.closest('.entity-tab');
    if (!btn) return;
    document.querySelectorAll('.entity-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const entity = btn.dataset.entity;
    document.getElementById('typeEntiteInput').value = entity;
    document.getElementById('champsPhysique').style.display = entity === 'physique' ? '' : 'none';
    document.getElementById('champsMorale').style.display  = entity === 'morale'   ? '' : 'none';
  });

  // Soumission
  document.getElementById('besoinsForm').onsubmit = async e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const data = Object.fromEntries(fd.entries());
    const msg  = document.getElementById('besoinsMsg');
    const btn  = e.target.querySelector('[type="submit"]');

    // Construire le nom en fonction du type d'entité
    const entity = data.typeEntite;
    const nom = entity === 'physique'
      ? (data.nomPhys || '').trim()
      : data.nomMoral || '';

    if (!nom) {
      msg.style.display = 'block';
      msg.className = 'msg error';
      msg.textContent = entity === 'physique' ? 'Veuillez saisir votre nom et prénom.' : 'Veuillez saisir le nom de l\'organisation.';
      return;
    }

    if (!data.numAgr) {
      msg.style.display = 'block';
      msg.className = 'msg error';
      msg.textContent = 'Veuillez sélectionner l\'organisation destinataire.';
      return;
    }

    const orgChoisie = organisations.find(o => o.NumAgr === data.numAgr);

    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';

    try {
      const res = await fetch('/api/public/besoins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, nom }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);

      document.querySelector('.pub-form-card').innerHTML = `
        <div class="pub-success">
          <div class="success-icon">📬</div>
          <h3>Besoin enregistré !</h3>
          <p>
            Merci <strong>${nom}</strong>, votre besoin a bien été reçu.<br>
            Référence : <strong>#${result.id}</strong><br><br>
            <strong>${result.organisation || orgChoisie?.LibOrg || 'L\'organisation sélectionnée'}</strong> vous contactera sous peu à l'adresse <strong>${data.email}</strong>.
          </p>
          <button class="btn btn-primary" style="margin-right:10px" onclick="landingNav('expression-besoins')">Nouveau besoin</button>
          <button class="btn btn-secondary" onclick="landingNav('landing')">← Accueil</button>
        </div>
      `;
    } catch (err) {
      msg.style.display = 'block';
      msg.className = 'msg error';
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = '📤 Soumettre mon besoin';
    }
  };
});
