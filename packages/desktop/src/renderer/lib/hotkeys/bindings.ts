import type { HotkeyBinding } from './types';

export const DEFAULT_HOTKEY_BINDINGS: HotkeyBinding[] = [
  {
    command: 'editor.saveActiveFile',
    combo: 'mod+s',
    allowInEditable: true
  },
  {
    command: 'app.openSettings',
    combo: 'mod+comma'
  },
  {
    command: 'app.openFolder',
    combo: 'mod+o'
  },
  {
    command: 'chat.newSession',
    combo: 'mod+shift+n'
  },
  {
    command: 'arduino.compile',
    combo: 'mod+shift+b'
  },
  {
    command: 'arduino.upload',
    combo: 'mod+u'
  }
];
