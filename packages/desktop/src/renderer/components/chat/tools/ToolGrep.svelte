<script lang="ts">
  import { Search } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputArgs, inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let subtitle = $derived(inputValue(input, "path") ?? "workspace");
  let args = $derived(inputArgs(input, ["pattern", "include"]));
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Search} title="Grep" {subtitle} {args} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
