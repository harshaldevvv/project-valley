/**
 * Raw input state (keys by KeyboardEvent.code, mouse buttons as 'Mouse0'/'Mouse1'/'Mouse2'). Sim reads a snapshot each tick (keys held, mouse delta accumulated since
 * the last read), so input is applied on sim ticks, not render frames.
 */
export class Input {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private dx = 0;
  private dy = 0;
  locked = false;
  /** True while a UI screen is open: gameplay sees no keys/mouse, pointer lock is released. */
  private _blocked = false;

  constructor(private el: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
    });
    addEventListener('keyup', (e) => this.held.delete(e.code));
    addEventListener('blur', () => this.held.clear());
    // Mouse buttons use the pseudo-codes Mouse0 (LMB), Mouse1 (MMB), Mouse2 (RMB), same API as keys.
    // Only presses on the canvas (or while pointer-locked) count, so clicks on DOM UI never fire weapons.
    addEventListener('mousedown', (e) => {
      if (this._blocked || (e.target !== el && !this.locked)) return;
      const c = `Mouse${e.button}`;
      this.pressed.add(c);
      this.held.add(c);
    });
    addEventListener('mouseup', (e) => this.held.delete(`Mouse${e.button}`));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('click', () => !this._blocked && this.lock());
    document.addEventListener('pointerlockchange', () => (this.locked = document.pointerLockElement === el));
    addEventListener('mousemove', (e) => {
      if (!this.locked || this._blocked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
  }

  private async lock() {
    if (this.locked) return;
    try {
      // Raw, unaccelerated mouse (avoids the Chrome pointer-lock skip, three.js #27040).
      await this.el.requestPointerLock({ unadjustedMovement: true });
    } catch {
      // Older browsers reject the option; some contexts (automation, iframes) reject lock entirely.
      await this.el.requestPointerLock()?.catch?.(() => {});
    }
  }

  get blocked() {
    return this._blocked;
  }
  set blocked(b: boolean) {
    this._blocked = b;
    if (b) {
      this.held.clear();
      this.dx = this.dy = 0;
      if (document.pointerLockElement) document.exitPointerLock();
    }
  }

  down(code: string) {
    return !this._blocked && this.held.has(code);
  }

  /** True once per physical press; cleared by endTick(). */
  justPressed(code: string) {
    return !this._blocked && this.pressed.has(code);
  }

  /** Mouse movement since last call. */
  takeMouse(): [number, number] {
    const d: [number, number] = [this.dx, this.dy];
    this.dx = this.dy = 0;
    return d;
  }

  endTick() {
    this.pressed.clear();
  }
}
