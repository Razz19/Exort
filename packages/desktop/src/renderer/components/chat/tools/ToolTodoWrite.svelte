<script lang="ts">
  import { Activity } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { markdownBody } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Activity} title="Todo" subtitle="Plan updates" status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
