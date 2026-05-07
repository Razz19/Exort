<script lang="ts">
  import { onMount } from "svelte";

  const githubIcon = `<svg viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" transform="translate(-84 -7399)" fill="currentColor"></path></svg>`;
  const discordIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z" fill="currentColor"></path></svg>`;

  const navItems = [
    { label: "Features", href: "/#features" },
    { label: "Download", href: "/download" },
    {
      label: "View on GitHub",
      href: "https://github.com/Razz19/Exort",
      external: true,
    },
  ];

  let isNavScrolled = false;

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncNavState = () => {
      isNavScrolled = window.scrollY > 18;
    };

    syncNavState();
    window.addEventListener("scroll", syncNavState, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncNavState);
    };
  });
</script>

<nav
  class={`sticky top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out ${
    isNavScrolled
      ? "bg-[rgba(40,40,40,0.92)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-[30px]"
      : "bg-gruvbox-nav/80 backdrop-blur-2xl"
  } motion-reduce:transition-none`}
>
  <div
    class="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
  >
    <a href="/" class="flex items-center gap-3">
      <img src="/exort-logo.png" alt="Exort" class="h-12 w-12 object-contain" />
      <span
        class="inline-block pt-2 font-heading text-[clamp(1.55rem,1.1rem+1vw,2rem)] font-extrabold leading-[0.96] tracking-[0.08em] text-gruvbox-fg0"
      >
        Exort
      </span>
    </a>

    <div
      class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
    >
      {#each navItems as item}
        <a
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noreferrer" : undefined}
          class="text-sm text-gruvbox-muted transition-colors duration-200 hover:text-white motion-reduce:transition-none"
        >
          {item.label}
        </a>
      {/each}
    </div>

    <div class="flex items-center gap-4">
      <a
        href="https://github.com/Razz19/Exort"
        target="_blank"
        rel="noreferrer"
        aria-label="Exort GitHub repository"
        class="inline-flex items-center justify-center text-gruvbox-text transition-colors duration-200 hover:text-gruvbox-orange focus-visible:text-gruvbox-orange focus-visible:outline-none motion-reduce:transition-none"
      >
        <span class="inline-flex h-7 w-7" aria-hidden="true">
          {@html githubIcon}
        </span>
      </a>

      <a
        href="https://discord.gg/xmcmcWkr4V"
        target="_blank"
        rel="noreferrer"
        aria-label="Join the Exort Discord"
        class="inline-flex items-center justify-center text-gruvbox-text transition-colors duration-200 hover:text-gruvbox-purple focus-visible:text-gruvbox-purple focus-visible:outline-none motion-reduce:transition-none"
      >
        <span class="inline-flex h-7 w-7" aria-hidden="true">
          {@html discordIcon}
        </span>
      </a>
    </div>
  </div>
</nav>
