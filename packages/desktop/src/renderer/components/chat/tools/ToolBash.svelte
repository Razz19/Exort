<script lang="ts">
  import { Terminal } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let description = $derived(inputValue(input, "description"));
  let command = $derived(inputValue(input, "command"));
  let title = $derived(description ? `Bash (${description})` : "Bash");
  let subtitle = $derived(
    description ? (command ?? "Command") : (command ?? description ?? "Command"),
  );
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Terminal} {title} {subtitle} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
