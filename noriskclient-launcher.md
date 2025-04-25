# NoRisk Client Launcher Dokumentation

## Funktionen

### Profil-Management
- Erstellen neuer Profile mit benutzerdefinierten Einstellungen
- Bearbeiten bestehender Profile (Name, Version, Loader, etc.)
- Löschen von Profilen
- Kopieren von Profilen mit selektiven Dateien/Einstellungen
- Kopieren von NoRisk Standard-Versionen als benutzerdefinierte Profile
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

### Standard-Profile (Vorlagen)
- Anzeigen vordefinierter Profil-Vorlagen (früher "NoRisk Standard-Versionen")
- Direktes Starten von Standard-Profilen (erstellt temporäres Benutzerprofil)
- Kopieren von Standard-Profilen als benutzerdefinierte Profile
- Selektives Übernehmen von Dateien beim Kopieren
- Standard-Profile sind reguläre `Profile`-Einträge mit `is_standard_version = true`.

### NoRisk-Pack System
- Integration vorkonfigurierter Modpacks
- Aktivieren/Deaktivieren einzelner Mods innerhalb eines Packs
- Kompatibilitätsprüfung für Mods innerhalb eines Packs
- Wiederverwendbare Extraktionslogik für `.noriskpack` und `.mrpack` Dateien
- Gemeinsame Code-Basis für verschiedene Archivformate, die die `extract_mrpack_overrides` Funktion nutzt
- Effiziente Extraktion von Overrides aus den Archiven in das Zielprofilverzeichnis
- Unterstützung für den Import und Export von Modpacks
- Task-Management mit tokio für asynchrone Prozesse

### Launcher-Konfiguration
- Globale Einstellungen für den Launcher
- Experimental-Modus für NoRisk Client
- Automatische Update-Überprüfung
- Konfigurierbare Anzahl gleichzeitiger Downloads
- Versionsbasierte Konfigurationsverwaltung für Zukunftskompatibilität

### Dateisystem-Integration
- Anzeigen der Profilordnerstruktur mit hierarchischer Baumansicht
- Interaktive Auswahl einzelner Dateien oder ganzer Ordner
- Kopieren ausgewählter Dateien zwischen Profilen
- Intelligente Vorauswahl bestimmter Dateien (z.B. options.txt, shaderpacks)
- Benutzerfreundliche Dateiauswahl mit Hierarchie-Anzeige
- Checkbox-basierte Selektion ganzer Verzeichnisse oder einzelner Dateien
- Automatisches Ein-/Ausklappen von Ordnern
- Anzeige von Dateimetadaten (Größe, Änderungsdatum)

### Minecraft-Launcher
- Starten von Minecraft mit ausgewähltem Profil
- Anzeige von Launcher-Events und Status
- Fortschrittsanzeige während des Launchvorgangs
- Experimenteller Modus für NoRisk Client (globale Konfiguration)
- Abbrechen laufender Installations- und Launchprozesse
- Visuelles Feedback zum Launchstatus (Button ändert Aussehen)
- Prozessüberwachung mit DashMap zur Nachverfolgung laufender Installationen
- Ereignisbenachrichtigungen beim Abbruch von Launchprozessen

### Benutzeroberfläche
- Moderne, reaktive UI mit Svelte und TypeScript
- Modal-System für verschiedene Aktionen
- Detailansichten mit erweiterbaren Abschnitten
- Benutzerfreundliches Profil-Kopieren über intuitive Dialoge
- Konfigurationsseite für globale Launcher-Einstellungen
- Debugansichten für Entwicklung
- Barrierefreie UI-Elemente mit zugangsoptimierter Bedienung
- Dynamische Schaltflächen, die ihren Status und Funktion basierend auf aktuellen Prozessen ändern

### Tauri-Integration
- Kommunikation zwischen Frontend und Backend über Tauri-API
- Ausführen von Betriebssystem-Operationen
- Dateisystemzugriff mit Sicherheitsabstraktionen

### Authentifizierung & Token-Management
- Microsoft-Login für Minecraft-Konten
- Automatische Token-Aktualisierung
- Speicherung und sichere Verwaltung von Zugangsdaten
- NoRisk-spezifisches Token-System für Premium-Funktionen
- Unterstützung für experimentellen und produktiven Modus

## Technische Architektur

