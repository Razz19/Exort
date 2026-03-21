<script lang="ts">
  import { GitCompareArrows } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { asText, parseToolOutput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let body = $derived.by(() => {
    const output = parseToolOutput(step.toolOutput);
    if (typeof output === "string") {
      return output;
    }

    if (
      typeof output === "object" &&
      output !== null &&
      !Array.isArray(output)
    ) {
      const record = output as Record<string, unknown>;
      return asText(record.stdout) ?? "";
    }

    return "";
  });
</script>

<BasicToolCard
  icon={GitCompareArrows}
  title="arduinoCompile"
  status={step.status}
>
  <ToolMarkdownBody {body} />
</BasicToolCard>
