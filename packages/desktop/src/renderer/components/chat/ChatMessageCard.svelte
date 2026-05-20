<script lang="ts">
  import { onDestroy } from "svelte";
  import { Copy, CopyCheck, FileText } from "lucide-svelte";

  import type {
    AgentPermissionReply,
    AgentStep,
    ChatItem,
  } from "../../lib/types";
  import { formatChatTime } from "./chatDate";
  import { renderMarkdown } from "./chatMarkdown";
  import ChatStepCard from "./ChatStepCard.svelte";
  import ChangedFilesCard from "./ChangedFilesCard.svelte";

  let {
    message,
    showReasoning = false,
    workspaceRoot = null,
    busy = false,
    onUndoChangedFiles,
    onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } = $props<{
    message: ChatItem;
    showReasoning?: boolean;
    workspaceRoot?: string | null;
    busy?: boolean;
    onUndoChangedFiles?: (
      files: string[],
      messageId: string,
    ) => Promise<void> | void;
    onPermissionReply?: (
      requestId: string,
      reply: AgentPermissionReply,
    ) => Promise<void> | void;
    onQuestionReply?: (
      requestId: string,
      answers: string[][],
    ) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
  }>();

  let showPlanningFull = $state(false);
  let copied = $state(false);
  let copyResetTimer = $state<number | null>(null);
  let lastMessageId = $state<string | null>(null);

  let isUser = $derived(message.role === "user");
  let isAssistant = $derived(message.role === "assistant");
  let createdAtLabel = $derived(formatChatTime(message.createdAt));
  const HIDDEN_TOOL_NAMES = new Set(["search", "glob", "grep"]);

  function parseHiddenToolName(step: AgentStep): string | null {
    if (step.kind !== "tool") return null;
    const raw = step.toolName?.trim().toLowerCase();
    if (!raw) return null;
    if (HIDDEN_TOOL_NAMES.has(raw)) return raw;

    const parts = raw.split(/[.:/]/g);
    const suffix = parts[parts.length - 1];
    if (suffix && HIDDEN_TOOL_NAMES.has(suffix)) return suffix;
    return null;
  }

  function shouldHideToolStep(step: AgentStep): boolean {
    return parseHiddenToolName(step) !== null;
  }

  let activitySteps = $derived(
    (message.steps ?? []).filter(
      (step) =>
        !shouldHideToolStep(step) &&
        (step.kind === "tool" ||
          step.kind === "task" ||
          step.kind === "status" ||
          step.kind === "error" ||
          step.kind === "permission" ||
          step.kind === "question"),
    ),
  );
  let stepCount = $derived(activitySteps.length);
  type ChangedFileLine = {
    kind: "meta" | "context" | "add" | "remove";
    text: string;
  };
  type ChangedFile = {
    file: string;
    additions: number;
    deletions: number;
    lines: ChangedFileLine[];
    detailsAvailable: boolean;
  };
  type ChangedFilesSummary = {
    files: ChangedFile[];
    totalAdditions: number;
    totalDeletions: number;
  } | null;

  function parseRecord(value: string | undefined): Record<string, unknown> {
    if (!value) return {};
    try {
      const parsed = JSON.parse(value);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore malformed payloads.
    }
    return {};
  }

  function asNonBlankString(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  function classifyLine(line: string): ChangedFileLine["kind"] {
    if (
      line.startsWith("@@ ") ||
      line.startsWith("--- ") ||
      line.startsWith("+++ ")
    )
      return "meta";
    if (line.startsWith("+")) return "add";
    if (line.startsWith("-")) return "remove";
    return "context";
  }

  function parsePatchTextIntoFiles(patchText: string): ChangedFile[] {
    const normalized = patchText.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const result: ChangedFile[] = [];
    let current: ChangedFile | null = null;

    const flushCurrent = () => {
      if (!current) return;
      current.detailsAvailable = current.lines.length > 0;
      result.push(current);
      current = null;
    };

    for (const raw of lines) {
      const line = raw ?? "";
      const updateMatch = line.match(
        /^\*\*\* (?:Update|Add|Delete) File:\s+(.+)$/,
      );
      if (updateMatch?.[1]) {
        flushCurrent();
        current = {
          file: updateMatch[1].trim(),
          additions: 0,
          deletions: 0,
          lines: [],
          detailsAvailable: false,
        };
        continue;
      }

      const diffGitMatch = line.match(/^diff --git a\/(.+)\s+b\/(.+)$/);
      if (diffGitMatch?.[2]) {
        flushCurrent();
        current = {
          file: diffGitMatch[2].trim(),
          additions: 0,
          deletions: 0,
          lines: [],
          detailsAvailable: false,
        };
        continue;
      }

      const gitFileMatch = line.match(/^(?:\+\+\+\s+b\/|---\s+a\/)(.+)$/);
      if (gitFileMatch?.[1] && !current) {
        current = {
          file: gitFileMatch[1].trim(),
          additions: 0,
          deletions: 0,
          lines: [],
          detailsAvailable: false,
        };
      }

      if (!current) continue;
      if (!line) continue;
      if (
        line.startsWith("*** Begin Patch") ||
        line.startsWith("*** End Patch")
      )
        continue;
      if (line.startsWith("*** End of File")) continue;

      const kind = classifyLine(line);
      current.lines.push({ kind, text: line });
      if (kind === "add") current.additions += 1;
      if (kind === "remove") current.deletions += 1;
    }

    flushCurrent();
    return result;
  }

  function parsePatchTextForKnownFile(
    patchText: string,
    filePath: string,
  ): ChangedFile | null {
    const normalized = patchText.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const parsedLines: ChangedFileLine[] = [];
    let additions = 0;
    let deletions = 0;

    for (const raw of lines) {
      const line = raw ?? "";
      if (!line) continue;
      if (
        line.startsWith("*** Begin Patch") ||
        line.startsWith("*** End Patch")
      )
        continue;
      if (
        line.startsWith("*** Update File:") ||
        line.startsWith("*** Add File:") ||
        line.startsWith("*** Delete File:")
      )
        continue;
      if (line.startsWith("*** End of File")) continue;
      if (
        line.startsWith("@@") ||
        line.startsWith("diff --git") ||
        line.startsWith("--- ") ||
        line.startsWith("+++ ") ||
        line.startsWith("+") ||
        line.startsWith("-") ||
        line.startsWith(" ")
      ) {
        const kind = classifyLine(line);
        parsedLines.push({ kind, text: line });
        if (kind === "add") additions += 1;
        if (kind === "remove") deletions += 1;
      }
    }

    if (parsedLines.length === 0) return null;
    return {
      file: filePath,
      additions,
      deletions,
      lines: parsedLines,
      detailsAvailable: true,
    };
  }

  function collectStringValues(value: unknown, out: string[], depth = 0): void {
    if (depth > 5) return;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out.push(trimmed);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collectStringValues(item, out, depth + 1);
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const entry of Object.values(value as Record<string, unknown>)) {
        collectStringValues(entry, out, depth + 1);
      }
    }
  }

  function extractPatchCandidates(values: string[]): string[] {
    return values.filter(
      (value) =>
        value.includes("*** Begin Patch") ||
        value.includes("\n@@ ") ||
        value.includes("diff --git a/") ||
        value.includes("\n+++ b/") ||
        value.includes("\n--- a/"),
    );
  }

  function extractFilesFromText(text: string): string[] {
    const files = new Set<string>();
    const pattern = /([A-Za-z0-9._/-]+\.[A-Za-z0-9_+-]+)/g;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) files.add(match[1]);
    }
    return [...files];
  }

  function buildChangedFilesSummary(
    steps: AgentStep[],
    assistantText: string,
  ): ChangedFilesSummary {
    const byFile = new Map<string, ChangedFile>();
    let sawMutatingTool = false;

    const upsertFile = (file: string, partial?: Partial<ChangedFile>) => {
      const existing = byFile.get(file);
      if (!existing) {
        byFile.set(file, {
          file,
          additions: partial?.additions ?? 0,
          deletions: partial?.deletions ?? 0,
          lines: partial?.lines ?? [],
          detailsAvailable: partial?.detailsAvailable ?? false,
        });
        return;
      }
      existing.additions = partial?.additions ?? existing.additions;
      existing.deletions = partial?.deletions ?? existing.deletions;
      if ((partial?.lines?.length ?? 0) > 0) {
        existing.lines = partial?.lines ?? existing.lines;
      }
      existing.detailsAvailable =
        partial?.detailsAvailable ?? existing.detailsAvailable;
    };

    for (const step of steps) {
      if (step.kind !== "tool") continue;
      const toolName = step.toolName?.trim().toLowerCase() ?? "";
      if (
        toolName !== "apply_patch" &&
        toolName !== "edit" &&
        toolName !== "write"
      )
        continue;
      sawMutatingTool = true;

      const rawInput = step.toolInput ?? "";
      const rawOutput = step.toolOutput ?? "";
      const input = parseRecord(rawInput);
      const output = parseRecord(rawOutput);
      const allStrings: string[] = [];
      collectStringValues(input, allStrings);
      collectStringValues(output, allStrings);
      collectStringValues(rawInput, allStrings);
      collectStringValues(rawOutput, allStrings);

      const directPath =
        asNonBlankString(input.filePath) ??
        asNonBlankString(input.path) ??
        asNonBlankString(output.filePath) ??
        asNonBlankString(output.path);
      if (directPath) upsertFile(directPath);

      const patchCandidates = extractPatchCandidates(allStrings);
      for (const rawPatchText of patchCandidates) {
        const patchText =
          rawPatchText.includes("\\n") && !rawPatchText.includes("\n")
            ? rawPatchText.replace(/\\n/g, "\n")
            : rawPatchText;
        const parsedFiles = parsePatchTextIntoFiles(patchText);
        if (parsedFiles.length > 0) {
          for (const file of parsedFiles) {
            upsertFile(file.file, file);
          }
          continue;
        }
        if (directPath) {
          const single = parsePatchTextForKnownFile(patchText, directPath);
          if (single) {
            upsertFile(single.file, single);
          }
        }
      }
    }

    if (byFile.size === 0 && sawMutatingTool) {
      for (const file of extractFilesFromText(assistantText)) {
        upsertFile(file);
      }
    }

    const files = [...byFile.values()];
    if (files.length === 0) return null;
    const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
    const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);
    return {
      files,
      totalAdditions,
      totalDeletions,
    };
  }

  let changedFilesSummary = $derived.by(() =>
    isAssistant
      ? buildChangedFilesSummary(activitySteps, message.content)
      : null,
  );
  let userAttachments = $derived(isUser ? (message.attachments ?? []) : []);
  let structuredAssistantContentParts = $derived(
    isAssistant
      ? (message.assistantContentParts ?? []).filter(
          (part) => part.text.trim().length > 0,
        )
      : [],
  );
  let orderedAssistantParts = $derived(
    isAssistant ? (message.assistantParts ?? []) : [],
  );
  let lastToolPartIndex = $derived.by(() => {
    for (let index = orderedAssistantParts.length - 1; index >= 0; index -= 1) {
      if (orderedAssistantParts[index]?.type === "tool") return index;
    }
    return -1;
  });
  let answerPartCandidate = $derived.by(() => {
    if (!isAssistant || stepCount === 0 || lastToolPartIndex < 0) return null;
    const textParts = orderedAssistantParts
      .slice(lastToolPartIndex + 1)
      .filter(
        (
          part,
        ): part is Extract<
          NonNullable<ChatItem["assistantParts"]>[number],
          { type: "text" }
        > => part.type === "text" && part.text.trim().length > 0,
      );
    return textParts[textParts.length - 1] ?? null;
  });
  let fallbackAnswerText = $derived.by(() => {
    if (!isAssistant || stepCount === 0 || answerPartCandidate) return "";
    const steps = activitySteps;
    const lastStep = steps[steps.length - 1];
    if (
      !lastStep ||
      lastStep.kind !== "tool" ||
      lastStep.status === "running"
    ) {
      return "";
    }
    if (
      typeof lastStep.contentEnd !== "number" ||
      !Number.isFinite(lastStep.contentEnd)
    ) {
      return "";
    }
    const start = Math.max(
      0,
      Math.min(message.content.length, Math.trunc(lastStep.contentEnd)),
    );
    return message.content.slice(start).trim();
  });
  let answerCandidateId = $derived(
    answerPartCandidate?.id ??
      (fallbackAnswerText ? `${message.id}:fallback-answer` : null),
  );
  let answerCandidateText = $derived(
    answerPartCandidate?.text.trim() ?? fallbackAnswerText,
  );
  let answerPartText = $derived.by(() => {
    if (!answerCandidateId || !answerCandidateText) return "";
    return answerCandidateText;
  });
  let assistantBodyText = $derived.by(() => {
    if (!isAssistant || stepCount > 0) return "";
    if (structuredAssistantContentParts.length > 0) {
      return structuredAssistantContentParts
        .filter((part) => showReasoning || part.kind === "text")
        .map((part) => part.text)
        .join("")
        .trim();
    }
    return message.content.trim();
  });
  let shouldRenderBody = $derived(
    !isAssistant || (stepCount === 0 && assistantBodyText.length > 0),
  );

  function isImageAttachment(attachment: {
    name: string;
    mime: string;
  }): boolean {
    if (attachment.mime.startsWith("image/")) return true;
    return /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(attachment.name);
  }

  function fileUrl(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    const withLeadingSlash = normalized.startsWith("/")
      ? normalized
      : `/${normalized}`;
    const encodedPath = withLeadingSlash
      .split("/")
      .map((segment, index) => {
        if (index === 0) return "";
        if (/^[A-Za-z]:$/.test(segment)) return segment;
        return encodeURIComponent(segment);
      })
      .join("/");
    return `file://${encodedPath}`;
  }

  function attachmentPreviewUrl(attachment: {
    path: string;
    url?: string;
  }): string {
    if (
      attachment.url?.startsWith("data:") ||
      attachment.url?.startsWith("blob:")
    ) {
      return attachment.url;
    }
    return fileUrl(attachment.path);
  }

  $effect(() => {
    if (lastMessageId === message.id) return;
    lastMessageId = message.id;
    showPlanningFull = false;
    copied = false;
  });

  onDestroy(() => {
    if (copyResetTimer) {
      window.clearTimeout(copyResetTimer);
    }
  });

  async function copyMessage(): Promise<void> {
    if (!message.content.trim().length) return;
    try {
      await navigator.clipboard.writeText(message.content);
      copied = true;
      if (copyResetTimer) {
        window.clearTimeout(copyResetTimer);
      }
      copyResetTimer = window.setTimeout(() => {
        copied = false;
      }, 1200);
    } catch {
      copied = false;
    }
  }
