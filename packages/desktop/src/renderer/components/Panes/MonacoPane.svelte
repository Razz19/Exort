<script lang="ts">
  import * as monaco from 'monaco-editor';
  import { onMount } from 'svelte';
  import type { MonacoThemeId } from '../../lib/state/types';

  let {
    filePath,
    value,
    readonly,
    monacoTheme,
    onChange,
    onSave
  } = $props<{
    filePath: string | null;
    value: string;
    readonly: boolean;
    monacoTheme: MonacoThemeId;
    onChange: (content: string) => void;
    onSave: () => void;
  }>();

  let container = $state<HTMLDivElement | null>(null);
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null);
  let lastSyncedValue = '';
  let customThemesRegistered = false;

  const ARDUINO_DARK_THEME: monaco.editor.IStandaloneThemeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "d9e1e8" },
      { token: "comment", foreground: "7d8c9a", fontStyle: "italic" },
      { token: "keyword", foreground: "e47128" },
      { token: "keyword.control", foreground: "e47128" },
      { token: "string", foreground: "62aeb2" },
      { token: "number", foreground: "e5ad24" },
      { token: "constant", foreground: "e5ad24" },
      { token: "type", foreground: "4ec0c6" },
      { token: "type.identifier", foreground: "4ec0c6" },
      { token: "function", foreground: "8fd4d8" },
      { token: "entity.name.function", foreground: "8fd4d8" },
      { token: "operator", foreground: "c8d2db" },
      { token: "delimiter", foreground: "9fb0be" },
      { token: "variable", foreground: "d9e1e8" },
      { token: "variable.parameter", foreground: "d9e1e8" },
    ],
    colors: {
      "editor.background": "#1f252c",
      "editor.foreground": "#d9e1e8",
      "editorLineNumber.foreground": "#4e616f",
      "editorLineNumber.activeForeground": "#93a6b4",
      "editorCursor.foreground": "#00979c",
      "editor.selectionBackground": "#2f3f4b",
      "editor.inactiveSelectionBackground": "#273640",
      "editor.lineHighlightBackground": "#262f37",
      "editorIndentGuide.background1": "#33414d",
      "editorIndentGuide.activeBackground1": "#4d6172",
      "editorGutter.background": "#1f252c",
      "editor.findMatchBackground": "#00979c77",
      "editor.findMatchHighlightBackground": "#00979c33",
    },
  };

  const GRUVBOX_DARK_THEME: monaco.editor.IStandaloneThemeData = {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "", foreground: "ebdbb2" },
      { token: "comment", foreground: "928374", fontStyle: "italic" },
      { token: "keyword", foreground: "fb4934" },
      { token: "keyword.control", foreground: "fb4934" },
      { token: "string", foreground: "b8bb26" },
      { token: "number", foreground: "d3869b" },
      { token: "constant", foreground: "d3869b" },
      { token: "type", foreground: "fabd2f" },
      { token: "type.identifier", foreground: "fabd2f" },
      { token: "function", foreground: "83a598" },
      { token: "entity.name.function", foreground: "83a598" },
      { token: "variable", foreground: "ebdbb2" },
      { token: "variable.parameter", foreground: "ebdbb2" },
      { token: "operator", foreground: "fe8019" },
      { token: "delimiter", foreground: "a89984" },
    ],
    colors: {
      "editor.background": "#282828",
      "editor.foreground": "#ebdbb2",
      "editorLineNumber.foreground": "#665c54",
      "editorLineNumber.activeForeground": "#a89984",
      "editorCursor.foreground": "#fabd2f",
      "editor.selectionBackground": "#504945",
      "editor.inactiveSelectionBackground": "#3c3836",
      "editor.lineHighlightBackground": "#32302f",
      "editorIndentGuide.background1": "#504945",
      "editorIndentGuide.activeBackground1": "#7c6f64",
      "editorGutter.background": "#282828",
      "editor.findMatchBackground": "#d7992190",
      "editor.findMatchHighlightBackground": "#d7992144",
    },
  };

  function languageFromFile(file: string | null): string {
    if (!file) return 'plaintext';

    const normalized = file.toLowerCase();
    const segments = normalized.split(/[\\/]/);
    const baseName = segments[segments.length - 1] ?? normalized;

    if (baseName === 'makefile') return 'makefile';
    if (baseName === 'dockerfile') return 'dockerfile';
    if (baseName === 'cmakelists.txt' || baseName.endsWith('.cmake')) return 'cmake';
    if (baseName === '.gitignore' || baseName === '.dockerignore') return 'ignore';
    if (baseName === '.editorconfig' || baseName.endsWith('.ini') || baseName.endsWith('.cfg') || baseName.endsWith('.conf')) {
      return 'ini';
    }

    if (normalized.endsWith('.ts') || normalized.endsWith('.mts') || normalized.endsWith('.cts')) return 'typescript';
    if (normalized.endsWith('.tsx')) return 'typescript';
    if (normalized.endsWith('.js') || normalized.endsWith('.mjs') || normalized.endsWith('.cjs')) return 'javascript';
    if (normalized.endsWith('.jsx')) return 'javascript';
    if (normalized.endsWith('.json')) return 'json';
    if (normalized.endsWith('.md') || normalized.endsWith('.mdx')) return 'markdown';
    if (normalized.endsWith('.svelte')) return 'html';
    if (normalized.endsWith('.html') || normalized.endsWith('.htm')) return 'html';
    if (normalized.endsWith('.css') || normalized.endsWith('.scss') || normalized.endsWith('.less')) return 'css';
    if (normalized.endsWith('.yml') || normalized.endsWith('.yaml')) return 'yaml';
    if (normalized.endsWith('.toml')) return 'toml';
    if (normalized.endsWith('.xml') || normalized.endsWith('.svg')) return 'xml';
    if (normalized.endsWith('.sh') || normalized.endsWith('.bash') || normalized.endsWith('.zsh')) return 'shell';
    if (normalized.endsWith('.py')) return 'python';
    if (normalized.endsWith('.sql')) return 'sql';
    if (
      normalized.endsWith('.c') ||
      normalized.endsWith('.cc') ||
      normalized.endsWith('.cpp') ||
      normalized.endsWith('.cxx') ||
      normalized.endsWith('.ino') ||
      normalized.endsWith('.h') ||
      normalized.endsWith('.hh') ||
      normalized.endsWith('.hpp') ||
      normalized.endsWith('.hxx') ||
      normalized.endsWith('.ipp')
    ) {
      return 'cpp';
    }

    return 'plaintext';
  }

  function ensureCustomThemes(): void {
    if (customThemesRegistered) return;
    monaco.editor.defineTheme("arduino-dark", ARDUINO_DARK_THEME);
    monaco.editor.defineTheme("gruvbox-dark", GRUVBOX_DARK_THEME);
    customThemesRegistered = true;
  }

  onMount(() => {
    if (!container) return;
    ensureCustomThemes();

    editor = monaco.editor.create(container, {
      value,
      language: languageFromFile(filePath),
      automaticLayout: true,
      minimap: { enabled: false },
      theme: monacoTheme,
      fontSize: 14,
      readOnly: readonly
    });

    lastSyncedValue = value;

    const changeDisposable = editor.onDidChangeModelContent(() => {
      const current = editor?.getValue() ?? '';
      if (current !== lastSyncedValue) {
        lastSyncedValue = current;
        onChange(current);
      }
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    return () => {
      changeDisposable.dispose();
      editor?.dispose();
    };
  });

  $effect(() => {
    if (!editor) return;
    monaco.editor.setTheme(monacoTheme);

    const model = editor.getModel();
    if (!model) return;

    monaco.editor.setModelLanguage(model, languageFromFile(filePath));
    editor.updateOptions({ readOnly: readonly });

    const current = editor.getValue();
    if (value !== current) {
      lastSyncedValue = value;
      editor.setValue(value);
    }
  });
</script>

<div
  class="h-full w-full"
  data-allow-text-selection="true"
  bind:this={container}
></div>
