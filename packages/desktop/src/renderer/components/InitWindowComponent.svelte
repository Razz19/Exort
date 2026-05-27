<script lang="ts">
  import emptyChatBackground from "../../../resources/chat-bg.png";
</script>

<div class="flex h-screen w-full bg-dark-bg text-gray-100">
  <div
    class="flex min-h-full w-full items-center select-none justify-center py-8"
  >
    <div class="flex flex-col items-center justify-center">
      <div class="mt-40 flex h-52 w-52 items-center justify-center">
        <img
          src={emptyChatBackground}
          alt=""
          aria-hidden="true"
          class="pointer-events-none h-full w-full object-contain select-none opacity-20"
        />
      </div>
      <p class="text-dark-fg3 opacity-30">Exort</p>
      <div class="flex h-12 items-center justify-center"></div>
    </div>
  </div>
</div>
