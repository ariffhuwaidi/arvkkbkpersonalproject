// @vitest-environment jsdom
// Renders real components in a simulated browser page and checks what a user sees.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NavigationBar } from '../src/components/nav-bar';
import { createRecordCard } from '../src/components/record-card';
import { createMMTCard } from '../src/components/mmt-card';
import { MessageGenerator } from '../src/components/message-generator';
import { renderSecurityPane } from '../src/components/settings/security-pane';
import { renderDeletedPane, refreshDeletedList } from '../src/components/settings/deleted-pane';
import { hasPin, removePin } from '../src/utils/app-lock';
import { mmt, rec } from './helpers';

afterEach(() => { document.body.innerHTML = ''; });

describe('bottom navigation', () => {
  it('has exactly Records, TCA and More, and switches tabs', () => {
    const onChange = vi.fn();
    new NavigationBar('records', onChange);
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab-item')];
    expect(tabs.map(t => t.dataset.tab)).toEqual(['records', 'tca', 'more']);
    expect(tabs.map(t => t.textContent!.trim())).toEqual(['Records', 'TCA', 'More']);
    tabs[1].click();
    expect(onChange).toHaveBeenCalledWith('tca');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
  });
});

describe('patient card menu', () => {
  it('offers the five actions and runs the chosen one', () => {
    const actions = { onView: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(), onToggleActive: vi.fn(), onChangeCategory: vi.fn() };
    const card = createRecordCard(rec({ id: 'a', patientType: 'New' }), actions);
    document.body.appendChild(card);
    card.querySelector<HTMLButtonElement>('.btn-card-menu')!.click();
    const items = [...document.querySelectorAll<HTMLButtonElement>('.ios-menu-item')];
    expect(items.map(i => i.textContent!.trim())).toEqual(['View Profile', 'Edit Patient', 'Change Category', 'Deactivate Patient', 'Delete Patient']);
    items[2].click();
    expect(actions.onChangeCategory).toHaveBeenCalledWith('Existing');
    expect(actions.onView).not.toHaveBeenCalled();
  });

  it('escapes the patient name', () => {
    const card = createRecordCard(rec({ name: '<img src=x onerror=alert(1)>' }), () => {});
    expect(card.querySelector('img')).toBeNull();
    expect(card.textContent).toContain('<img src=x');
  });
});

describe('MMT card', () => {
  it('escapes the patient name and shows the dose', () => {
    const card = createMMTCard(rec({ name: '<b>x</b>', programs: ['MMT'], mmt: mmt({ currentDoseMg: 60 }) }), { onView: () => {}, onQuickDose: () => {} });
    expect(card.querySelector('b')).toBeNull();
    expect(card.textContent).toContain('60 mg');
  });
});

describe('More > Security', () => {
  afterEach(() => removePin());

  it('refuses an easy PIN and saves a good one', async () => {
    const pane = document.createElement('div');
    document.body.appendChild(pane);
    renderSecurityPane(pane, { onLockNow: () => {} });
    pane.querySelector<HTMLButtonElement>('[data-pin-action="set"]')!.click();
    const fill = (pin: string) => {
      pane.querySelector<HTMLInputElement>('#pin-new')!.value = pin;
      pane.querySelector<HTMLInputElement>('#pin-new2')!.value = pin;
      pane.querySelector<HTMLFormElement>('#pin-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    };
    fill('1111');
    await vi.waitFor(() => expect(pane.querySelector('#pin-error')!.textContent).toMatch(/too easy/));
    expect(hasPin()).toBe(false);
    fill('2580');
    await vi.waitFor(() => expect(hasPin()).toBe(true));
    expect(pane.querySelector('[data-pin-action="lock"]')).not.toBeNull();
  });
});

describe('More > Recently Deleted', () => {
  it('lists deleted patients safely and restores one', async () => {
    const pane = document.createElement('div');
    document.body.appendChild(pane);
    renderDeletedPane(pane);
    const onRestoreDeleted = vi.fn(async () => {});
    const people = [rec({ id: 'd1', name: '<i>Hidden</i>', deletedAt: new Date().toISOString() })];
    await refreshDeletedList(pane, { listDeleted: async () => people, onRestoreDeleted, onPurgeDeleted: async () => {} });
    expect(pane.querySelector('.deleted-row-name i')).toBeNull();
    expect(pane.querySelector('.deleted-row-name')!.textContent).toBe('<i>Hidden</i>');
    expect(pane.textContent).toContain('30 days left');
    pane.querySelector<HTMLButtonElement>('[data-restore]')!.click();
    await vi.waitFor(() => expect(onRestoreDeleted).toHaveBeenCalledWith('d1'));
  });
});

describe('message generator', () => {
  it('offers six message types and three tones, and writes a preview', () => {
    const el = new MessageGenerator().getElement();
    document.body.appendChild(el);
    const options = [...el.querySelectorAll<HTMLOptionElement>('#msg-select-template option')].map(o => o.value);
    expect(options).toEqual(expect.arrayContaining(['blood_collection', 'tca_reschedule', 'tca_reminder', 'missed_appointment', 'general_followup', 'custom']));
    expect(options).toHaveLength(6);
    const tones = [...el.querySelectorAll<HTMLButtonElement>('#msg-tone-control .segment-btn')].map(b => b.textContent);
    expect(tones).toEqual(['Polite', 'Friendly', 'Formal']);
    const preview = el.querySelector<HTMLTextAreaElement>('#msg-preview-text')!;
    expect(preview.value.length).toBeGreaterThan(20);
  });
});