### Frontend
- Svelte mit TypeScript für reaktive Benutzeroberfläche
- Svelte Runes für moderne Zustandsverwaltung
- Modulare Komponenten für verschiedene Funktionen
- Ereignisbasierte Kommunikation zwischen Komponenten
- Reaktive Dateisystem-Visualisierung
- Interaktive Prozesssteuerung für Installationsprozesse

### Backend
- Rust-basiertes Backend über Tauri
- SQLite-Datenbank für Persistenz
- Dateisystem-Operationen für Profilverwaltung
- Prozessmanagement für Minecraft-Ausführung und Installation
- Konvertierung zwischen Standard-Versionen und benutzerdefinierten Profilen
- Konfigurationsmanager für globale Launcher-Einstellungen
- Token-Management für NoRisk-Authentifizierung
- Task-Management mit tokio für asynchrone Prozesse

## Datenbankschema

### Tabellen

#### profiles
- `id` (TEXT): Primärschlüssel, UUID für das Profil
- `name` (TEXT): Anzeigename des Profils
- `description` (TEXT): Optionale Beschreibung des Profils (hauptsächlich für Standard-Profile)
- `path` (TEXT): Pfad zum Profilordner (kann relativ oder ein Platzhalter für Standard-Profile sein)
- `game_version` (TEXT): Minecraft-Version
- `loader` (TEXT): Modloader-Typ (fabric, forge, vanilla, etc.)
- `loader_version` (TEXT): Version des Modloaders
- `created` (INTEGER): Unix-Timestamp der Erstellung
- `last_played` (INTEGER): Unix-Timestamp der letzten Nutzung
- `selected_norisk_pack_id` (TEXT): ID des ausgewählten NoRisk-Packs (kann NULL sein)
- `source_standard_profile_id` (TEXT): ID des Quell-Standard-Profils, falls dieses Profil davon kopiert wurde (kann NULL sein)
- `group` (TEXT): Optionaler Gruppenname zur UI-Organisation (kann NULL sein)
- `is_standard_version` (BOOLEAN): Gibt an, ob dies ein Standard-Profil (Vorlage) ist (`true`) oder ein Benutzerprofil (`false`).

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
- Hinzufügen der `source_standard_profile_id`-Spalte zu `profiles`

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

## Konfigurationssystem

### Launcher-Konfiguration
Die Launcher-Konfiguration wird in einer JSON-Datei gespeichert (`launcher_config.json`) und verwaltet folgende Einstellungen:

- `version` (INTEGER): Versionsnummer der Konfiguration für zukünftige Kompatibilität
- `is_experimental` (BOOLEAN): Aktiviert den experimentellen Modus für NoRisk Client
- `auto_check_updates` (BOOLEAN): Automatische Überprüfung auf Updates
- `concurrent_downloads` (INTEGER): Anzahl gleichzeitiger Downloads (1-10)

Der ConfigManager stellt folgende Funktionen bereit:
- `get_config()`: Gibt die aktuelle Konfiguration zurück
- `set_experimental_mode(enabled)`: Setzt den experimentellen Modus
- `set_auto_check_updates(enabled)`: Aktiviert/deaktiviert automatische Updates
- `set_concurrent_downloads(count)`: Setzt die Anzahl gleichzeitiger Downloads

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

### Migration 4: Standard-Profil Quellreferenz
- Hinzufügen der `source_standard_profile_id`-Spalte zu `profiles`

### Migration 5: Standard-Profile Integration
- Hinzufügen der `is_standard_version` Spalte (BOOLEAN, Default: false) zu `profiles`
- Hinzufügen der `description` Spalte (TEXT, Nullable) zu `profiles`
- Hinzufügen der `banner` Spalte (TEXT, Nullable, JSON-Format) zu `profiles`. Speichert die Banner-Informationen als JSON.
- Hinzufügen der `group` Spalte (TEXT, Nullable) zu `profiles` (falls nicht schon durch eine vorherige, undokumentierte Migration geschehen)

## Backend-Komponentenübersicht

### Prozessmanagement
- `process_state.rs`: Verwaltet Minecraft- und Installationsprozesse
  - `launching_processes`: DashMap zur Verfolgung laufender Installations- und Launchprozesse
  - `add_launching_process`: Registriert einen neuen Installationsprozess für ein Profil
  - `remove_launching_process`: Entfernt einen Installationsprozess nach Abschluss oder Abbruch
  - `abort_launch_process`: Bricht einen laufenden Installationsprozess ab
  - `has_launching_process`: Prüft, ob ein Profil gerade einen laufenden Installationsprozess hat

