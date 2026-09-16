# Eventseller Frontend

Dieses Projekt ist das Frontend für die Eventseller-Anwendung, aufgebaut mit **SvelteKit**, **Vite** und **TypeScript**.

---

## 1. Voraussetzungen

Bevor du starten kannst, müssen folgende Programme auf deinem Computer installiert sein:

**Node.js** (enthält automatisch den Paketmanager `npm`)
* Falls noch nicht installiert: Lade dir die **LTS-Version** von der offiziellen Website herunter: [nodejs.org](https://nodejs.org/)

---

## 2. Umgebungsvariablen (.env)
   Im Projektverzeichnis befindet sich eine Datei namens `.env`. Diese enthält Konfigurationswerte (wie z. B. Schnittstellen-URLs).

Stelle sicher, dass die `.env`-Datei vorhanden ist. Falls Vorlagen wie `.env.example` existieren, erstelle daraus eine Kopie namens `.env`.

---

## 3. Projekt lokal einrichten

Öffne dein Terminal (unter macOS: **Terminal**, unter Windows: **PowerShell** oder **Eingabeaufforderung**) und navigiere in den Ordner des Projekts:

```bash
cd /Pfad/zu/deinem/Ordner/eventseller-frontend
```
### Schritt A: Abhängigkeiten / Pakete installieren
Führe folgenden Befehl aus, um alle benötigten Bibliotheken (die in der package.json hinterlegt sind) automatisch herunterzuladen:
```bash
npm install
```
Hinweis: Dieser Schritt muss nur beim ersten Mal oder nach dem Herunterladen neuer Projektupdates durchgeführt werden. Er erstellt den Ordner node_modules.

---

## 4. Anwendung lokal starten (Entwicklungsmodus)
   Um die Anwendung auf deinem Computer zu starten, führe diesen Befehl aus:
```bash
npm run dev
```
Nach wenigen Sekunden siehst du eine Ausgabe im Terminal, die etwa so aussieht:
```bash
VITE v8.x.x dev server running at:
Local: http://localhost:5173/
Network: use --host to expose
```
### Webseite im Browser öffnen
Klicke auf den Link im Terminal oder öffne deinen Webbrowser (z. B. Chrome, Safari, Firefox) und gib folgende Adresse ein:

👉 http://localhost:5173

(Die Anwendung lädt sich nun lokal und aktualisiert sich automatisch, sobald Änderungen am Code vorgenommen werden.)

---

## 5. Hilfreiche Befehle im Überblick
* `npm run dev` - Startet den lokalen Entwicklungsserver mit Hot-Reloading
* `npm run build` - Erstellt ein optimiertes Build für die spätere Veröffentlichung (Production)
* `npm run preview` - Startet eine lokale Vorschau der fertigen Build-Version

---

## 6. Server beenden
   Wenn du fertig bist und den lokalen Server stoppen möchtest:

* Drücke im Terminal die Tastenkombination **Strg + C** (Windows) bzw. **Cmd + C** (macOS).
