<script lang="ts">
  import { Code } from "lucide-svelte";
  import type { AgentStep } from "../../../lib/types";
  import BasicToolCard from "../parts/BasicToolCard.svelte";
  import ToolMarkdownBody from "./ToolMarkdownBody.svelte";
  import { markdownBody, parseToolInput } from "./toolData";

  let { step } = $props<{ step: AgentStep }>();

  let input = $derived(parseToolInput(step.toolInput));
  let filesCount = $derived.by(() => {
    const files = input.files;
    if (!Array.isArray(files)) return null;
    return files.length;
  });
  let subtitle = $derived(
    filesCount == null ? "Patch" : `${filesCount} file${filesCount === 1 ? "" : "s"}`,
  );
  let body = $derived(markdownBody(step));
</script>

<BasicToolCard icon={Code} title="Apply Patch" {subtitle} status={step.status}>
  <ToolMarkdownBody {body} />
</BasicToolCard>
