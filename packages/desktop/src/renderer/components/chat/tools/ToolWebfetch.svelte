<script lang="ts">
  import { ExternalLink } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputArgs, inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let subtitle = $derived(inputValue(input, "url") ?? "url");
  let args = $derived(inputArgs(input, ["format"]));
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={ExternalLink} title="Webfetch" {subtitle} {args} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
