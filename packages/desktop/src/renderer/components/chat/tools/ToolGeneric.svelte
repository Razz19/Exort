<script lang="ts">
  import { Hammer } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { markdownBody } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Hammer} title={step.toolName ?? "Tool"} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
