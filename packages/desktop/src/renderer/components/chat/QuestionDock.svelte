<script lang="ts">
  import type { AgentPermissionReply, AgentStep, ChatItem } from "../../lib/types";
  import QuestionPromptCard from "./interrupts/QuestionPromptCard.svelte";

  let {
    messages,
    onPermissionReply: _onPermissionReply,
    onQuestionReply,
    onQuestionReject,
  } = $props<{
    messages: ChatItem[];
    onPermissionReply?: (requestId: string, reply: AgentPermissionReply) => Promise<void> | void;
    onQuestionReply?: (requestId: string, answers: string[][]) => Promise<void> | void;
    onQuestionReject?: (requestId: string) => Promise<void> | void;
  }>();

  function findPendingQuestionStep(): AgentStep | null {
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      const message = messages[messageIndex];
      const steps = message.steps;
      if (!steps?.length) continue;

      for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
        const step = steps[stepIndex];
        if (step.kind !== "question") continue;
        if (!step.question || !step.requestId) continue;
        if (step.status !== "running") continue;
        return step;
      }
    }

    return null;
  }

  let pending = $derived(findPendingQuestionStep());
</script>

{#if pending && pending.question && pending.requestId && onQuestionReply && onQuestionReject}
  <div class="border-t border-dark-border bg-dark-surface px-4 py-3" data-component="question-dock">
    <div class="mb-1 text-xs font-medium uppercase tracking-wide text-dark-fg3">Question Dock</div>
    <QuestionPromptCard
      requestId={pending.requestId}
      questions={pending.question.questions}
      answers={pending.question.answers}
      rejected={pending.question.rejected}
      busy={pending.status !== "running"}
      onReply={onQuestionReply}
      onReject={onQuestionReject}
    />
  </div>
{/if}
