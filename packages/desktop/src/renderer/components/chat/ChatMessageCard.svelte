<script lang="ts">
  import { onDestroy } from "svelte";
  import { Copy, CopyCheck, FileText, MessageCircleWarning } from "lucide-svelte";

  import type {
    AgentPermissionReply,
    AgentStep,
    ChatItem,
  } from "../../lib/types";
  import { formatChatTime } from "./chatDate";
  import { renderMarkdown, resolveChatFilePath } from "./chatMarkdown";
  import { findToolTargetFilePath } from "./toolPathTarget";
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
    onOpenFile,
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
    onOpenFile?: (filePath: string) => Promise<void> | void;
  }>();

  let showPlanningFull = $state(false);
  let copied = $state(false);
  let copyResetTimer = $state<number | null>(null);
  let lastMessageId = $state<string | null>(null);

  let isUser = $derived(message.role === "user");
  let isAssistant = $derived(message.role === "assistant");
  let createdAtLabel = $derived(formatChatTime(message.createdAt));
  const HIDDEN_TOOL_NAMES = new Set(["search", "glob", "grep"]);
  const OUTPUT_ERROR_ATTACHMENT_MIME =
    "application/x-exort-output-error-context";
  const EDIT_LIKE_TOOL_NAMES = new Set([
    "edit",
    "multiedit",
    "write",
    "apply_patch",
    "create",
    "file_write",
  ]);

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

  function normalizeToolNameForDisplay(step: AgentStep): string | null {
    if (step.kind !== "tool") return null;
    const raw = step.toolName?.trim().toLowerCase();
    if (!raw) return null;
    const parts = raw.split(/[.:/]/g);
    return parts[parts.length - 1] ?? raw;
  }

  function normalizePathForKey(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  function findStepFilePath(step: AgentStep): string | null {
    if (step.kind !== "tool") return null;
    return findToolTargetFilePath(step);
  }

  function dedupeKeyForStep(step: AgentStep): string | null {
    const toolName = normalizeToolNameForDisplay(step);
    if (!toolName || !EDIT_LIKE_TOOL_NAMES.has(toolName)) return null;
    const rawPath = findStepFilePath(step);
    if (!rawPath) return null;
    const resolvedPath = resolveChatFilePath(rawPath, workspaceRoot);
    const pathKey = normalizePathForKey(resolvedPath ?? rawPath);
    return `edit:${pathKey}`;
  }

  let rawActivitySteps = $derived(
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
  let displayActivitySteps = $derived.by(() => {
    const enriched: AgentStep[] = [];
    let lastKnownFilePath: string | null = null;

    for (const step of rawActivitySteps) {
      if (step.kind !== "tool") {
        enriched.push(step);
        continue;
      }

      const currentPath = findStepFilePath(step);
      if (currentPath) {
        lastKnownFilePath = currentPath;
        enriched.push(step);
        continue;
      }

      const toolName = normalizeToolNameForDisplay(step);
      if (!toolName || !EDIT_LIKE_TOOL_NAMES.has(toolName) || !lastKnownFilePath) {
        enriched.push(step);
        continue;
      }

      const inputRecord = parseRecord(step.toolInput);
      const nextInput = JSON.stringify({
        ...inputRecord,
        filePath: lastKnownFilePath,
      });
      enriched.push({
        ...step,
        toolInput: nextInput,
      });
    }

    return enriched;
  });
  let activitySteps = $derived.by(() => {
    const deduped: AgentStep[] = [];
    const indexByKey = new Map<string, number>();

    for (const step of displayActivitySteps) {
      const key = dedupeKeyForStep(step);
      if (!key) {
        deduped.push(step);
        continue;
      }

      const existingIndex = indexByKey.get(key);
      if (existingIndex == null) {
        indexByKey.set(key, deduped.length);
        deduped.push(step);
        continue;
      }

      deduped[existingIndex] = step;
    }

    return deduped;
  });
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

  function asCount(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value));
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) return Math.max(0, parsed);
    }
    return undefined;
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

  function changedFileFromRuntime(
    file: NonNullable<ChatItem["changedFiles"]>[number],
  ): ChangedFile {
    let additions = file.additions;
    let deletions = file.deletions;
    let lines: ChangedFileLine[] = [];
    let detailsAvailable = false;
    const patchText = file.patch?.trim() ?? "";

    if (patchText) {
      const parsedFiles = parsePatchTextIntoFiles(patchText);
      const parsed =
        parsedFiles.find((entry) => entry.file === file.file) ??
        parsedFiles.find((entry) => entry.file.endsWith(`/${file.file}`)) ??
        parsedFiles[0] ??
        parsePatchTextForKnownFile(patchText, file.file);

      if (parsed) {
        lines = parsed.lines;
        detailsAvailable = parsed.detailsAvailable;
        if (additions + deletions === 0 && parsed.additions + parsed.deletions > 0) {
          additions = parsed.additions;
          deletions = parsed.deletions;
        }
      }
    }

    return {
      file: file.file,
      additions,
      deletions,
      lines,
      detailsAvailable,
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

  function changedFileFromPatch(path: string, patchText: string): ChangedFile {
    const parsedFiles = parsePatchTextIntoFiles(patchText);
    const parsed =
      parsedFiles.find((entry) => entry.file === path) ??
      parsedFiles.find((entry) => entry.file.endsWith(`/${path}`)) ??
      parsedFiles[0] ??
      parsePatchTextForKnownFile(patchText, path);
    if (parsed) return { ...parsed, file: path };

    const stats = { additions: 0, deletions: 0 };
    for (const line of patchText.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) stats.additions += 1;
      if (line.startsWith("-") && !line.startsWith("---")) stats.deletions += 1;
    }
    return {
      file: path,
      additions: stats.additions,
      deletions: stats.deletions,
      lines: [],
      detailsAvailable: false,
    };
  }

  function patchFromBeforeAfter(
    path: string,
    before: string,
    after: string,
  ): string {
    const normalizedPath = path.replace(/\\/g, "/");
    const beforeLines = before.replace(/\r\n/g, "\n").split("\n");
    const afterLines = after.replace(/\r\n/g, "\n").split("\n");
    if (beforeLines[beforeLines.length - 1] === "") beforeLines.pop();
    if (afterLines[afterLines.length - 1] === "") afterLines.pop();

    const header = [`--- a/${normalizedPath}`, `+++ b/${normalizedPath}`];
    if (beforeLines.length * afterLines.length > 40000) {
      return [
        ...header,
        ...beforeLines.map((line) => `-${line}`),
        ...afterLines.map((line) => `+${line}`),
      ].join("\n");
    }

    const dp = Array.from({ length: beforeLines.length + 1 }, () =>
      Array<number>(afterLines.length + 1).fill(0),
    );
    for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
      for (let j = afterLines.length - 1; j >= 0; j -= 1) {
        dp[i]![j] =
          beforeLines[i] === afterLines[j]
            ? dp[i + 1]![j + 1]! + 1
            : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
      }
    }

    const lines = [...header];
    let i = 0;
    let j = 0;
    while (i < beforeLines.length && j < afterLines.length) {
      if (beforeLines[i] === afterLines[j]) {
        lines.push(` ${beforeLines[i]}`);
        i += 1;
        j += 1;
      } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
        lines.push(`-${beforeLines[i]}`);
        i += 1;
      } else {
        lines.push(`+${afterLines[j]}`);
        j += 1;
      }
    }
    while (i < beforeLines.length) {
      lines.push(`-${beforeLines[i]}`);
      i += 1;
    }
    while (j < afterLines.length) {
      lines.push(`+${afterLines[j]}`);
      j += 1;
    }
    return lines.join("\n");
  }

  function patchFromRecordSnapshots(
    path: string,
    record: Record<string, unknown>,
  ): string | null {
    const before =
      asNonBlankString(record.before) ??
      asNonBlankString(record.old) ??
      asNonBlankString(record.oldContent) ??
      asNonBlankString(record.original);
    const after =
      asNonBlankString(record.after) ??
      asNonBlankString(record.new) ??
      asNonBlankString(record.newContent) ??
      asNonBlankString(record.content);
    if (before === null || after === null) return null;
    return patchFromBeforeAfter(path, before, after);
  }

  function patchFromCreatedContent(path: string, content: string): string {
    const normalizedPath = path.replace(/\\/g, "/");
    const lines = content.replace(/\r\n/g, "\n").split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    return [
      "--- /dev/null",
      `+++ b/${normalizedPath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((line) => `+${line}`),
    ].join("\n");
  }

  function upsertMetadataFiles(
    files: unknown[],
    upsertFile: (file: string, partial?: Partial<ChangedFile>) => void,
  ): boolean {
    let found = false;
    for (const file of files) {
      if (!file || typeof file !== "object") continue;
      const record = file as Record<string, unknown>;
      const path =
        asNonBlankString(record.relativePath) ??
        asNonBlankString(record.filePath) ??
        asNonBlankString(record.file) ??
        asNonBlankString(record.path);
      if (!path) continue;

      const patchText =
        asNonBlankString(record.patch) ??
        asNonBlankString(record.diff) ??
        patchFromRecordSnapshots(path, record);
      const fromPatch = patchText ? changedFileFromPatch(path, patchText) : null;
      upsertFile(path, {
        file: path,
        additions:
          asCount(record.additions) ??
          asCount(record.insertions) ??
          asCount(record.added) ??
          fromPatch?.additions ??
          0,
        deletions:
          asCount(record.deletions) ??
          asCount(record.removed) ??
          asCount(record.removals) ??
          asCount(record.deleted) ??
          asCount(record.deletes) ??
          fromPatch?.deletions ??
          0,
        lines: fromPatch?.lines ?? [],
        detailsAvailable: fromPatch?.detailsAvailable ?? false,
      });
      found = true;
    }
    return found;
  }

  function buildChangedFilesSummary(
    steps: AgentStep[],
    assistantText: string,
    runtimeChangedFiles: ChatItem["changedFiles"] = [],
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
      if (partial?.additions !== undefined || partial?.deletions !== undefined) {
        const nextAdditions = partial.additions ?? existing.additions;
        const nextDeletions = partial.deletions ?? existing.deletions;
        const incomingTotal = nextAdditions + nextDeletions;
        const existingTotal = existing.additions + existing.deletions;
        if (incomingTotal > 0 || existingTotal === 0) {
          existing.additions = nextAdditions;
          existing.deletions = nextDeletions;
        }
      }
      if ((partial?.lines?.length ?? 0) > 0) {
        existing.lines = partial?.lines ?? existing.lines;
      }
      if (partial?.detailsAvailable !== undefined) {
        existing.detailsAvailable =
          existing.detailsAvailable || partial.detailsAvailable;
      }
    };

    for (const step of steps) {
      if (step.kind !== "tool") continue;
      const rawToolName = step.toolName?.trim().toLowerCase() ?? "";
      const toolParts = rawToolName.split(/[.:/]/g);
      const toolName = toolParts[toolParts.length - 1] ?? rawToolName;
      if (!EDIT_LIKE_TOOL_NAMES.has(toolName))
        continue;
      sawMutatingTool = true;

      const rawInput = step.toolInput ?? "";
      const rawOutput = step.toolOutput ?? "";
      const rawMetadata = step.toolMetadata ?? "";
      const input = parseRecord(rawInput);
      const output = parseRecord(rawOutput);
      const metadata = parseRecord(rawMetadata);
      const allStrings: string[] = [];
      collectStringValues(input, allStrings);
      collectStringValues(output, allStrings);
      collectStringValues(metadata, allStrings);
      collectStringValues(rawInput, allStrings);
      collectStringValues(rawOutput, allStrings);
      collectStringValues(rawMetadata, allStrings);

      const directPath =
        asNonBlankString(input.filePath) ??
        asNonBlankString(input.file_path) ??
        asNonBlankString(input.path) ??
        asNonBlankString(output.filePath) ??
        asNonBlankString(output.file_path) ??
        asNonBlankString(output.path);

      const metadataFiles = Array.isArray(metadata.files)
        ? metadata.files
        : [];
      let foundMetadata = upsertMetadataFiles(metadataFiles, upsertFile);

      if (!foundMetadata && metadata.filediff && typeof metadata.filediff === "object") {
        foundMetadata = upsertMetadataFiles([metadata.filediff], upsertFile);
      }

      if (!foundMetadata && Array.isArray(metadata.results)) {
        const resultFileDiffs = metadata.results
          .map((result) =>
            result && typeof result === "object"
              ? (result as Record<string, unknown>).filediff
              : null,
          )
          .filter((filediff) => filediff && typeof filediff === "object");
        foundMetadata = upsertMetadataFiles(resultFileDiffs, upsertFile);
      }

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

      if (
        directPath &&
        !foundMetadata &&
        asNonBlankString(input.oldString) &&
        asNonBlankString(input.newString)
      ) {
        const patchText = patchFromBeforeAfter(
          directPath,
          input.oldString as string,
          input.newString as string,
        );
        upsertFile(directPath, changedFileFromPatch(directPath, patchText));
        foundMetadata = true;
      }

      if (
        directPath &&
        !foundMetadata &&
        asNonBlankString(input.before) &&
        asNonBlankString(input.after)
      ) {
        const patchText = patchFromBeforeAfter(
          directPath,
          input.before as string,
          input.after as string,
        );
        upsertFile(directPath, changedFileFromPatch(directPath, patchText));
        foundMetadata = true;
      }

      if (
        directPath &&
        !foundMetadata &&
        (toolName === "write" || toolName === "create" || toolName === "file_write") &&
        asNonBlankString(input.content)
      ) {
        const patchText = patchFromCreatedContent(directPath, input.content as string);
        upsertFile(directPath, changedFileFromPatch(directPath, patchText));
        foundMetadata = true;
      }

      if (directPath && !foundMetadata) {
        upsertFile(directPath);
      }
    }

    for (const file of runtimeChangedFiles ?? []) {
      if (!file.file.trim()) continue;
      const parsed = changedFileFromRuntime(file);
      upsertFile(parsed.file, parsed);
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
      ? buildChangedFilesSummary(
          rawActivitySteps,
          message.content,
          message.changedFiles,
        )
      : null,
  );
  let userAttachments = $derived(isUser ? (message.attachments ?? []) : []);
  let outputErrorAttachments = $derived.by(() =>
    userAttachments.filter(
      (attachment) => attachment.mime === OUTPUT_ERROR_ATTACHMENT_MIME,
    ),
  );
  let regularUserAttachments = $derived.by(() =>
    userAttachments.filter(
      (attachment) => attachment.mime !== OUTPUT_ERROR_ATTACHMENT_MIME,
    ),
  );
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

  function splitOutputErrorContext(content: string): {
    body: string;
    context: string | null;
  } {
    const trimmed = content.trimEnd();
    const inlineMarker = "\n\nOutput error context:\n";
    const inlineIndex = trimmed.lastIndexOf(inlineMarker);
    if (inlineIndex >= 0) {
      return {
        body: trimmed.slice(0, inlineIndex).trimEnd(),
        context: trimmed
          .slice(inlineIndex + inlineMarker.length)
          .trim(),
      };
    }

    const blockOnlyMarker = "Output error context:\n";
    if (trimmed.startsWith(blockOnlyMarker)) {
      return {
        body: "",
        context: trimmed.slice(blockOnlyMarker.length).trim(),
      };
    }

    return { body: content, context: null };
  }

  let parsedOutputErrorContext = $derived.by(() =>
    isUser ? splitOutputErrorContext(message.content) : { body: message.content, context: null },
  );
  let outputErrorPreviewText = $derived.by(() => {
    const attachmentContext = outputErrorAttachments[0]?.url?.trim();
    if (attachmentContext) return attachmentContext;
    return parsedOutputErrorContext.context;
  });
  let shouldShowOutputErrorBadge = $derived.by(() => {
    if (!isUser) return false;
    if (outputErrorAttachments.length > 0) return true;
    return (parsedOutputErrorContext.context?.length ?? 0) > 0;
  });

  let userVisibleContent = $derived.by(() => {
    if (!isUser) return message.content;
    if (!shouldShowOutputErrorBadge) return message.content;
    return parsedOutputErrorContext.body;
  });
  function summarizeOutputError(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }
  let shouldRenderUserBubble = $derived.by(() => userVisibleContent.trim().length > 0);

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
          {onOpenFile}
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

  {#if isAssistant && changedFilesSummary && !busy}
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
    {#if shouldShowOutputErrorBadge}
      <div class="flex max-w-full flex-wrap justify-end gap-2 self-end">
        <div
          class="group inline-flex max-w-full items-center gap-2 rounded-md border border-dark-border bg-dark-bg px-2 py-1 text-xs text-dark-fg2"
          title={outputErrorPreviewText ?? "Output error context attached"}
        >
          <span
            class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-dark-bg text-dark-fg3"
            aria-hidden="true"
          >
            <MessageCircleWarning class="h-4 w-4" />
          </span>
          <span class="min-w-0">
            <span class="block max-w-44 truncate text-dark-fg1">
              {outputErrorAttachments[0]?.name ?? "Compile Error"}
            </span>
            <span class="block max-w-40 truncate text-[10px] text-dark-fg4">
              {summarizeOutputError(
                outputErrorPreviewText ?? "Output error context attached",
              )}
            </span>
          </span>
        </div>
      </div>
    {/if}

    {#if regularUserAttachments.length > 0}
      <div class="flex max-w-full flex-wrap justify-end gap-2 self-end">
        {#each regularUserAttachments as attachment (attachment.id)}
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

    {#if shouldRenderUserBubble}
      <p
        class="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] rounded-2xl bg-dark-bg1 px-4 py-2 text-sm font-thin leading-1 text-dark-fg0"
      >
        {userVisibleContent}
      </p>
    {/if}
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
