<script lang="ts">
  import { Hammer } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputArgs, inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let subtitle = $derived(inputValue(input, "description") ?? "Delegating task");
  let args = $derived(inputArgs(input, ["subagent_type"]));
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Hammer} title="Task" {subtitle} {args} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
