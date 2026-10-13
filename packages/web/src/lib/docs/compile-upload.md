---
title: Compile & Upload
description: How manual and automatic compile/upload flows work, plus the common failure points.
order: 6
section: Compile & Upload
---

# Compile & Upload

Exort supports automatic and manual compile/upload flows through Arduino CLI.

## Select Board, FQBN, And Port

Before you compile or upload, select the correct board, port, and project settings.

If you are not sure which board, port, or project configuration to use, <span class="text-gruvbox-orange">ask Exort</span>. Exort can guide you through the correct selection.

For board package installation and board platform details, see [Board Manager](/docs/board-manager).

## Manual Compile And Upload

After your board and port are configured, you can compile and upload manually.

This is useful when you want direct control over the process or want to validate each step yourself.

## Automatic Compile And Upload

Exort can also compile and upload the code automatically.

If you prefer, Exort can handle the full process for you without requiring separate manual steps.

## Output Window

The Output Window shows the compile and upload process, including detailed progress and error messages.

If the process fails, you can add the full error output to the context and ask Exort to inspect it.

Exort can usually determine whether the issue is caused by:

- code that needs to be changed
- project settings that need to be adjusted
- hardware configuration that needs to be corrected

If the issue is related to code or configuration, Exort can usually fix it directly. If the problem is hardware-related, Exort can tell you what to check and how to correct it.