### Profile-Management
- `profile_command.rs`: Hauptinterface für Profiloperationen
  - `launch_profile`: Startet ein Profil oder eine NoRisk Standard-Version temporär
  - `abort_profile_launch`: Bricht einen laufenden Installationsprozess ab und sendet ein Event
  - `is_profile_launching`: Prüft den aktuellen Launchstatus eines Profils
  - `copy_profile`: Kopiert ein Profil oder eine NoRisk Standard-Version mit optionaler Dateiauswahl
  - `get_profile_directory_structure`: Liefert die Dateistruktur eines Profils oder einer Standard-Version

### NoRisk-Versionen
- `norisk_versions.rs`: Verwaltet NoRisk Standard-Versionen
  - `convert_standard_to_user_profile`: Konvertiert eine Standard-Version in ein benutzerdefinierbares Profil

### Konfiguration
- `config_state.rs`: Verwaltet globale Launcher-Konfigurationen
  - `ConfigManager`: Stellt Methoden zum Lesen und Schreiben der Konfiguration bereit
  - `LauncherConfig`: Datenstruktur für die Konfiguration mit Versionsunterstützung

### Authentifizierung
- `minecraft_auth.rs`: Verwaltet Minecraft- und NoRisk-Authentifizierung
  - `NoRiskToken`: Struktur für NoRisk-API-Tokens mit einem Wertfeld
  - `NoRiskCredentials`: Verwaltet sowohl Produktions- als auch experimentelle NoRisk-Tokens
  - `refresh_norisk_token_if_necessary`: Aktualisiert Token automatisch bei Bedarf

### Modpack-Integration
- `mrpack.rs`: Zentrale Komponente für Modpack-Verarbeitung
  - `extract_mrpack_overrides`: Gemeinsame Extraktionsfunktion für `.mrpack` und `.noriskpack` Dateien
  - `process_mrpack`: Parsen und Verarbeiten von Modpack-Manifesten
  - `resolve_manifest_files`: Analyse und Auflösung von Modrinth-Mod-Referenzen
  - `import_mrpack_as_profile`: Vollständiger Import-Workflow für Modpacks
- `path_utils.rs`: Datei- und Pfadoperationen
  - `import_noriskpack`: Spezifische Funktion für `.noriskpack`-Import, die intern `extract_mrpack_overrides` nutzt
  - `find_unique_profile_segment`: Erzeugt eindeutige Profilpfade bei Imports
- `profile_utils.rs`: Profilbezogene Funktionen
  - `export_profile_to_noriskpack`: Exportiert Profile als `.noriskpack`-Dateien mit Overrides

### API-Integration
- `norisk_api.rs`: Kommunikation mit NoRisk-API
  - `refresh_norisk_token`: Aktualisiert das NoRisk-Token mit HWID-Validierung
  - `norisk_assets`: Abrufen von NoRisk-Assets für spezifische Branches
  - Unterstützung für Produktions- und Staging-API-Endpunkte

### Befehle
- `config_commands.rs`: Frontend-Befehle für die Konfigurationsverwaltung
  - `get_launcher_config`: Gibt die aktuelle Konfiguration zurück
  - `set_experimental_mode`: Setzt den experimentellen Modus
  - `set_auto_check_updates`: Aktiviert/deaktiviert automatische Updates
  - `set_concurrent_downloads`: Konfiguriert die Anzahl gleichzeitiger Downloads

## Frontend-Komponenten

### ProfileView.svelte
- Anzeige und Steuerung eines einzelnen Profils
- Unterstützung für Launch, Abbruch, Bearbeitung und Löschung
- Dynamischer Launch-Button, der zum Abbruch-Button wird, wenn ein Installationsprozess läuft
- Status-Polling zur Überprüfung, ob ein Launch-Prozess noch läuft
- Visuelles Feedback durch Farbänderung und Ladeanimation während des Launchens
- Vollständige Integration mit dem Backend über Tauri-Commands

### ProfileCopy.svelte
- Benutzerfreundliche UI zum Kopieren von Profilen (Benutzer- oder Standard-Profile)
- Dateiauswahl mit Baumansicht
- Vorauswahl wichtiger Dateien (options.txt, shaderpacks, etc.)

### NoRiskVersions.svelte
- Anzeige verfügbarer NoRisk Standard-Versionen
- Optionen zum direkten Starten oder Kopieren als Profil

