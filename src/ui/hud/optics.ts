import { optics } from '../../content/data/attachments';

/**
 * Optic overlays (DOM over the canvas): a red dot, or a scope picture (black mask with a clear circle and a thin reticle).
 * `set(mode, k)` is called every frame with the ADS blend; below `optics.showAbove` nothing shows. The normal HUD
 * crosshair is hidden while an optic overlay is up (body class `optic`).
 */
export class OpticsOverlay {
  private root = document.createElement('div');
  private dot = document.createElement('div');
  private scope = document.createElement('div');
  private mode: 'none' | 'dot' | 'scope' = 'none';

  constructor() {
    const css = document.createElement('style');
    css.textContent = `
body.optic .hud .xh{display:none}
#optics{position:fixed;inset:0;pointer-events:none;z-index:12}
#optics .dot{position:absolute;left:50%;top:50%;border-radius:50%;transform:translate(-50%,-50%);display:none}
#optics .scope{position:absolute;inset:0;display:none}
#optics .scope .mask{position:absolute;inset:0}
#optics .scope .h,#optics .scope .v{position:absolute;background:#0a0a0a}
#optics .scope .h{left:50%;top:50%;height:2px;transform:translate(-50%,-50%)}
#optics .scope .v{left:50%;top:50%;width:2px;transform:translate(-50%,-50%)}
#optics .scope .c{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:#d02020}`;
    document.head.appendChild(css);
    this.root.id = 'optics';
    const r = optics.scopeRadius;
    this.scope.className = 'scope';
    this.scope.innerHTML = `<div class="mask" style="background:radial-gradient(circle at 50% 50%,transparent 0,transparent ${r * 100 - 0.4}vmin,#050505 ${r * 100 + 0.1}vmin)"></div>
<div class="h" style="width:${r * 190}vmin"></div><div class="v" style="height:${r * 190}vmin"></div><div class="c"></div>`;
    this.dot.className = 'dot';
    this.dot.style.cssText = `width:${optics.dotSizePx}px;height:${optics.dotSizePx}px;background:${optics.dotColor};box-shadow:0 0 6px 2px ${optics.dotColor}aa`;
    this.root.append(this.scope, this.dot);
    document.body.appendChild(this.root);
  }

  set(mode: 'none' | 'dot' | 'scope', k: number) {
    const m = mode !== 'none' && k >= optics.showAbove ? mode : 'none';
    if (m === this.mode) return;
    this.mode = m;
    this.dot.style.display = m === 'dot' ? 'block' : 'none';
    this.scope.style.display = m === 'scope' ? 'block' : 'none';
    document.body.classList.toggle('optic', m !== 'none');
  }
  get active() {
    return this.mode;
  }
}
