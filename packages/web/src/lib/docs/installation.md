---
title: Download & Install
description: Download Exort for Windows, macOS, or Linux and get the desktop app running.
order: 2
section: Getting Started
---

<script lang="ts">
  import { EXORT_GITHUB_LINK, EXORT_GITHUB_RELEASES_LINK } from "$lib/constant";
</script>

# Download & Install

There are two main ways to use Exort: download it from the website, or use GitHub.

## Option 1: Download From The Website

The fastest and easiest way to start is from the Exort download page:

- <a href="/download">/download</a>

Choose the build that matches your operating system, then install and launch Exort.

After the app opens, make sure the required tools are available in Settings. Exort can install and manage the required dependencies for you, including:

- Arduino CLI
- OpenCode

In most cases, this is the best option if you just want to get Exort running quickly.

## Option 2: Use GitHub

GitHub gives you two ways to use Exort:

- Run Exort from source
- Download packaged builds from GitHub Releases

### 2.1: Run Exort From GitHub

If you want to work from source, use the GitHub repository:

- <a href={EXORT_GITHUB_LINK}>{EXORT_GITHUB_LINK}</a>

Clone the repository, open the project folder, install dependencies, and start the development app:

```bash
git clone https://github.com/Razz19/Exort.git
cd Exort
npm install
npm run dev
```

Once Exort starts, allow it to install and manage its required tools if prompted. This includes Arduino CLI and OpenCode.

Running from source is useful if you want to contribute, test local changes, or work on Exort during development.

### 2.2: Download Packaged Builds From GitHub Releases

If you prefer downloading packaged builds directly from GitHub, use the releases page:

- <a href={EXORT_GITHUB_RELEASES_LINK}>{EXORT_GITHUB_RELEASES_LINK}</a>

Open the release you want, then choose the asset that matches your platform and architecture.

Common examples:

- Windows: `.exe` installer
- macOS: `.dmg` for Apple Silicon or Intel
- Linux: `.AppImage`

Avoid `.blockmap` files unless you specifically need them for update-related workflows. If you only want to install Exort, download the main application asset for your system.
