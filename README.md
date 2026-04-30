# FullRiskClient Launcher

[![Latest Release Build](https://img.shields.io/github/actions/workflow/status/SirKnubble/fullriskclient-launcher/build.yml?event=push&label=latest%20release%20build)](https://github.com/SirKnubble/fullriskclient-launcher/actions/workflows/build.yml)
[![Latest Release](https://img.shields.io/github/v/release/SirKnubble/fullriskclient-launcher?label=latest%20release)](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest)
[![License](https://img.shields.io/github/license/SirKnubble/fullriskclient-launcher)](LICENSE)

This Repository includes all bugfixes and features of NoRiskClient/issues by @SirKnubble, aswell as the FullRisk Theme in Launcher Settings, which is based on an overhaul of the original NoRiskClient look by @TimLohrer.

⚠️ I´m aware of most appearing issues (like x-scrollbar for profiles in fullrisk-theme:gridview or artifacts by newssection & background), as they will be fixed in the future.
This is only meant to be a pre-release version. I do not take responsibility for any data loss. (shouldn´t appear if you install without uninstalling)

Kuss

<img width="1600" height="1000" alt="FullRiskClient Launcher screenshot" src="https://github.com/user-attachments/assets/7c187c19-8bb0-4ece-ac74-cfd327f9e09c" />

## Downloads

All links point to the newest GitHub release.

| OS                  | Support        | Download                                                                                                                                                                                                                                                        |
| ------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11       | :green_heart:  | [Installer (.exe)](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest/download/NoRisk.Launcher_0.6.20_x64-setup.exe)                                                                                                                           |
| Linux x64           | :broken_heart: not tested | [AppImage](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest/download/NoRisk.Launcher_0.6.20_amd64.AppImage) / [Debian package (.deb)](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest/download/NoRisk.Launcher_0.6.20_amd64.deb) |
| macOS Apple Silicon | :broken_heart: not tested | [Disk image (.dmg)](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest/download/NoRisk.Launcher_0.6.20_aarch64.dmg)                                                                                                                            |
| macOS Intel         | :broken_heart: not tested | [Disk image (.dmg)](https://github.com/SirKnubble/fullriskclient-launcher/releases/latest/download/NoRisk.Launcher_0.6.20_x64.dmg)                                                                                                                           |

## Compile it yourself!

### Prerequisites
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/en/download)
- **Rust** (latest stable) - [Install here](https://www.rust-lang.org/tools/install)
- **Yarn** package manager - `npm install -g yarn`

### Setup Instructions
1. Clone the repository:
   ```bash
   git clone --recurse-submodules https://github.com/NoRiskClient/noriskclient-launcher
   cd noriskclient-launcher
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Start development mode:
   ```bash
   yarn tauri dev
   ```

4. Build for production:
   ```bash
   yarn tauri build
   ```

## Disclaimer

This project is not affiliated, associated, endorsed by, or in any way connected to FullRisk.
