/**
 * D-pad navigation for TV remotes: arrow keys move focus to the nearest
 * focusable element in that direction (inside `root`).
 */
const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

type Dir = 'up' | 'down' | 'left' | 'right';
const KEY_DIR: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

function visible(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
}

/** Let the element handle the key itself when that is what the user expects. */
function nativeHandles(el: Element | null, dir: Dir): boolean {
  if (!el) return false;
  if (el instanceof HTMLInputElement) {
    if (el.type === 'range') return dir === 'left' || dir === 'right';
    if (/^(text|search|email|url|tel|password|number)$/.test(el.type)) {
      if (dir === 'left') return (el.selectionStart ?? 0) > 0;
      if (dir === 'right') return (el.selectionEnd ?? 0) < el.value.length;
    }
  }
  if (el instanceof HTMLTextAreaElement) {
    if (dir === 'up') return (el.selectionStart ?? 0) > 0 && el.value.lastIndexOf('\n', (el.selectionStart ?? 0) - 1) >= 0;
    if (dir === 'down') return el.value.indexOf('\n', el.selectionEnd ?? 0) >= 0;
    return true;
  }
  return false;
}

export function moveFocus(root: HTMLElement, dir: Dir): boolean {
  const cur = document.activeElement as HTMLElement | null;
  const all = Array.prototype.slice.call(root.querySelectorAll(FOCUSABLE)).filter(visible) as HTMLElement[];
  if (!all.length) return false;
  if (!cur || !root.contains(cur) || cur === root) { all[0].focus(); return true; }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best: HTMLElement | null = null, bestScore = Infinity;
  for (const el of all) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    let main: number, cross: number;
    if (dir === 'down') { if (b.top < a.bottom - 4) continue; main = b.top - a.bottom; cross = Math.abs(dx); }
    else if (dir === 'up') { if (b.bottom > a.top + 4) continue; main = a.top - b.bottom; cross = Math.abs(dx); }
    else if (dir === 'right') { if (b.left < a.right - 4) continue; main = b.left - a.right; cross = Math.abs(dy); }
    else { if (b.right > a.left + 4) continue; main = a.left - b.right; cross = Math.abs(dy); }
    const score = Math.max(0, main) + cross * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return true;
  }
  return false;
}

export function handleArrow(root: HTMLElement, e: KeyboardEvent): boolean {
  const dir = KEY_DIR[e.key];
  if (!dir) return false;
  const el = document.activeElement;
  if (el instanceof HTMLSelectElement && (dir === 'up' || dir === 'down')) { e.preventDefault(); return moveFocus(root, dir); }
  if (nativeHandles(el, dir)) return false;
  e.preventDefault();
  return moveFocus(root, dir);
}

/** Remote "Back" keys across platforms (browser, Android TV, Tizen, webOS). */
export const isBackKey = (e: KeyboardEvent) =>
  e.key === 'Escape' || e.key === 'GoBack' || e.key === 'BrowserBack' || e.keyCode === 10009 || e.keyCode === 461;
