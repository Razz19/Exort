<script lang="ts">
  import * as monaco from 'monaco-editor';
  import { onMount } from 'svelte';
  import type { MonacoThemeId } from '../../lib/state/types';
  import { languageFromFile, registerMonacoThemes } from '../../lib/monacoThemes';

  let { filePath, original, modified, monacoTheme } = $props<{
    filePath: string;
    original: string;
    modified: string;
    monacoTheme: MonacoThemeId;
  }>();

  let container = $state<HTMLDivElement | null>(null);
  let diffEditor = $state<monaco.editor.IStandaloneDiffEditor | null>(null);
  let originalModel: monaco.editor.ITextModel | null = null;
  let modifiedModel: monaco.editor.ITextModel | null = null;

  function disposeModels(): void {
    originalModel?.dispose();
    modifiedModel?.dispose();
    originalModel = null;
    modifiedModel = null;
  }

  onMount(() => {
    if (!container) return;
    registerMonacoThemes();

    diffEditor = monaco.editor.createDiffEditor(container, {
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: false,
      minimap: { enabled: false },
      theme: monacoTheme,
      fontSize: 14,
      // Keep the diff gutter minimal: single tight line-number column, no glyph/fold margins,
      // no revert arrows or overview ruler.
      renderOverviewRuler: false,
      ignoreTrimWhitespace: false,
      renderMarginRevertIcon: false,
      renderIndicators: false,
      glyphMargin: false,
      folding: false,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 6,
      overviewRulerLanes: 0,
      renderLineHighlight: 'none',
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 }
    });

    return () => {
      diffEditor?.dispose();
      diffEditor = null;
      disposeModels();
    };
  });

  $effect(() => {
    if (!diffEditor) return;
    const language = languageFromFile(filePath);

    disposeModels();
    originalModel = monaco.editor.createModel(original, language);
    modifiedModel = monaco.editor.createModel(modified, language);
    diffEditor.setModel({ original: originalModel, modified: modifiedModel });
  });

  $effect(() => {
    if (!diffEditor) return;
    monaco.editor.setTheme(monacoTheme);
  });
</script>

<div class="h-full w-full" data-allow-text-selection="true" bind:this={container}></div>
