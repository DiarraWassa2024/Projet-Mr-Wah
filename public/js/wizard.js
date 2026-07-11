/**
 * Utilitaire générique pour les formulaires en plusieurs étapes (wizard).
 * Réutilise les classes CSS déjà utilisées par le wizard public d'adhésion
 * (.adh-progress-bar / .adh-prog-step / .adh-prog-num / .adh-prog-sep).
 */

/**
 * @param {Array<{label:string}>} steps
 * @param {number} currentStep — 1-based
 */
function renderWizardProgressBar(steps, currentStep) {
  return `<div class="adh-progress-bar">
    ${steps.map((s, i) => {
      const n = i + 1;
      return `
        <div class="adh-prog-step ${n < currentStep ? 'done' : n === currentStep ? 'active' : ''}">
          <div class="adh-prog-num">${n < currentStep ? '✓' : n}</div>
          <span>${s.label}</span>
        </div>
        ${i < steps.length - 1 ? `<div class="adh-prog-sep ${n < currentStep ? 'done' : ''}"></div>` : ''}`;
    }).join('')}
  </div>`;
}

/**
 * Contrôleur léger pour un wizard à panes (toggle d'affichage, pas de rechargement complet).
 * @param {HTMLElement} root — conteneur dans lequel chercher .wizard-pane[data-step]
 * @param {number} totalSteps
 */
function createWizardController(root, totalSteps) {
  let current = 1;

  function show(step) {
    current = Math.max(1, Math.min(totalSteps, step));
    root.querySelectorAll('.wizard-pane').forEach(pane => {
      pane.style.display = Number(pane.dataset.step) === current ? '' : 'none';
    });
    const bar = root.querySelector('.wizard-progress-slot');
    if (bar) bar.innerHTML = renderWizardProgressBar(
      Array.from(root.querySelectorAll('.wizard-pane')).map(p => ({ label: p.dataset.label || '' })),
      current
    );
    root.querySelectorAll('[data-wizard-prev]').forEach(b => b.style.display = current === 1 ? 'none' : '');
    root.querySelectorAll('[data-wizard-next]').forEach(b => b.style.display = current === totalSteps ? 'none' : '');
    root.querySelectorAll('[data-wizard-confirm]').forEach(b => b.style.display = current === totalSteps ? '' : 'none');
  }

  function validateCurrentPane() {
    const pane = root.querySelector(`.wizard-pane[data-step="${current}"]`);
    if (!pane) return true;
    const invalid = pane.querySelector(':invalid');
    if (invalid) { invalid.reportValidity(); return false; }
    return true;
  }

  return {
    goTo: show,
    next() { if (validateCurrentPane()) show(current + 1); },
    prev() { show(current - 1); },
    current() { return current; },
  };
}
