<script lang="ts">
  import { onMount } from "svelte";
  import {
    EXORT_DISCORD_LINK,
    EXORT_GITHUB_LINK,
    EXORT_GITHUB_REPO_API,
  } from "$lib/constant";

  const githubIcon = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true"><title>github</title><rect width="24" height="24" fill="none"></rect><path d="M12,2A10,10,0,0,0,8.84,21.5c.5.08.66-.23.66-.5V19.31C6.73,19.91,6.14,18,6.14,18A2.69,2.69,0,0,0,5,16.5c-.91-.62.07-.6.07-.6a2.1,2.1,0,0,1,1.53,1,2.15,2.15,0,0,0,2.91.83,2.16,2.16,0,0,1,.63-1.34C8,16.17,5.62,15.31,5.62,11.5a3.87,3.87,0,0,1,1-2.71,3.58,3.58,0,0,1,.1-2.64s.84-.27,2.75,1a9.63,9.63,0,0,1,5,0c1.91-1.29,2.75-1,2.75-1a3.58,3.58,0,0,1,.1,2.64,3.87,3.87,0,0,1,1,2.71c0,3.82-2.34,4.66-4.57,4.91a2.39,2.39,0,0,1,.69,1.85V21c0,.27.16.59.67.5A10,10,0,0,0,12,2Z"></path></svg>`;
  const discordIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z" fill="currentColor"></path></svg>`;
  const menuIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 7H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M4 12H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M4 17H20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
  const closeIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M6 6L18 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>`;
  const docsNavGlassClass = "shadow-nav backdrop-blur-[30px]";
  type NavItem = {
    label: string;
    href: string;
    hoverClass: string;
    external?: boolean;
  };

  const navItems: NavItem[] = [
    {
      label: "Download",
      href: "/download",
      hoverClass: "hover:text-gruvbox-green focus-visible:text-gruvbox-green",
    },
    {
      label: "Features",
      href: "/#features",
      hoverClass: "hover:text-gruvbox-orange focus-visible:text-gruvbox-orange",
    },
    {
      label: "Roadmap",
      href: "/roadmap",
      hoverClass: "hover:text-gruvbox-purple focus-visible:text-gruvbox-purple",
    },
    // {
    //   label: "Docs",
    //   href: "/docs",
    //   hoverClass: "hover:text-gruvbox-yellow focus-visible:text-gruvbox-yellow",
    // },
  ];

  let isNavScrolled = false;
  let isMobileMenuOpen = false;
  let githubStars: number | null = null;

  const formatGithubStars = (count: number | null) =>
    count === null ? "..." : count.toLocaleString("en-US");

  onMount(() => {
    if (typeof window === "undefined") {
      return;
    }

    const abortController = new AbortController();

    const syncNavState = () => {
      isNavScrolled = window.scrollY > 0;

      if (window.innerWidth >= 1024) {
        isMobileMenuOpen = false;
      }
    };

    const fetchGithubStars = async () => {
      try {
        const response = await fetch(EXORT_GITHUB_REPO_API, {
          headers: {
            Accept: "application/vnd.github+json",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          return;
        }

        const repo = (await response.json()) as { stargazers_count?: number };

        if (typeof repo.stargazers_count === "number") {
          githubStars = repo.stargazers_count;
        }
      } catch {
        // Keep fallback display if the API is unavailable or rate-limited.
      }
    };

    syncNavState();
    void fetchGithubStars();
    window.addEventListener("scroll", syncNavState, { passive: true });

    return () => {
      abortController.abort();
      window.removeEventListener("scroll", syncNavState);
    };
  });
</script>

<nav
  class={`sticky top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out ${
    isNavScrolled ? docsNavGlassClass : "bg-gruvbox-nav/80 backdrop-blur-2xl"
  } relative motion-reduce:transition-none`}
>
  {#if isMobileMenuOpen}
    <button
      type="button"
      class="fixed inset-x-0 bottom-0 top-[5.25rem] z-0 bg-[rgba(29,32,33,0.24)] backdrop-blur-md lg:hidden"
      aria-label="Close navigation menu"
      on:click={() => {
        isMobileMenuOpen = false;
      }}
    ></button>
  {/if}

  <div
    class="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-6 lg:px-8"
  >
    <a href="/" class="flex items-center gap-3">
      <img
        src="/exort-logo.webp"
        alt="Exort"
        class="h-12 w-12 object-contain"
      />
      <span
        class="inline-block pt-2 font-heading text-[clamp(1.45rem,1.05rem+1vw,2rem)] font-extrabold leading-[0.96] tracking-[0.08em] text-gruvbox-fg0"
      >
        Exort
      </span>
    </a>

    <div
      class="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 pt-2 lg:flex"
    >
      {#each navItems as item}
        <a
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noreferrer" : undefined}
          class={` text-gruvbox-text transition-colors duration-200 focus-visible:outline-none motion-reduce:transition-none ${item.hoverClass}`}
        >
          {item.label}
        </a>
      {/each}
    </div>

    <div class="flex items-center gap-2 md:gap-3">
      <a
        href={EXORT_DISCORD_LINK}
        target="_blank"
        rel="noreferrer"
        aria-label="Join the Exort Discord"
        class="hidden lg:inline-flex items-center justify-center text-gruvbox-text transition-colors duration-200 hover:text-gruvbox-blue focus-visible:text-gruvbox-blue focus-visible:outline-none motion-reduce:transition-none"
      >
        <span class="inline-flex h-8 w-8" aria-hidden="true">
          {@html discordIcon}
        </span>
      </a>

      <a
        href={EXORT_GITHUB_LINK}
        target="_blank"
        rel="noreferrer"
        aria-label="Exort GitHub repository"
        class="hidden lg:inline-flex items-center gap-2 text-sm text-gruvbox-text transition-colors duration-200 hover:border-gruvbox-yellow/40 hover:text-gruvbox-yellow focus-visible:text-gruvbox-yellow focus-visible:outline-none motion-reduce:transition-none"
      >
        <span class="inline-flex h-7 w-7" aria-hidden="true">
          {@html githubIcon}
        </span>
        <span class="font-mono text-sm tabular-nums tracking-[0.05em]"
          >{formatGithubStars(githubStars)}</span
        >
      </a>

      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gruvbox-text transition-colors duration-200 hover:border-gruvbox-orange/40 hover:text-gruvbox-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gruvbox-orange/50 lg:hidden motion-reduce:transition-none"
        aria-label={isMobileMenuOpen
          ? "Close navigation menu"
          : "Open navigation menu"}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-nav-menu"
        on:click={() => {
          isMobileMenuOpen = !isMobileMenuOpen;
        }}
      >
        <span class="inline-flex h-5 w-5" aria-hidden="true">
          {@html isMobileMenuOpen ? closeIcon : menuIcon}
        </span>
      </button>
    </div>
  </div>

  <div
    id="mobile-nav-menu"
    class={`absolute inset-x-0 top-full z-20 px-4 transition-[opacity,transform] duration-200 ease-out lg:hidden motion-reduce:transition-none ${
      isMobileMenuOpen
        ? "pointer-events-auto translate-y-0 opacity-100"
        : "pointer-events-none -translate-y-2 opacity-0"
    }`}
  >
    <div
      class="flex w-full flex-col gap-1 border-t-0 bg-gruvbox-bg px-4 py-4 shadow-soft"
    >
      {#each navItems as item}
        <a
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noreferrer" : undefined}
          class={`px-3 py-3 text-sm text-gruvbox-muted transition-colors duration-200 hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none motion-reduce:transition-none ${item.hoverClass}`}
          on:click={() => {
            isMobileMenuOpen = false;
          }}
        >
          {item.label}
        </a>
      {/each}
    </div>
  </div>
</nav>
