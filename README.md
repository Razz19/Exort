# Exort

Exort is a desktop app for embedded development with an OpenCode-powered AI coding agent. Write code, compile, upload, and interact with your hardware all in one place.


![Exort application screenshot](assets/app.png)


 > _You can run with free OpenCode models, or connect your own provider setup for models such as ChatGPT and Claude🔥_

## Highlights

- AI chat and code editing in the same workspace
- Multi-workspace project management with persisted local state
- Monaco editor with project file tree and tabbed editing
- OpenCode runtime with free default models
- Bring-your-own-model workflow for your own provider credentials
- Embedded-focused agent workflow for compile, upload, and iteration
- Arduino compile and upload flows from the app
- Board manager for installing and managing cores
- Built-in Serial Monitor and Serial Plotter
- Workspace state and chat history persisted locally
- Supports Arduino CLI board platforms, including Arduino, ESP32, ESP8266, RP2040, STM32, Teensy, and more

## Core Features

Exort is built around the parts of embedded development that usually end up scattered across multiple tools.

![Exort feature highlights](assets/features.png)

- `Serial Monitor`: watch live device output without leaving the app.
- `Serial Plotter`: plot numeric serial data directly inside Exort while you iterate on firmware.
- `Board Manager`: install and manage Arduino cores and related tooling from the desktop UI.
- `Project Manager`: open, switch between, and persist multiple embedded workspaces without leaving the app.
- `Provider Connection`: use free OpenCode models out of the box, or connect your own model provider setup for the workflows you already use.
- `Embedded Agent`: use an agent designed for embedded work that can inspect the workspace, edit files, compile sketches, and guide upload flows from inside Exort.


## Getting Started


### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Validation

```bash
npm run lint
npm run typecheck
npm run build
```




## Workflow

1. Open a workspace.
2. Ask Exort Agent to inspect the project or make a change.
3. Edit and review files.
4. Select a board and serial port.
5. Compile or upload the active sketch.
6. Inspect output in Serial Monitor or Plotter.


<!-- ## Architecture Notes

- The Exort Agent / OpenCode runtime is hosted in the Electron main process
- The renderer talks to native capabilities through `window.electronAPI`
- Workspace state, open files, and chat history are persisted locally
- Logs stay in the terminal rather than an in-app log console
 -->


## License
Exort is licensed under `AGPL-3.0-only`. See [LICENSE](LICENSE).
