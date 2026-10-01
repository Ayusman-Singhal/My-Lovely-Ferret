// iOS Safari deletes a website's saved data after about 7 days without use, unless the site is
// added to the Home Screen (guide §8, §25.3; verify the current behavior, docs/VERIFY_LOG.md). A
// tester on an iPhone could lose their pet, so the browser build says so, plainly, once.

export interface IosEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Safari's own flag: true when launched from the Home Screen. */
  standalone: boolean | undefined;
  /** The `(display-mode: standalone)` media query. */
  displayModeStandalone: boolean;
}

/** An iPhone, iPod, or iPad. iPadOS reports itself as a Mac, so touch support tells them apart. */
export function isIos(env: Pick<IosEnv, 'userAgent' | 'platform' | 'maxTouchPoints'>): boolean {
  return /iPad|iPhone|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

/** True when the pet could be deleted by the browser: iOS, and not launched from the Home Screen. */
export function isIosBrowserNotInstalled(env: IosEnv): boolean {
  return isIos(env) && env.standalone !== true && !env.displayModeStandalone;
}

const DISMISS_KEY = 'ios-notice-dismissed';

export interface SimpleStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Storage can be missing or throw (private windows, blocked site data), so every call is guarded. */
export function wasDismissed(storage: SimpleStorage | null): boolean {
  try {
    return storage?.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberDismissed(storage: SimpleStorage | null): void {
  try {
    storage?.setItem(DISMISS_KEY, '1');
  } catch {
    /* the notice may come back next time, which is fine */
  }
}

export function readIosEnv(): IosEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  return {
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    standalone: nav.standalone,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
  };
}
