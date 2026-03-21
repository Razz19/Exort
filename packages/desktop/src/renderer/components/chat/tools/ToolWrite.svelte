<script lang="ts">
  import { Code } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { inputValue, markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let subtitle = $derived(inputValue(input, "filePath") ?? "file");
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Code} title="Write" {subtitle} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
