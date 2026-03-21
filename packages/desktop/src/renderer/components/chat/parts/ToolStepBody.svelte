<script lang="ts">
  import type { AgentStep } from "../../../lib/types";
  import { renderMarkdown } from "../chatMarkdown";

  let { step } = $props<{
    step: AgentStep;
  }>();

  type ToolInputRecord = Record<string, unknown>;

  function asRecord(value: unknown): ToolInputRecord {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return {};
    }
    return value as ToolInputRecord;
  }

  function parseInput(input: string | undefined): ToolInputRecord {
    if (!input) return {};
    try {
      return asRecord(JSON.parse(input));
    } catch {
      return {};
    }
  }

  function normalizeToolName(value: AgentStep["toolName"]): string {
    if (!value) return "";
    return value.trim().toLowerCase();
  }

  function asLabelValue(value: unknown): string | null {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  }

  function inputLine(input: ToolInputRecord, key: string): string | null {
    return asLabelValue(input[key]);
  }

  let toolName = $derived(normalizeToolName(step.toolName));
  let input = $derived(parseInput(step.toolInput));
  let output = $derived((step.toolOutput ?? "").trim());
  let fallbackDetail = $derived((step.detail ?? "").trim());
  let bodyText = $derived(output || fallbackDetail);

  let pathValue = $derived.by(() => {
    return (
      inputLine(input, "filePath") ??
      inputLine(input, "path") ??
      inputLine(input, "url")
    );
  });

  let args = $derived.by(() => {
    const next: string[] = [];
    if (toolName === "read") {
      const offset = inputLine(input, "offset");
      const limit = inputLine(input, "limit");
      if (offset) next.push(`offset=${offset}`);
      if (limit) next.push(`limit=${limit}`);
    }

    if (toolName === "glob" || toolName === "grep") {
      const pattern = inputLine(input, "pattern");
      if (pattern) next.push(`pattern=${pattern}`);
    }

    if (toolName === "grep") {
      const include = inputLine(input, "include");
      if (include) next.push(`include=${include}`);
    }

    if (toolName === "webfetch") {
      const format = inputLine(input, "format");
      if (format) next.push(`format=${format}`);
    }

    return next;
  });

  let showStructuredMeta = $derived.by(() => {
    return (
      toolName === "read" ||
      toolName === "list" ||
      toolName === "glob" ||
      toolName === "grep" ||
      toolName === "webfetch"
    );
  });
</script>

<div class="space-y-2">
  {#if showStructuredMeta && (pathValue || args.length > 0)}
    <div class="rounded border border-dark-border bg-dark-bg px-2 py-1.5">
      {#if pathValue}
        <div class="text-[11px] text-dark-fg2">
          <span class="text-dark-fg3">Target:</span>
          <span class="ml-1 break-all">{pathValue}</span>
        </div>
      {/if}
      {#if args.length > 0}
        <div class={`flex flex-wrap gap-1 ${pathValue ? "mt-1" : ""}`}>
          {#each args as arg (`arg:${arg}`)}
            <span class="rounded border border-dark-border bg-dark-bgS px-1.5 py-0.5 text-[10px] text-dark-fg3">
              {arg}
            </span>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if bodyText}
    <div class="chat-markdown rounded border border-dark-border bg-dark-bg px-2.5 py-2">
      {@html renderMarkdown(bodyText)}
    </div>
  {/if}
</div>
