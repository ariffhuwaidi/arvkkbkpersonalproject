// @vitest-environment jsdom
// App lock: idle auto-lock, what happens on lock, and Drive encryption.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LockScreen, idleLockMs } from '../src/components/lock-screen';
import { setPin, removePin, setAutoLockSeconds } from '../src/utils/app-lock';

describe('idle lock delay', () => {
  it('follows the auto-lock setting, with a 30 second floor while the app is open', () => {
    expect(idleLockMs(0)).toBe(30_000);
    expect(idleLockMs(30)).toBe(30_000);
    expect(idleLockMs(60)).toBe(60_000);
    expect(idleLockMs(300)).toBe(300_000);
  });
});

describe('lock screen', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = '';
    document.body.className = '';
    await setPin('1234');
    setAutoLockSeconds(60);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    removePin();
  });

  it('locks by itself after the delay with no activity, even in the foreground', () => {
    const onLock = vi.fn();
    new LockScreen(() => {}, onLock);
    vi.advanceTimersByTime(59_000);
    expect(document.body.classList.contains('is-locked')).toBe(false);
    vi.advanceTimersByTime(16_000);
    expect(document.body.classList.contains('is-locked')).toBe(true);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('activity resets the idle timer', () => {
    new LockScreen(() => {}, () => {});
    vi.advanceTimersByTime(50_000);
    window.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(50_000);
    expect(document.body.classList.contains('is-locked')).toBe(false);
    vi.advanceTimersByTime(30_000);
    expect(document.body.classList.contains('is-locked')).toBe(true);
  });

  it('runs the lock callback when locked by hand, so patient screens can be cleared', () => {
    const onLock = vi.fn();
    const screen = new LockScreen(() => {}, onLock);
    screen.lock();
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('does nothing when no PIN is set', () => {
    removePin();
    const onLock = vi.fn();
    new LockScreen(() => {}, onLock);
    vi.advanceTimersByTime(10 * 60_000);
    expect(onLock).not.toHaveBeenCalled();
  });
});
