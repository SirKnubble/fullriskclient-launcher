# NoRisk Client Launcher Dokumentation

## Funktionen

### Profil-Management
- Erstellen neuer Profile mit benutzerdefinierten Einstellungen
- Bearbeiten bestehender Profile (Name, Version, Loader, etc.)
- Löschen von Profilen
- Kopieren von Profilen mit selektiven Dateien/Einstellungen
- Anzeigen von Profildetails und Statistiken
- Öffnen des Profilordners im Dateisystem

### Mod-Management
- Anzeigen und Verwalten von Mods pro Profil
- Aktivieren/Deaktivieren einzelner Mods
- Updates für Mods anzeigen und installieren
- Mod-Versionen ändern (für Modrinth-Mods)
- Löschen einzelner Mods
- Filtermechanismus für kompatible Mods basierend auf Game-Version und Loader
- Importieren lokaler Mods

### NoRisk-Pack System
- Integration vorkonfigurierter Modpacks
- Aktivieren/Deaktivieren einzelner Mods innerhalb eines Packs
- Kompatibilitätsprüfung für Mods innerhalb eines Packs

### Dateisystem-Integration
- Anzeigen der Profilordnerstruktur
- Auswählen einzelner Dateien oder Ordner
- Kopieren ausgewählter Dateien zwischen Profilen
- Vorauswahl bestimmter Dateien (z.B. options.txt, shaderpacks)

### Minecraft-Launcher
- Starten von Minecraft mit ausgewähltem Profil
- Anzeige von Launcher-Events und Status
- Fortschrittsanzeige während des Launchvorgangs

### Benutzeroberfläche
- Moderne, reaktive UI mit Svelte und TypeScript
- Modal-System für verschiedene Aktionen
- Detailansichten mit erweiterbaren Abschnitten
- Debugansichten für Entwicklung

### Tauri-Integration
- Kommunikation zwischen Frontend und Backend über Tauri-API
- Ausführen von Betriebssystem-Operationen
- Dateisystemzugriff mit Sicherheitsabstraktionen

## Technische Architektur

### Frontend
- Svelte mit TypeScript für reaktive Benutzeroberfläche
- Svelte Runes für Zustandsverwaltung
- Modulare Komponenten für verschiedene Funktionen
- Ereignisbasierte Kommunikation zwischen Komponenten

### Backend
- Rust-basiertes Backend über Tauri
- SQLite-Datenbank für Persistenz
- Dateisystem-Operationen für Profilverwaltung
- Prozessmanagement für Minecraft-Ausführung

## Datenbankschema

### Tabellen

#### profiles
- `id` (TEXT): Primärschlüssel, UUID für das Profil
- `name` (TEXT): Anzeigename des Profils
- `game_version` (TEXT): Minecraft-Version
- `loader` (TEXT): Modloader-Typ (fabric, forge, vanilla, etc.)
- `loader_version` (TEXT): Version des Modloaders
- `created` (INTEGER): Unix-Timestamp der Erstellung
- `last_played` (INTEGER): Unix-Timestamp der letzten Nutzung
- `selected_norisk_pack_id` (TEXT): ID des ausgewählten NoRisk-Packs (kann NULL sein)
- `path` (TEXT): Pfad zum Profilordner

#### mods
- `id` (TEXT): Primärschlüssel, UUID für den Mod
- `profile_id` (TEXT): Fremdschlüssel zur profiles-Tabelle
- `source_type` (TEXT): Quelle des Mods (modrinth, local, url, maven, embedded)
- `enabled` (BOOLEAN): Status des Mods (aktiviert/deaktiviert)
- `display_name` (TEXT): Anzeigename des Mods
- `game_versions` (TEXT): JSON-Array mit kompatiblen Spielversionen
- `associated_loader` (TEXT): Zugehöriger Modloader
- `version` (TEXT): Version des Mods
- `source_data` (TEXT): JSON-Objekt mit quellspezifischen Daten

#### disabled_norisk_mods
- `id` (INTEGER): Primärschlüssel
- `profile_id` (TEXT): Fremdschlüssel zur profiles-Tabelle
- `pack_id` (TEXT): ID des NoRisk-Packs
- `mod_id` (TEXT): ID des deaktivierten Mods
- `game_version` (TEXT): Spielversion
- `loader` (TEXT): Modloader-Typ

#### custom_mods
- `filename` (TEXT): Name der Moddatei
- `profile_id` (TEXT): Fremdschlüssel zur profiles-Tabelle
- `is_enabled` (BOOLEAN): Status des Mods (aktiviert/deaktiviert)
- `path` (TEXT): Pfad zur Moddatei

## Migrationen

### Migration 1: Initiales Schema
- Erstellung der `profiles`-Tabelle
- Erstellung der `mods`-Tabelle
- Erstellung der `disabled_norisk_mods`-Tabelle

### Migration 2: Custom Mods
- Erstellung der `custom_mods`-Tabelle

### Migration 3: Erweiterte Profildaten
- Hinzufügen der `path`-Spalte zu `profiles`
- Hinzufügen der `last_played`-Spalte zu `profiles`

## Bekannte Probleme und Einschränkungen
- Tauri-Module müssen zur Laufzeit verfügbar sein
- Möglicherweise Kompatibilitätsprobleme mit bestimmten Minecraft-Versionen
- Die Dateisystemansicht kann bei sehr großen Profilordnern langsam werden

## Zukünftige Funktionen
- Verbessertes Fehlerbehandlungssystem
- Direkter Download von Mods aus dem Modrinth-Repository
- Automatische Updates für den Launcher
- Mehrspieler-Serververwaltung
- Backup-System für Profile
