# NebulaGraph Desktop

<!-- Project Status -->
[![GitHub release](https://img.shields.io/github/v/release/wey-gu/NebulaGraph-Desktop?label=Version&style=flat-square)](https://github.com/wey-gu/nebulagraph-desktop/releases) [![Build Status](https://img.shields.io/github/actions/workflow/status/wey-gu/NebulaGraph-Desktop/build.yml?style=flat-square&logo=github-actions&logoColor=white)](https://github.com/wey-gu/NebulaGraph-Desktop/actions/workflows/build.yml) [![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=flat-square&logo=apache&logoColor=white)](https://github.com/wey-gu/NebulaGraph-Desktop/blob/main/LICENSE)

<!-- Download Options -->
[![Windows](https://img.shields.io/badge/Windows-Download-0078D6?style=flat-square&logo=windows&logoColor=white)](https://github.com/wey-gu/nebulagraph-desktop/releases) [![macOS](https://img.shields.io/badge/macOS-Download-000000?style=flat-square&logo=apple&logoColor=white)](https://github.com/wey-gu/nebulagraph-desktop/releases)

<!-- Built With -->
[![NebulaGraph](https://img.shields.io/badge/Powered_by-NebulaGraph-blue?style=flat-square&logo=graph&logoColor=white)](https://github.com/vesoft-inc/nebula) [![Electron](https://img.shields.io/badge/Built_with-Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Docker](https://img.shields.io/badge/Requires-Docker-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/get-started)

A modern, cross-platform desktop version of NebulaGraph.

![NebulaGraph Desktop](./assets/screenshot.png)

## Features

- 🚀 Modern, intuitive interface for managing NebulaGraph services
- 🔄 Real-time service monitoring and health checks
- 📊 Resource usage metrics (CPU, Memory, Network)
- 🔧 Individual service controls
- 📝 Service logs viewer
- 🎨 Beautiful, responsive UI
- 🌐 Offline mode support (no Docker Hub image pull needed)

## Quick Start

1. Install [Docker](https://www.docker.com/get-started) on your system

2. Download NebulaGraph Desktop from the [releases page](https://github.com/wey-gu/nebulagraph-desktop/releases)

   - for macOS, you need to install the `dmg` file, and do one extra step as below.
   - for Windows, you need to install the `exe` file

3. Install and launch the application

4. Click "Start All" to launch NebulaGraph services

5. Open Studio in your browser to start working with NebulaGraph

Note: fill in `graphd` as "IP Address" and `9669` as "Port", user and password: `root`/`nebula`

### macOS extra step

> copied from [OpenAI Translator](https://github.com/openai-translator/openai-translator/)

This step is to fix the error: "NebulaGraph Desktop can't be opened because the developer cannot be verified." or "This app is damaged and suggested to be moved to Trash."

<p align="center">
    <img alt="App is damaged" width="300" src="https://user-images.githubusercontent.com/1206493/223916804-45ce3f34-6a4a-4baf-a0c1-4ab5c54c521f.png" />
</p>

- Click the `Cancel` button, then go to the `Settings` -> `Privacy and Security` page, click the `Still Open` button, and then click the `Open` button in the pop-up window. After that, there will be no more pop-up warnings when opening `NebulaGraph Desktop`. 🎉
    <p align="center">
        <img alt="Open Studio" width="500" src="https://user-images.githubusercontent.com/1206493/223916970-9c99f15e-cf61-4770-b92d-4a78f980bb26.png" /> <img alt="Open Studio" width="200" src="https://user-images.githubusercontent.com/1206493/223917449-ed1ac19f-c43d-4b13-9888-79ba46ceb862.png" />
    </p>

- If you cannot find the above options in `Privacy & Security`, or get error prompts such as broken files with Apple Silicon machines. Open `Terminal.app` and enter the following command (you may need to enter a password halfway through), then restart `NebulaGraph Desktop`:

  ```sh
  sudo xattr -d com.apple.quarantine /Applications/NebulaGraph\ Desktop.app
  ```

## System Requirements

- Windows 10/11, macOS 10.15+
- Docker Desktop installed and running
- 8GB RAM minimum (16GB recommended)
- 10GB free disk space

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed dev instructions and progress.

## License

Apache License 2.0
