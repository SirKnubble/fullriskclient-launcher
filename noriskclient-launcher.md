# NoRiskClient Launcher Documentation

## Project Overview
The NoRiskClient Launcher is a desktop application built with Tauri 2 and Svelte 5, designed to manage Minecraft installations, profiles, mods, and provide additional features like skin management. The application uses a Rust backend with Tauri for native functionality and a Svelte frontend for the user interface.

## Technologies and Versions

### Frontend
- **Svelte**: Version 5.0.0
- **SvelteKit**: Version 2.9.0
- **TypeScript**: Version 5.6.2
- **Vite**: Version 6.0.3

### Backend
- **Tauri**: Version 2
- **Rust**: Edition 2021
- **Reqwest**: Version 0.12 (HTTP client)
- **Tokio**: Version 1.0 (Async runtime)
- **Serde**: Version 1.0 (Serialization/deserialization)

### Plugins
- **@tauri-apps/plugin-clipboard-manager**: Version 2.2.2
- **@tauri-apps/plugin-dialog**: Version 2.2.1
- **@tauri-apps/plugin-opener**: Version 2.2.6

## Project Structure

### Frontend Structure
- **src/components**: Reusable Svelte components
- **src/lib**: Library code and utilities
  - **src/lib/api**: API client code for communicating with the backend
  - **src/lib/components**: Reusable Svelte components
  - **src/lib/stores**: Svelte stores for state management
  - **src/lib/types**: TypeScript type definitions
- **src/pages**: Page components
- **src/routes**: SvelteKit route definitions

### Backend Structure
- **src-tauri/src/commands**: Tauri command implementations
  - **config_commands.rs**: Commands for handling configuration
  - **file_command.rs**: File operations
  - **minecraft_auth_command.rs**: Minecraft authentication
  - **minecraft_command.rs**: Minecraft-related operations
  - **modrinth_commands.rs**: Integration with Modrinth (mod platform)
  - **path_commands.rs**: Path-related operations
  - **process_command.rs**: Process management
  - **profile_command.rs**: Profile management
- **src-tauri/src/minecraft**: Minecraft-specific code
  - **api**: API integrations with Minecraft services
  - **auth**: Authentication with Minecraft services
  - **downloads**: Handling downloads of Minecraft files
  - **dto**: Data Transfer Objects (data structures)
  - **launch**: Launching Minecraft
  - **modloader**: Handling mod loaders (like Forge, Fabric)
- **src-tauri/src/integrations**: Integration with external services
- **src-tauri/src/state**: Application state management
- **src-tauri/src/utils**: Utility functions

## Data Types and Structures

### Frontend Data Types
The frontend uses TypeScript interfaces to define data structures. Key types include:

#### Profile Types (src/lib/types/profile.ts)
- **ModLoader**: Enum for mod loaders ('vanilla', 'forge', 'fabric', 'quilt', 'neoforge')
- **ProfileState**: Enum for profile states ('not_installed', 'installing', 'installed', 'running', 'error')
- **ImageSource**: Discriminated union for image sources (url, relativePath, relativeProfile, absolutePath, base64)
- **ProfileSettings**: Interface for profile settings (memory, resolution, Java path, etc.)
- **ModSource**: Discriminated union for mod sources (local, url, maven, embedded, modrinth)
- **Mod**: Interface for mod information
- **Profile**: Main interface for profile data

#### Minecraft Types (src/lib/types/minecraft.ts)
- **MinecraftAccount**: Interface for Minecraft account data
- **MinecraftProfile**: Interface for Minecraft profile data
- **TexturesData**: Interface for Minecraft textures data
- **MinecraftSkin**: Interface for skin data

### Backend Data Types
The backend uses Rust structs to define data structures. Key types include:

#### Minecraft DTOs (src-tauri/src/minecraft/dto)
- **fabric_meta.rs**: Fabric mod loader metadata
- **forge_meta.rs**: Forge mod loader metadata
- **java_distribution.rs**: Java distribution information
- **minecraft_profile.rs**: Minecraft profile data
- **neo_forge_meta.rs**: NeoForge mod loader metadata
- **norisk_meta.rs**: NoRiskClient specific metadata
- **piston_meta.rs**: Piston Meta API structures
- **quilt_meta.rs**: Quilt mod loader metadata
- **version_manifest.rs**: Minecraft version manifest

## Key Features

### Profile Management
The launcher allows users to create, edit, and delete Minecraft profiles. Each profile can have its own:
- Minecraft version
- Mod loader (Vanilla, Forge, Fabric, Quilt, NeoForge)
- Mods
- Java settings (memory, arguments)
- Resolution settings

### Minecraft Authentication
The launcher implements Microsoft OAuth authentication for Minecraft accounts. Features include:
- Login with Microsoft account
- Account management (adding, removing, switching)
- Token refresh

### Skin Management
The launcher provides skin management features:
- View current skin
- Upload new skins
- Choose between classic and slim models
- Save and manage local skins
- Reset skin to default

### Mod Integration
The launcher integrates with mod platforms:
- Modrinth API integration for mod discovery and installation
- Local mod management
- Mod enabling/disabling

## Conventions

### Rust Conventions
- Uses Rust 2021 edition
- Async/await for asynchronous operations with Tokio
- Error handling with thiserror
- Serialization/deserialization with serde
- Command pattern for Tauri commands

### Tauri 2 Conventions
- Commands defined with #[tauri::command] attribute
- Plugin system for modular functionality
- Asset protocol for serving assets
- IPC for communication between frontend and backend

### Svelte 5 Conventions
- Uses Svelte 5's new reactive primitives ($state, $derived, $effect)
- Component-based architecture
- Props defined with $props()
- TypeScript for type safety

### TypeScript Conventions
- Interfaces for data structures
- Discriminated unions for type safety
- Type exports for shared types
- Strict null checking

## Development Workflow

### Frontend Development
1. Run `npm run dev` to start the development server
2. Make changes to Svelte components
3. Use TypeScript for type safety
4. Use Svelte stores for state management
5. Use Tauri API for communication with the backend

### Backend Development
1. Define data structures in Rust
2. Implement Tauri commands
3. Use async/await for asynchronous operations
4. Handle errors with Result and CommandError
5. Use state management for shared state

### Building
1. Run `npm run build` to build the frontend
2. Run `cargo tauri build` to build the complete application
