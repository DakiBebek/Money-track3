export function initSplashScreen(): void {
  const sp = document.getElementById('splash-screen');
  if (sp) sp.remove();
}

export function safeDismissSplash(): void {
  const sp = document.getElementById('splash-screen');
  if (sp) sp.remove();
}
