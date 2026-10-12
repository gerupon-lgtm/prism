(() => {
  const preview = document.querySelector('.preview');
  const stage = document.querySelector('.logo-stage');
  const logo = document.querySelector('.logo-container');
  const lines = [...logo.querySelectorAll('h1, h2')];
  let pendingFrame = 0;

  function fitLogo() {
    pendingFrame = 0;
    const viewport = window.visualViewport;
    preview.style.width = `${viewport?.width ?? window.innerWidth}px`;
    preview.style.height = `${viewport?.height ?? window.innerHeight}px`;

    // Restore the supplied 96/36px design to measure its actual font geometry.
    logo.style.setProperty('--base-logo-size', '96px');
    logo.style.setProperty('--logo-scale', '1');
    const base = logo.getBoundingClientRect();
    const center = (base.left + base.right) / 2;
    // The source cancels trailing letter-spacing with a negative margin.
    // Include both sides around the center so even the full line boxes fit.
    const width = Math.max(base.width, ...lines.map(line => {
      const bounds = line.getBoundingClientRect();
      return 2 * Math.max(center - bounds.left, bounds.right - center);
    }));
    const scale = Math.max(0, Math.min(1, (stage.clientWidth - 2) / width, (stage.clientHeight - 2) / base.height));
    // Scaling font sizes and spacing changes layout; nothing is clipped or hidden.
    logo.style.setProperty('--logo-scale', String(Math.floor(scale * 1e6) / 1e6));
    logo.dataset.fitReady = 'true';
  }

  function scheduleFit() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(fitLogo);
  }

  fitLogo();
  window.addEventListener('resize', scheduleFit);
  window.visualViewport?.addEventListener('resize', scheduleFit);
  new ResizeObserver(scheduleFit).observe(stage);
  document.fonts.ready.then(scheduleFit);
  document.fonts.addEventListener('loadingdone', scheduleFit);
})();
