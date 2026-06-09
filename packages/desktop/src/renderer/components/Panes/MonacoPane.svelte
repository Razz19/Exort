<script lang="ts">
  import * as monaco from 'monaco-editor';
  import { onMount } from 'svelte';
  import type { MonacoThemeId } from '../../lib/state/types';
  import { languageFromFile, registerMonacoThemes } from '../../lib/monacoThemes';

  let {
    filePath,
    value,
    readonly,
    monacoTheme,
    onChange,
    onSave,
    onHotkeyActionsChange = () => {}
  } = $props<{
    filePath: string | null;
    value: string;
    readonly: boolean;
    monacoTheme: MonacoThemeId;
    onChange: (content: string) => void;
    onSave: () => void;
    onHotkeyActionsChange: (actions: { format: () => Promise<void> } | null) => void;
  }>();

  let container = $state<HTMLDivElement | null>(null);
  let editor = $state<monaco.editor.IStandaloneCodeEditor | null>(null);
  let lastSyncedValue = '';

  function canFormatWithClangFormatFallback(file: string | null, languageId: string): boolean {
    if (languageId !== "cpp" || !file) return false;

    const normalizedPath = file.toLowerCase();
    return (
      normalizedPath.endsWith(".c") ||
      normalizedPath.endsWith(".cc") ||
      normalizedPath.endsWith(".cpp") ||
      normalizedPath.endsWith(".cxx") ||
      normalizedPath.endsWith(".h") ||
      normalizedPath.endsWith(".hh") ||
      normalizedPath.endsWith(".hpp") ||
      normalizedPath.endsWith(".hxx") ||
      normalizedPath.endsWith(".ino") ||
      normalizedPath.endsWith(".ipp")
    );
  }

  onMount(() => {
    if (!container) return;
    registerMonacoThemes();

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

    onHotkeyActionsChange({
      format: async () => {
        const activeEditor = editor;
        if (!activeEditor) return;

        const model = activeEditor.getModel();
        const languageId = model?.getLanguageId() ?? "unknown";
        const formatAction = activeEditor.getAction('editor.action.formatDocument');
        if (!formatAction) return;

        if (!formatAction.isSupported()) {
          if (canFormatWithClangFormatFallback(filePath, languageId) && model) {
            try {
              const result = await window.electronAPI.formatCodeFile({
                filePath: filePath ?? "",
                content: model.getValue(),
              });

              if (!result.ok || typeof result.formatted !== "string") return;

              if (result.formatted === model.getValue()) return;

              activeEditor.pushUndoStop();
              activeEditor.executeEdits("editor.formatCodeFallback", [
                {
                  range: model.getFullModelRange(),
                  text: result.formatted,
                  forceMoveMarkers: true,
                },
              ]);
              activeEditor.pushUndoStop();
              return;
            } catch {
              return;
            }
          }

          return;
        }

        await formatAction.run();
      }
    });

    return () => {
      onHotkeyActionsChange(null);
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
