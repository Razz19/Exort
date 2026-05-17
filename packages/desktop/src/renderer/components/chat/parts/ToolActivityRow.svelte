<script lang="ts">
  import {
    Activity,
    Code,
    ExternalLink,
    FileText,
    Hammer,
    Search,
    Terminal,
  } from "lucide-svelte";
  import type { Component } from "svelte";
  import type { AgentStep } from "../../../lib/types";
  import {
    inputValue,
    normalizeToolName,
    parseToolInput,
  } from "../tools/toolData";

  type Summary = {
    icon: Component;
    label: string;
    target: string | null;
    args: string[];
  };

  let {
    step,
    workspaceRoot = null,
  } = $props<{
    step: AgentStep;
    workspaceRoot?: string | null;
  }>();

  let summary = $derived(buildSummary(step, workspaceRoot));
  let RowIcon = $derived(summary.icon);
  let titleText = $derived(
    [summary.label, summary.target, ...summary.args].filter(Boolean).join(" "),
  );
  let statusText = $derived.by(() => {
    if (step.status === "running") return "Running";
    if (step.status === "error") return "Failed";
    return "";
  });
  let statusClass = $derived.by(() => {
    if (step.status === "running") return "text-dark-yellow";
    if (step.status === "error") return "text-dark-red2";
    return "text-dark-fg3";
  });

  function normalizePath(value: string): string {
    return value.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function displayPath(value: string | null, root: string | null): string | null {
    if (!value) return null;
    const normalizedValue = normalizePath(value);
    const normalizedRoot = root ? normalizePath(root).replace(/\/$/, "") : "";
    if (!normalizedRoot) return normalizedValue;
    if (normalizedValue === normalizedRoot) return ".";
    const prefix = `${normalizedRoot}/`;
    if (normalizedValue.startsWith(prefix)) {
      return normalizedValue.slice(prefix.length);
    }
    return normalizedValue;
  }

  function compact(value: string | null, maxLength = 96): string | null {
    if (!value) return null;
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    return normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
      : normalized;
  }

  function firstInputValue(
    input: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = inputValue(input, key);
      if (value) return value;
    }
    return null;
  }

  function buildSummary(currentStep: AgentStep, root: string | null): Summary {
    const toolName = normalizeToolName(currentStep.toolName);
    const input = parseToolInput(currentStep.toolInput);

    if (toolName === "read") {
      return {
        icon: FileText,
        label: "Read File",
        target: displayPath(firstInputValue(input, ["filePath", "path"]), root),
        args: [],
      };
    }

    if (toolName === "glob") {
      return {
        icon: Search,
        label: "Glob",
        target: displayPath(firstInputValue(input, ["path", "cwd"]), root),
        args: [compact(firstInputValue(input, ["pattern"]))].filter(
          (item): item is string => !!item,
        ),
      };
    }

    if (toolName === "grep") {
      return {
        icon: Search,
        label: "Search",
        target: displayPath(firstInputValue(input, ["path", "cwd"]), root),
        args: [compact(firstInputValue(input, ["pattern", "query"]))].filter(
          (item): item is string => !!item,
        ),
      };
    }

    if (toolName === "list") {
      return {
        icon: Search,
        label: "List",
        target: displayPath(firstInputValue(input, ["path", "cwd"]), root),
        args: [],
      };
    }

    if (toolName === "webfetch") {
      return {
        icon: ExternalLink,
        label: "Fetch",
        target: compact(firstInputValue(input, ["url", "URL"]), 120),
        args: [],
      };
    }

    if (toolName === "bash") {
      return {
        icon: Terminal,
        label: "Shell",
        target: compact(firstInputValue(input, ["command", "cmd"]), 120),
        args: [],
      };
    }

    if (toolName === "edit" || toolName === "write" || toolName === "apply_patch") {
      return {
        icon: Code,
        label:
          toolName === "write"
            ? "Write File"
            : toolName === "apply_patch"
              ? "Apply Patch"
              : "Edit File",
        target: displayPath(firstInputValue(input, ["filePath", "path"]), root),
        args: [],
      };
    }

    if (toolName === "todowrite" || toolName === "todoread") {
      return {
        icon: Activity,
        label: toolName === "todowrite" ? "Update Todos" : "Read Todos",
        target: null,
        args: [],
      };
    }

    return {
      icon: Hammer,
      label: currentStep.toolName?.trim() || "Tool",
      target: compact(
        firstInputValue(input, [
          "filePath",
          "path",
          "url",
          "command",
          "pattern",
          "description",
        ]),
      ),
      args: [],
    };
  }
</script>

<div
  class="flex min-w-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left"
  title={titleText}
>
  <RowIcon class="h-4 w-4 shrink-0 text-dark-fg3" />
  <span class="shrink-0 text-sm font-medium text-dark-fg1">{summary.label}</span>
  {#if summary.target}
    <span class="min-w-0 truncate text-sm text-dark-fg3">{summary.target}</span>
  {/if}
  {#each summary.args as arg (`arg:${arg}`)}
    <span
      class="max-w-44 truncate rounded border border-dark-border bg-dark-bgS px-1.5 py-0.5 text-[10px] text-dark-fg3"
    >
      {arg}
    </span>
  {/each}
  {#if statusText}
    <span class={`ml-auto shrink-0 text-[11px] ${statusClass}`}>{statusText}</span>
  {/if}
</div>