</script>

<div
  class={`${isUser ? "group my-7 relative ml-auto flex w-fit max-w-[calc(100%-2rem)] flex-col items-end gap-2" : "px-2 py-2"}`}
>
  {#if !isUser}
    <div class="mb-2 flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <!-- <span
          class={`h-2 w-2 rounded-full ${isUser ? "bg-dark-blue2" : "bg-dark-aqua2"}`}
        ></span> -->
        <!-- <span class="text-xs font-medium uppercase tracking-wide text-dark-fg3">
          {isUser ? "You" : "Exort"}
        </span> -->
        {#if createdAtLabel}
          <span class="text-[11px] text-dark-fg4">{createdAtLabel}</span>
        {/if}
      </div>

      {#if isAssistant}
        <div class="flex items-center gap-1"></div>
      {/if}
    </div>
  {/if}

  {#if isAssistant && stepCount > 0}
    <div class="space-y-2">
      {#each activitySteps as step (step.id)}
        <ChatStepCard
          {step}
          content=""
          {workspaceRoot}
          {onPermissionReply}
          {onQuestionReply}
          {onQuestionReject}
        />
      {/each}
    </div>
  {/if}

  {#if isAssistant && stepCount > 0 && showReasoning}
    {#each orderedAssistantParts as part (part.id)}
      {#if part.type !== "tool" && part.text.trim().length > 0}
        <div
          class={`chat-markdown allow-text-selection mt-2 font-thin ${part.type === "reasoning" ? "chat-markdown-planning" : ""}`}
        >
          {@html renderMarkdown(part.text)}
        </div>
      {/if}
    {/each}
  {/if}

  {#if isAssistant && stepCount > 0 && !showReasoning && answerPartText}
    <div class="chat-markdown allow-text-selection mt-2 font-thin">
      {@html renderMarkdown(answerPartText)}
    </div>
  {/if}

  {#if shouldRenderBody && isAssistant}
    <div class="chat-markdown allow-text-selection font-thin">
      {@html renderMarkdown(assistantBodyText)}
    </div>
  {/if}

  {#if isAssistant && changedFilesSummary}
    <div class="mt-3">
      <ChangedFilesCard
        summary={changedFilesSummary}
        {workspaceRoot}
        {busy}
        onUndoAll={onUndoChangedFiles
          ? (files) => onUndoChangedFiles(files, message.id)
          : undefined}
      />
    </div>
  {/if}

  {#if isUser}
    {#if userAttachments.length > 0}
      <div class="flex max-w-full flex-wrap justify-end gap-2 self-end">
        {#each userAttachments as attachment (attachment.id)}
          <div
            class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dark-border bg-dark-bgS p-1 text-dark-fg3"
            title={attachment.name}
            aria-label={attachment.name}
          >
            {#if isImageAttachment(attachment)}
              <img
                class="h-7 w-7 rounded object-cover"
                src={attachmentPreviewUrl(attachment)}
                alt={attachment.name}
              />
            {:else}
              <span
                class="inline-flex h-7 w-7 items-center justify-center rounded bg-dark-bg1"
                aria-hidden="true"
              >
                <FileText class="h-4 w-4" />
              </span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <p
      class="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl bg-dark-bg1 px-4 py-2 text-sm font-thin leading-1 text-dark-fg0"
    >
      {message.content}
    </p>
  {/if}
  {#if isUser}
    <button
      class={`absolute right-0 top-full mt-1 inline-flex h-7 w-7 items-center
       justify-center rounded opacity-0 transition-opacity duration-150 
       disabled:cursor-not-allowed disabled:opacity-40 group-hover:opacity-100 
       focus-visible:opacity-100 ${copied ? "text-dark-fg1" : "text-dark-fg3 hover:text-dark-fg1 focus-visible:text-dark-fg1"}`}
      onclick={copyMessage}
      disabled={!message.content.trim().length}
      aria-label={copied ? "Copied prompt" : "Copy prompt"}
      title={copied ? "Copied" : "Copy"}
    >
      {#if copied}
        <CopyCheck class="h-4 w-4" />
      {:else}
        <Copy class="h-4 w-4" />
      {/if}
    </button>
  {/if}
</div>
