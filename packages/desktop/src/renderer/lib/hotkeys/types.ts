export type HotkeyCommandId =
  | 'app.openFolder'
  | 'app.openSettings'
  | 'editor.saveActiveFile'
  | 'editor.formatActiveFile'
  | 'chat.newSession'
  | 'chat.toggleAgentMode'
  | 'arduino.compile'
  | 'arduino.upload';

export type HotkeySource = 'keyboard' | 'menu';

export type HotkeyBinding = {
  command: HotkeyCommandId;
  combo: string;
  allowInEditable?: boolean;
};

export type HotkeyContext = {
  settingsModalOpen: boolean;
  navbarOverlayOpen: boolean;
  hasActiveWorkspace: boolean;
  agentBusy: boolean;
  sessionBusy: boolean;
  isComposing: boolean;
  isEditableTarget: boolean;
};

export type HotkeyDispatchMeta = {
  command: HotkeyCommandId;
  source: HotkeySource;
};

export type HotkeyHandler = (meta: HotkeyDispatchMeta) => void | Promise<void>;

export type HotkeyHandlers = Partial<Record<HotkeyCommandId, HotkeyHandler>>;

export type HotkeyKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  isComposing?: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
};

export type HotkeyDispatchResult = {
  matched: boolean;
  dispatched: boolean;
  command?: HotkeyCommandId;
};