### FileNodeViewer.svelte
- Hochinteraktive, hierarchische Dateisystem-Darstellung
- Vollständige Baumstruktur mit dynamischem Ein-/Ausklappen von Ordnern
- Checkbox-basierte Mehrfachauswahl mit Eltern-Kind-Selektionsmechanismus
- Flexible Konfigurationsoptionen:
  - Automatische Vorauswahl bestimmter Dateitypen oder Pfade
  - Ein-/Ausblenden des Root-Knotens
  - Standardmäßiges Ein-/Ausklappen des Root-Ordners
  - Automatisches Auswählen aller Kindknoten bei Auswahl eines Elternordners
- Anzeige von Dateimetadaten (Größe, Änderungsdatum)
- Ereignisbasierte Kommunikation mit übergeordneten Komponenten
- Integrierte Debug-Ansicht für Entwicklungszwecke
- Zugänglichkeitsoptimierte Interaktionselemente
- Performanceoptimierte Darstellung auch bei umfangreichen Dateistrukturen

### LauncherSettings.svelte
- Konfiguration des experimentellen Modus
- Einstellungen für automatische Updates
- Steuerung der Download-Parallelität

## Datenstrukturen

### Prozessverwaltung
- `ProcessManager`: Verwaltet laufende Prozesse und Installationen
  - `processes`: RwLock-HashMap für reguläre Minecraft-Prozesse
  - `launching_processes`: DashMap für laufende Installationsprozesse
  - `JoinHandle<()>`: Tokio-Tasks für asynchrone Installationsprozesse
  - Methoden zum Hinzufügen, Entfernen und Abbrechen von Prozessen
- `ProcessMetadata`: Informationen zu laufenden Prozessen
  - `id`: Eindeutige UUID des Prozesses
  - `profile_id`: ID des zugehörigen Profils
  - `start_time`: Zeitpunkt des Prozessstarts
  - `state`: Aktueller Zustand des Prozesses
  - `pid`: Prozess-ID des Betriebssystems

### NoRiskToken
- `value`: String-Wert des JWT-Tokens für API-Autorisierung
- Wird bei Minecraft-Start als JVM-Argument übergeben
- Unterstützung für Produktions- und experimentelle Tokens
- Automatische Aktualisierung bei Authentifizierung

### NoRiskCredentials
- Wrapper für NoRisk-Tokens
- `production`: Option<NoRiskToken> für Produktionsumgebung
- `experimental`: Option<NoRiskToken> für experimentelle Umgebung
- Methoden zur Token-Auswahl basierend auf Launcher-Konfiguration

### Modpack-Formate
- `.noriskpack`: Eigenes Format für NoRisk-Client-Modpacks
  - Enthält `profile.json` mit Profildaten
  - Enthält `overrides/`-Verzeichnis mit Spiel- und Moddateien
  - Verwendet das gleiche Extraktionssystem wie `.mrpack`
- `.mrpack`: Standard-Format von Modrinth
  - Enthält `modrinth.index.json` als Manifest
  - Enthält `overrides/`-Verzeichnis mit zusätzlichen Dateien
  - Definiert Mods mit Hashes für Integritätsprüfung
  - Unterstützt Abhängigkeiten zwischen Mods
  - Spezifiziert Minecraft-Version und Modloader
- Gemeinsame Verarbeitungslogik:
  - Extraktion von Metadaten und Konfigurationsdateien
  - Auflösung von Mod-Referenzen gegen Modrinth-API
  - Eindeutige Profilpfaderzeugung
  - Kopieren von Overrides in Zielprofilverzeichnis

### EventSystem
- `EventState`: Zentrale Komponente für Event-Handling
- `EventPayload`: Datenstruktur für Events mit:
  - `event_id`: Eindeutige Event-ID
  - `event_type`: Typ des Events (z.B. "LaunchingMinecraft", "MinecraftProcessExited")
  - `target_id`: Optionale Ziel-ID (z.B. Profil-ID)
  - `message`: Textuelle Beschreibung
  - `progress`: Optionaler Fortschrittswert
  - `error`: Optionale Fehlermeldung
- Spezifische Events:
  - `MinecraftProcessExitedPayload`: Details zum Beenden eines Minecraft-Prozesses
  - Abbruch-Events für Launch-Prozesse

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
- Erweiterte Konfigurationsoptionen
- Optimierung der Dateisystem-Darstellung für noch größere Profile
- Kontextsensitive Hilfe für komplexe Funktionen
