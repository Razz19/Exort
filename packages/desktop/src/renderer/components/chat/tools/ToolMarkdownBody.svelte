<script lang="ts">
  import { renderMarkdown } from "../chatMarkdown";

  let { body } = $props<{
    body: string;
  }>();
</script>

{#if body.trim().length > 0}
  <div class="chat-markdown tool-markdown">
    {@html renderMarkdown(body)}
  </div>
{/if}
