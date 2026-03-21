<script lang="ts">
  import { MessageCircle } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { markdownBody, outputAsString, parseToolInput, parseToolOutput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let questionCount = $derived.by(() => {
    const questions = input.questions;
    if (!Array.isArray(questions)) return null;
    return questions.length;
  });

  let subtitle = $derived(
    questionCount == null
      ? "Question"
      : `${questionCount} question${questionCount === 1 ? "" : "s"}`,
  );

  let body = $derived.by(() => {
    const output = parseToolOutput(step.toolOutput);
    if (typeof output === "object" && output !== null) {
      return outputAsString(output);
    }
    const fallback = markdownBody(step);
    return fallback;
  });
</script>

<BasicToolCard icon={MessageCircle} title="Question" {subtitle} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
