import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_HOTKEY_BINDINGS, dispatchHotkeyKeyboardEvent, dispatchHotkeyMenuCommand, getCanonicalComboForTest, getEventComboForTest } from './index';
import type { HotkeyCommandId, HotkeyKeyEvent } from './types';

function createEvent(overrides: Partial<HotkeyKeyEvent> = {}): HotkeyKeyEvent {
  return {
    key: 's',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    target: null,
    preventDefault: () => undefined,
    ...overrides
  };
}

test('combo normalization is stable', () => {
  assert.equal(getCanonicalComboForTest('mod+shift+n'), 'mod+shift+n');
  assert.equal(getCanonicalComboForTest('shift+mod+n'), 'mod+shift+n');
  assert.equal(getCanonicalComboForTest('mod+,'), 'mod+comma');
});

test('event combo uses platform-specific mod key', () => {
  const macCombo = getEventComboForTest(
    createEvent({ key: 's', metaKey: true }),
    true
  );
  assert.equal(macCombo, 'mod+s');

  const winCombo = getEventComboForTest(
    createEvent({ key: 's', ctrlKey: true }),
    false
  );
  assert.equal(winCombo, 'mod+s');
});

test('dispatches matched hotkey and prevents default', () => {
  let prevented = false;
  const calls: HotkeyCommandId[] = [];

  const result = dispatchHotkeyKeyboardEvent({
    event: createEvent({
      key: 's',
      ctrlKey: true,
      preventDefault: () => {
        prevented = true;
      }
    }),
    bindings: DEFAULT_HOTKEY_BINDINGS,
    handlers: {
      'editor.saveActiveFile': () => {
        calls.push('editor.saveActiveFile');
      }
    },
    context: {
      settingsModalOpen: false,
      navbarOverlayOpen: false,
      hasActiveWorkspace: true,
      agentBusy: false,
      sessionBusy: false
    },
    isMac: false
  });

  assert.equal(result.matched, true);
  assert.equal(result.dispatched, true);
  assert.equal(result.command, 'editor.saveActiveFile');
  assert.equal(prevented, true);
  assert.deepEqual(calls, ['editor.saveActiveFile']);
});

test('strict gating blocks shortcuts in overlays and editables', () => {
  const blockedByOverlay = dispatchHotkeyKeyboardEvent({
    event: createEvent({ key: 'o', ctrlKey: true }),
    bindings: DEFAULT_HOTKEY_BINDINGS,
    handlers: {
      'app.openFolder': () => {
        throw new Error('should not run');
      }
    },
    context: {
      settingsModalOpen: true,
      navbarOverlayOpen: false,
      hasActiveWorkspace: true,
      agentBusy: false,
      sessionBusy: false
    },
    isMac: false
  });
  assert.equal(blockedByOverlay.dispatched, false);

  const blockedInEditable = dispatchHotkeyKeyboardEvent({
    event: createEvent({ key: 'o', ctrlKey: true }),
    bindings: DEFAULT_HOTKEY_BINDINGS,
    handlers: {
      'app.openFolder': () => {
        throw new Error('should not run');
      }
    },
    context: {
      settingsModalOpen: false,
      navbarOverlayOpen: false,
      hasActiveWorkspace: true,
      agentBusy: false,
      sessionBusy: false
    },
    isEditableTargetOverride: true,
    isMac: false
  });
  assert.equal(blockedInEditable.dispatched, false);
});

test('menu dispatch uses same command gating', () => {
  let called = false;

  const blocked = dispatchHotkeyMenuCommand({
    command: 'chat.newSession',
    handlers: {
      'chat.newSession': () => {
        called = true;
      }
    },
    context: {
      settingsModalOpen: false,
      navbarOverlayOpen: false,
      hasActiveWorkspace: false,
      agentBusy: false,
      sessionBusy: false
    }
  });

  assert.equal(blocked, false);
  assert.equal(called, false);
});
