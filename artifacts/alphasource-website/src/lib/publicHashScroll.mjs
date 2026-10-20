// Public pages only. Never mounted by protected dashboards or interview routes.
export function mountPublicHashScroll(win, doc) {
  let stopWaiting = () => {};
  let disposed = false;
  const cancel = () => stopWaiting();
  const scroll = () => {
    cancel();
    let id;
    try { id = decodeURIComponent(win.location.hash.slice(1)); } catch { return; }
    if (!id) return;
    let observer, timer, frame, stopped = false;
    stopWaiting = () => {
      stopped = true;
      observer?.disconnect();
      win.clearTimeout(timer);
      win.cancelAnimationFrame(frame);
    };
    const find = () => {
      const target = doc.getElementById(id);
      if (!target) return false;
      observer?.disconnect();
      win.clearTimeout(timer);
      // Wait for web fonts so content above the anchor has its final height.
      Promise.resolve(doc.fonts?.ready).then(() => {
        if (stopped || disposed) return;
        frame = win.requestAnimationFrame(() => {
          if (stopped || disposed || !target.isConnected) return;
          const margin = parseFloat(win.getComputedStyle(target).scrollMarginTop) || 0;
          const top = Math.max(0, target.getBoundingClientRect().top + win.scrollY - margin);
          win.scrollTo({ top, behavior: win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        });
      });
      return true;
    };
    if (!find()) {
      observer = new win.MutationObserver(find);
      observer.observe(doc.body, { childList: true, subtree: true });
      timer = win.setTimeout(cancel, 5000);
    }
  };
  const onClick = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[href]');
    if (!anchor || anchor.download || (anchor.target && anchor.target !== '_self')) return;
    const url = new URL(anchor.href, win.location.href);
    if (url.origin !== win.location.origin || url.pathname !== win.location.pathname || url.search !== win.location.search || !url.hash) return;
    // Same-page hashes do not remount React; handle them including repeated clicks.
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch { return; }
    if (!doc.getElementById(id)) return;
    event.preventDefault();
    if (url.hash !== win.location.hash) win.history.pushState(null, '', url.href);
    scroll();
  };
  win.addEventListener('hashchange', scroll);
  win.addEventListener('popstate', scroll);
  doc.addEventListener('click', onClick);
  scroll();
  return () => {
    disposed = true;
    cancel();
    win.removeEventListener('hashchange', scroll);
    win.removeEventListener('popstate', scroll);
    doc.removeEventListener('click', onClick);
  };
}
