import type {
  HotkeyBinding,
  HotkeyCommandId,
  HotkeyContext,
  HotkeyDispatchResult,
  HotkeyHandlers,
  HotkeyKeyEvent,
  HotkeySource
} from './types';

type ParsedCombo = {
  combo: string;
  allowInEditable: boolean;
  command: HotkeyCommandId;
};
const bindingMapCache = new WeakMap<HotkeyBinding[], Map<string, ParsedCombo>>();

function normalizeKeyToken(rawKey: string): string {
  const key = rawKey.toLowerCase();
  if (key === ',') return 'comma';
  if (key === ' ') return 'space';
  if (key === 'escape') return 'escape';
  if (key === 'arrowup') return 'arrowup';
  if (key === 'arrowdown') return 'arrowdown';
  if (key === 'arrowleft') return 'arrowleft';
  if (key === 'arrowright') return 'arrowright';
  if (key.length === 1) {
    if (key >= 'a' && key <= 'z') return key;
    if (key >= '0' && key <= '9') return key;
  }
  return key;
}

function canonicalCombo(parts: { mod: boolean; alt: boolean; shift: boolean; key: string }): string {
  const tokens: string[] = [];
  if (parts.mod) tokens.push('mod');
  if (parts.alt) tokens.push('alt');
  if (parts.shift) tokens.push('shift');
  tokens.push(parts.key);
  return tokens.join('+');
}

function parseCombo(binding: HotkeyBinding): ParsedCombo {
  const rawParts = binding.combo
    .split('+')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);

  const mod = rawParts.includes('mod');
  const alt = rawParts.includes('alt');
  const shift = rawParts.includes('shift');
  const keyToken = rawParts.find((item) => item !== 'mod' && item !== 'alt' && item !== 'shift') ?? '';

  return {
    combo: canonicalCombo({
      mod,
      alt,
      shift,
      key: normalizeKeyToken(keyToken)
    }),
    allowInEditable: binding.allowInEditable ?? false,
    command: binding.command
  };
}

function eventToCanonicalCombo(event: HotkeyKeyEvent, isMac: boolean): string | null {
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  const key = normalizeKeyToken(event.key);

  if (key === 'meta' || key === 'control' || key === 'alt' || key === 'shift') {
    return null;
  }

  return canonicalCombo({
    mod: modPressed,
    alt: event.altKey,
    shift: event.shiftKey,
    key
  });
}

function isEditableElement(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined') return false;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const closestEditable = target.closest('[contenteditable="true"]');
  if (closestEditable) return true;

  const tagName = target.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function isCommandAllowedInContext(command: HotkeyCommandId, context: HotkeyContext): boolean {
  if (context.settingsModalOpen || context.navbarOverlayOpen) return false;

  if (command === 'chat.newSession') {
    if (!context.hasActiveWorkspace) return false;
    if (context.agentBusy || context.sessionBusy) return false;
  }

  if ((command === 'arduino.compile' || command === 'arduino.upload') && !context.hasActiveWorkspace) {
    return false;
  }

  return true;
}

function dispatchCommand(command: HotkeyCommandId, source: HotkeySource, handlers: HotkeyHandlers): boolean {
  const handler = handlers[command];
  if (!handler) return false;

  void handler({ command, source });
  return true;
}

function resolveBindingMap(bindings: HotkeyBinding[]): Map<string, ParsedCombo> {
  const cached = bindingMapCache.get(bindings);
  if (cached) return cached;

  const map = new Map<string, ParsedCombo>();

  for (const binding of bindings) {
    const parsed = parseCombo(binding);
    map.set(parsed.combo, parsed);
  }

  bindingMapCache.set(bindings, map);
  return map;
}

function detectMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /mac/i.test(navigator.platform);
}

export function dispatchHotkeyKeyboardEvent(params: {
  event: HotkeyKeyEvent;
  bindings: HotkeyBinding[];
  handlers: HotkeyHandlers;
  context: Omit<HotkeyContext, 'isComposing' | 'isEditableTarget'>;
  isEditableTargetOverride?: boolean;
  isMac?: boolean;
}): HotkeyDispatchResult {
  const { event, bindings, handlers } = params;

  if (event.repeat) {
    return { matched: false, dispatched: false };
  }

  const bindingMap = resolveBindingMap(bindings);
  const combo = eventToCanonicalCombo(event, params.isMac ?? detectMacPlatform());
  if (!combo) {
    return { matched: false, dispatched: false };
  }

  const parsed = bindingMap.get(combo);
  if (!parsed) {
    return { matched: false, dispatched: false };
  }

  const context: HotkeyContext = {
    ...params.context,
    isComposing: event.isComposing ?? false,
    isEditableTarget: params.isEditableTargetOverride ?? isEditableElement(event.target)
  };

  if (context.isComposing) {
    return { matched: true, dispatched: false, command: parsed.command };
  }

  if (context.isEditableTarget && !parsed.allowInEditable) {
    return { matched: true, dispatched: false, command: parsed.command };
  }

  if (!isCommandAllowedInContext(parsed.command, context)) {
    return { matched: true, dispatched: false, command: parsed.command };
  }

  const dispatched = dispatchCommand(parsed.command, 'keyboard', handlers);
  if (dispatched) {
    event.preventDefault();
  }

  return {
    matched: true,
    dispatched,
    command: parsed.command
  };
}

export function dispatchHotkeyMenuCommand(params: {
  command: HotkeyCommandId;
  handlers: HotkeyHandlers;
  context: Omit<HotkeyContext, 'isComposing' | 'isEditableTarget'>;
}): boolean {
  const context: HotkeyContext = {
    ...params.context,
    isComposing: false,
    isEditableTarget: false
  };

  if (!isCommandAllowedInContext(params.command, context)) {
    return false;
  }

  return dispatchCommand(params.command, 'menu', params.handlers);
}

export function getCanonicalComboForTest(combo: string): string {
  return parseCombo({ command: 'app.openFolder', combo }).combo;
}

export function getEventComboForTest(event: HotkeyKeyEvent, isMac: boolean): string | null {
  return eventToCanonicalCombo(event, isMac);
}

export function isEditableTargetForTest(target: EventTarget | null): boolean {
  return isEditableElement(target);
}
