<script lang="ts">
  import { onMount } from "svelte";

  const githubIcon = `<svg viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" transform="translate(-84 -7399)" fill="currentColor"></path></svg>`;

  const navItems = [
    { label: "Features", href: "/#features" },
    { label: "Download", href: "/download" },
    {
      label: "View on GitHub",
      href: "https://github.com/Razz19/Exort",
      external: true,
    },
    {
      label: "Join our Discord",
      href: "https://discord.gg/xmcmcWkr4V",
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
  class:nav-scrolled={isNavScrolled}
  class="site-nav sticky top-0 z-30 bg-[color:var(--color-nav)]/80 backdrop-blur-2xl"
>
  <div
    class="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8"
  >
    <a href="/" class="flex items-center gap-3">
      <img src="/exort-logo.png" alt="Exort" class="h-12 w-12 object-contain" />
      <span class="brand-wordmark pt-2 font-mono">Exort</span>
    </a>

    <div
      class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex"
    >
      {#each navItems as item}
        <a
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noreferrer" : undefined}
          class="text-sm text-[color:var(--color-text-muted)] transition hover:text-white"
        >
          {item.label}
        </a>
      {/each}
    </div>

    <a
      href="https://github.com/Razz19/Exort"
      target="_blank"
      rel="noreferrer"
      aria-label="Exort GitHub repository"
      class="github-nav-link"
    >
      <span class="github-nav-link__icon" aria-hidden="true">
        {@html githubIcon}
      </span>
    </a>
  </div>
</nav>
