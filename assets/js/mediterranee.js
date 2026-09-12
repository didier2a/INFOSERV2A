/* Page controls use Claire's existing instance. No audio provider or session is created here. */
(() => {
  const header = document.querySelector('.med-header');
  if (header) {
    const compact = () => header.classList.toggle('med-compact', header.getBoundingClientRect().width < 920);
    new ResizeObserver(compact).observe(header);
    compact();
  }
  function revealAnchor() {
    if (!location.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch { return; }
    if (target?.matches('details')) target.open = true;
  }
  revealAnchor();
  window.addEventListener('hashchange', revealAnchor);
  document.addEventListener('infoserv:content-changed', revealAnchor);
  // Keep the mobile keyboard's working area free while the visitor fills a form.
  const syncFormFocus = () => {
    const active = document.activeElement;
    document.body.classList.toggle('med-form-editing', Boolean(active?.matches('#contenu input, #contenu textarea, #contenu select')));
  };
  document.addEventListener('focusin', syncFormFocus);
  document.addEventListener('focusout', () => setTimeout(syncFormFocus, 0));
  document.addEventListener('infoserv:content-changed', syncFormFocus);
  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href*="#"]');
    if (!link) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !url.hash) return;
    let target;
    try { target = document.getElementById(decodeURIComponent(url.hash.slice(1))); } catch { return; }
    if (target?.matches('details')) target.open = true;
  }, true);

  let actionPending = false;
  const feedback = (message) => document.querySelectorAll('[data-med-claire-status]').forEach(node => { node.textContent = message; });
  document.addEventListener('click', async (event) => {
    const button = event.target.closest?.('[data-med-claire]');
    if (!button || actionPending) return;
    const companion = window.InfoServClaire?.companion;
    if (!companion) { feedback('Claire se prépare. Réessayez dans un instant.'); return; }
    actionPending = true;
    document.querySelectorAll('[data-med-claire]').forEach(node => { node.disabled = true; });
    try {
      if (button.dataset.medClaire === 'project') {
        feedback('Ouverture de votre échange avec Claire…');
        await companion.start();
        feedback(companion.provider?.connected ? 'Votre échange est ouvert dans le panneau de Claire.' : 'Le direct est indisponible ici. Vous pouvez écrire à Claire ou joindre Didier.');
      } else {
        const text = document.querySelector('[data-med-presentation-text]')?.textContent.trim();
        if (!text) return;
        feedback('Préparation de la présentation, sans microphone…');
        // Interrupt can resume listening, so always pause after it.
        companion.interrupt();
        await companion.provider?.pauseListening?.();
        await companion.connectLiveSession({ microphone: false, state: 'guided', skipWelcome: true });
        if (!companion.provider?.connected) {
          feedback('La voix de Claire est indisponible dans cet aperçu. Sa présentation reste lisible ci-dessous.');
          return;
        }
        companion.interrupt();
        await companion.provider.pauseListening?.();
        // The existing voice provider receives the validated text; no substitute voice.
        const accepted = await companion.speak('Lis uniquement cette présentation à la première personne, intégralement, sans ajout ni question : « ' + text + ' »');
        feedback(accepted ? 'Présentation demandée à Claire. Le bouton Interrompre de son panneau reste disponible.' : 'La lecture n’a pas démarré. Utilisez les contrôles de son panneau pour réessayer.');
      }
    } catch {
      feedback('Claire n’est pas disponible pour le moment. Vous pouvez lire sa présentation ou contacter Didier.');
    } finally {
      actionPending = false;
      document.querySelectorAll('[data-med-claire]').forEach(node => { node.disabled = false; });
    }
  });
})();
