export { DEFAULT_HOTKEY_BINDINGS } from './bindings';
export {
  dispatchHotkeyKeyboardEvent,
  dispatchHotkeyMenuCommand,
  getCanonicalComboForTest,
  getEventComboForTest,
  isEditableTargetForTest
} from './hotkeyManager';
export type {
  HotkeyBinding,
  HotkeyCommandId,
  HotkeyContext,
  HotkeyDispatchMeta,
  HotkeyDispatchResult,
  HotkeyHandler,
  HotkeyHandlers,
  HotkeyKeyEvent,
  HotkeySource
} from './types';
