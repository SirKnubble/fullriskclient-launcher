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

### NoRisk Standard-Versionen
- Anzeigen vordefinierter NoRisk Versionen
- Direktes Starten von NoRisk Standard-Versionen
- Kopieren von Standard-Versionen als benutzerdefinierte Profile
- Selektives Übernehmen von Dateien beim Kopieren
- Automatische Konvertierung von Standard-Versionen in benutzerdefinierte Profile

### NoRisk-Pack System
- Integration vorkonfigurierter Modpacks
- Aktivieren/Deaktivieren einzelner Mods innerhalb eines Packs
- Kompatibilitätsprüfung für Mods innerhalb eines Packs

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

### Benutzeroberfläche
- Moderne, reaktive UI mit Svelte und TypeScript
- Modal-System für verschiedene Aktionen
- Detailansichten mit erweiterbaren Abschnitten
- Benutzerfreundliches Profil-Kopieren über intuitive Dialoge
- Konfigurationsseite für globale Launcher-Einstellungen
- Debugansichten für Entwicklung
- Barrierefreie UI-Elemente mit zugangsoptimierter Bedienung

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

### Backend
- Rust-basiertes Backend über Tauri
- SQLite-Datenbank für Persistenz
- Dateisystem-Operationen für Profilverwaltung
- Prozessmanagement für Minecraft-Ausführung
- Konvertierung zwischen Standard-Versionen und benutzerdefinierten Profilen
- Konfigurationsmanager für globale Launcher-Einstellungen
- Token-Management für NoRisk-Authentifizierung

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
- `source_standard_profile_id` (TEXT): ID des Quell-Standard-Profils, falls kopiert (kann NULL sein)

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

## Backend-Komponentenübersicht

### Profile-Management
- `profile_command.rs`: Hauptinterface für Profiloperationen
  - `copy_profile`: Kopiert ein Profil oder eine NoRisk Standard-Version mit optionaler Dateiauswahl
  - `get_profile_directory_structure`: Liefert die Dateistruktur eines Profils oder einer Standard-Version
  - `launch_profile`: Startet ein Profil oder eine NoRisk Standard-Version temporär

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

### ProfileCopy.svelte
- Benutzerfreundliche UI zum Kopieren von Profilen
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
