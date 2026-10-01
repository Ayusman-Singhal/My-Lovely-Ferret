import { describe, expect, it } from 'vitest';
import { isIos, isIosBrowserNotInstalled, rememberDismissed, wasDismissed, type IosEnv } from './ios';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';

const env = (over: Partial<IosEnv>): IosEnv => ({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5, standalone: false, displayModeStandalone: false, ...over });

describe('isIos', () => {
  it('knows iPhones, and iPads that pretend to be Macs', () => {
    expect(isIos(env({}))).toBe(true);
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('does not mistake Android or a real Mac for iOS', () => {
    expect(isIos({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
  });
});

describe('isIosBrowserNotInstalled', () => {
  it('is true for an iPhone in the browser', () => {
    expect(isIosBrowserNotInstalled(env({}))).toBe(true);
    expect(isIosBrowserNotInstalled(env({ standalone: undefined }))).toBe(true);
  });

  it('is false once the app is on the Home Screen, either way the browser says so', () => {
    expect(isIosBrowserNotInstalled(env({ standalone: true }))).toBe(false);
    expect(isIosBrowserNotInstalled(env({ displayModeStandalone: true }))).toBe(false);
  });

  it('is false on other systems', () => {
    expect(isIosBrowserNotInstalled(env({ userAgent: ANDROID, platform: 'Linux armv8l' }))).toBe(false);
  });
});

describe('dismissing the notice', () => {
  it('remembers a dismissal, and survives missing or broken storage', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    expect(wasDismissed(storage)).toBe(false);
    rememberDismissed(storage);
    expect(wasDismissed(storage)).toBe(true);

    expect(wasDismissed(null)).toBe(false);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(wasDismissed(broken)).toBe(false);
    expect(() => rememberDismissed(broken)).not.toThrow();
  });
});
