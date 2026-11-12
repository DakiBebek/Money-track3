export function initSplashScreen(): void {
  try {
    if (sessionStorage.getItem('duitku_splash_shown')) {
      document.documentElement.classList.add('no-splash');
      const sp = document.getElementById('splash-screen');
      if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
      return;
    }
  } catch {}

  // Failsafe timeout to prevent any potential UI lock
  setTimeout(() => {
    safeDismissSplash();
  }, 2200);
}

export function safeDismissSplash(): void {
  try {
    sessionStorage.setItem('duitku_splash_shown', '1');
  } catch {}
  const sp = document.getElementById('splash-screen');
  if (sp && !sp.classList.contains('splash-exit')) {
    sp.classList.add('splash-exit');
    setTimeout(() => {
      if (sp && sp.parentNode) sp.parentNode.removeChild(sp);
    }, 450);
  }
}
