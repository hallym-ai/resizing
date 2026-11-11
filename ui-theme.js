/* UI only: never changes document, canvas, image, or export state. */
(() => {
  'use strict';
  const key = 'coex-ui-theme';
  const root = document.documentElement;
  let theme = 'light';
  try { if (localStorage.getItem(key) === 'dark') theme = 'dark'; } catch {}
  const apply = value => {
    theme = value === 'dark' ? 'dark' : 'light';
    root.dataset.uiTheme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#111113' : '#ffffff');
  };
  apply(theme);
  const mount = () => {
    const header = document.querySelector('header.top');
    if (!header || document.getElementById('uiThemeToggle')) return;
    const controls = document.createElement('div');
    controls.className = 'ui-header-controls';
    const button = document.createElement('button');
    button.id = 'uiThemeToggle';
    button.type = 'button';
    button.className = 'ui-theme-toggle';
    button.setAttribute('aria-pressed', String(theme === 'dark'));
    const update = () => {
      const english = root.lang?.startsWith('en');
      const dark = theme === 'dark';
      button.textContent = dark ? (english ? '☀ Light mode' : '☀ 밝은 모드') : (english ? '☾ Dark mode' : '☾ 다크모드');
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', english ? 'Dark mode' : '다크모드');
      button.title = english ? 'Switch appearance. Your artwork stays unchanged.' : '화면 테마 전환 · 편집 중인 디자인은 그대로 유지됩니다';
    };
    button.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch {}
      update();
    });
    const lang = header.querySelector('.lang-toggle');
    header.append(controls);
    controls.append(button);
    if (lang) controls.append(lang);
    new MutationObserver(update).observe(root, {attributes:true, attributeFilter:['lang']});
    window.addEventListener('storage', event => {
      if (event.key === key || event.key === null) { apply(event.newValue === 'dark' ? 'dark' : 'light'); update(); }
    });
    update();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
