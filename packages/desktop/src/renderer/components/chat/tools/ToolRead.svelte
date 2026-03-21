<script lang="ts">
  import { Search } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputArgs, inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let subtitle = $derived(inputValue(input, "filePath") ?? "file");
  let args = $derived(inputArgs(input, ["offset", "limit"]));
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Search} title="Read" {subtitle} {args} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
