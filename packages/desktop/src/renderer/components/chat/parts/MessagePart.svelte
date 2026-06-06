<script lang="ts">
  import type { AgentStep } from "../../../lib/types";
  import { normalizeToolName } from "../tools/toolData";
  import ToolArduinoCompile from "../tools/ToolArduinoCompile.svelte";
  import ToolBash from "../tools/ToolBash.svelte";
  import ToolEdit from "../tools/ToolEdit.svelte";
  import ToolGeneric from "../tools/ToolGeneric.svelte";
  import ToolGlob from "../tools/ToolGlob.svelte";
  import ToolGrep from "../tools/ToolGrep.svelte";
  import ToolList from "../tools/ToolList.svelte";
  import ToolQuestion from "../tools/ToolQuestion.svelte";
  import ToolPlatformioCompile from "../tools/ToolPlatformioCompile.svelte";
  import ToolRead from "../tools/ToolRead.svelte";
  import ToolTask from "../tools/ToolTask.svelte";
  import ToolTodoWrite from "../tools/ToolTodoWrite.svelte";
  import ToolWebfetch from "../tools/ToolWebfetch.svelte";
  import ToolWrite from "../tools/ToolWrite.svelte";

  let { step, workspaceRoot = null, onOpenFile } = $props<{
    step: AgentStep;
    workspaceRoot?: string | null;
    onOpenFile?: (filePath: string) => Promise<void> | void;
  }>();

  let toolName = $derived(normalizeToolName(step.toolName));
</script>

{#if toolName === "read"}
  <ToolRead {step} />
{:else if toolName === "list"}
  <ToolList {step} />
{:else if toolName === "glob"}
  <ToolGlob {step} />
{:else if toolName === "grep"}
  <ToolGrep {step} />
{:else if toolName === "webfetch"}
  <ToolWebfetch {step} />
{:else if toolName === "task"}
  <ToolTask {step} />
{:else if toolName === "bash"}
  <ToolBash {step} />
{:else if toolName === "edit" || toolName === "apply_patch"}
  <ToolEdit {step} {workspaceRoot} {onOpenFile} />
{:else if toolName === "write"}
  <ToolWrite {step} />
{:else if toolName === "todowrite" || toolName === "todoread"}
  <ToolTodoWrite {step} />
{:else if toolName === "question"}
  <ToolQuestion {step} />
{:else if toolName === "arduinocompile"}
  <ToolArduinoCompile {step} />
{:else if toolName === "platformiocompile"}
  <ToolPlatformioCompile {step} />
{:else}
  <ToolGeneric {step} />
{/if}
