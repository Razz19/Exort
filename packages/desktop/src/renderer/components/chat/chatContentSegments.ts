import type { ChatItem } from "../../lib/types";

export type AssistantPlanningSplit = {
  planning: string;
  response: string;
};

const normalizeOffset = (offset: number, contentLength: number): number => {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(contentLength, Math.trunc(offset)));
};

export function hasStepOffsets(message: ChatItem): boolean {
  return Boolean(
    message.steps?.some(
      (step) =>
        typeof step.contentStart === "number" &&
        Number.isFinite(step.contentStart),
    ),
  );
}

export function getLeadingAssistantContent(message: ChatItem): string {
  if (!message.steps?.length || !hasStepOffsets(message)) return "";
  const firstStep = message.steps[0];
  if (!firstStep) return "";
  const firstOffset = normalizeOffset(
    firstStep.contentStart ?? 0,
    message.content.length,
  );
  return message.content.slice(0, firstOffset);
}

export function getStepAssistantContent(
  message: ChatItem,
  index: number,
): string {
  if (!message.steps?.length) return "";

  const step = message.steps[index];
  if (!step) return "";

  const start = normalizeOffset(
    step.contentStart ?? message.content.length,
    message.content.length,
  );
  const nextStep = message.steps[index + 1];
  const end = nextStep
    ? normalizeOffset(
        nextStep.contentStart ?? message.content.length,
        message.content.length,
      )
    : message.content.length;

  if (end <= start) return "";
  return message.content.slice(start, end);
}

const USER_ANALYSIS_START_RE =
  /^\s*(the user\b|user (is|asked|asks|wants)\b)/i;
const DIRECT_PLANNING_START_RE =
  /^\s*(i should\b|i need to\b|let me think\b|i will\b|i'll\b)/i;
const PLANNING_META_RE =
  /\b(i should\b|i need to\b|let me (summarize|suggest|think|outline|explain|provide|respond|help|walk(?:\s+them)?\s+through)\b|i will\b|i'll\b)\b/i;
const RESPONSE_START_RE =
  "(I'm sorry|Not necessarily|Sure|Absolutely|Here(?:'s| are)\\b|Let's\\b|Hi\\b|Hello\\b|Hey\\b)";

export function looksLikeAssistantPlanningContent(content: string): boolean {
  const trimmed = content.trim();
  if (trimmed.length < 16) return false;

  const startsWithUserAnalysis = USER_ANALYSIS_START_RE.test(trimmed);
  const startsWithDirectPlanning = DIRECT_PLANNING_START_RE.test(trimmed);

  if (!startsWithUserAnalysis && !startsWithDirectPlanning) {
    return false;
  }

  if (startsWithUserAnalysis && trimmed.length > 60 && !PLANNING_META_RE.test(trimmed)) {
    return false;
  }

  return true;
}

function findBoundaryIndex(content: string): number {
  const patterns = [
    /\n{2,}(?=#{1,3}\s)/g,
    new RegExp(`\\n{2,}(?=${RESPONSE_START_RE})`, "gi"),
    new RegExp(
      `[.!?]\\s*(?=(No problem!|${RESPONSE_START_RE.slice(1, -1)}))`,
      "gi",
    ),
    /(?=##\s)/g,
    /(?=\n#{1,3}\s)/g,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (!match || typeof match.index !== "number") continue;
    if (match.index < 24) continue;
    const start = match[0] ? match.index + match[0].length : match.index;
    if (start < 24) continue;
    return start;
  }

  return -1;
}

export function splitAssistantPlanningContent(
  content: string,
): AssistantPlanningSplit | null {
  const trimmed = content.trim();
  if (trimmed.length < 40) return null;
  if (!looksLikeAssistantPlanningContent(trimmed)) return null;

  const boundary = findBoundaryIndex(content);
  if (boundary <= 0) return null;

  const planning = content.slice(0, boundary).trimEnd();
  const response = content.slice(boundary).trimStart();
  if (!planning || !response) return null;

  return { planning, response };
}
