import type { AgentStep, ChatItem } from "../types";

export function createAssistantChatItem(content = ""): ChatItem {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    steps: [],
  };
}

export function upsertMessageStepInMessages(
  messages: ChatItem[],
  messageId: string,
  step: AgentStep,
): ChatItem[] {
  const index = messages.findIndex((item) => item.id === messageId);
  if (index === -1) return messages;

  const message = messages[index];
  if (!message) return messages;
  const currentSteps = message.steps ?? [];
  const stepIndex = currentSteps.findIndex((item) => item.id === step.id);

  let nextSteps: AgentStep[];
  if (stepIndex >= 0) {
    nextSteps = [...currentSteps];
    const existingStep = nextSteps[stepIndex];
    if (!existingStep) return messages;
    nextSteps[stepIndex] = {
      ...existingStep,
      ...step,
      contentStart: existingStep.contentStart ?? step.contentStart,
    };
  } else {
    nextSteps = [...currentSteps, step];
  }

  const next = [...messages];
  next[index] = {
    ...message,
    steps: nextSteps,
  };
  return next;
}

export function updateStepByRequestIdInMessages(
  messages: ChatItem[],
  requestId: string,
  updater: (step: AgentStep) => AgentStep,
): { messages: ChatItem[]; found: boolean } {
  for (let messageIndex = 0; messageIndex < messages.length; messageIndex += 1) {
    const message = messages[messageIndex];
    if (!message) continue;
    const steps = message.steps;
    if (!steps?.length) continue;

    const stepIndex = steps.findIndex((step) => step.requestId === requestId);
    if (stepIndex === -1) continue;

    const nextSteps = [...steps];
    const currentStep = nextSteps[stepIndex];
    if (!currentStep) continue;
    nextSteps[stepIndex] = updater(currentStep);

    const next = [...messages];
    next[messageIndex] = {
      ...message,
      steps: nextSteps,
    };

    return { messages: next, found: true };
  }

  return { messages, found: false };
}

export function ensureAssistantMessageForInterruptInMessages(
  messages: ChatItem[],
  preferredMessageId?: string,
): { messages: ChatItem[]; messageId: string } {
  if (preferredMessageId) {
    const existing = messages.find((item) => item.id === preferredMessageId);
    if (existing?.role === "assistant") {
      return {
        messages,
        messageId: existing.id,
      };
    }
  }

  const fallbackAssistant = [...messages]
    .reverse()
    .find((item) => item.role === "assistant");
  if (fallbackAssistant) {
    return {
      messages,
      messageId: fallbackAssistant.id,
    };
  }

  const created = createAssistantChatItem("");
  return {
    messages: [...messages, created],
    messageId: created.id,
  };
}
