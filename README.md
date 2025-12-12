# Fishing Game - Export Paket

## Inhalt

Dieses Paket enthält alle Dateien, die du brauchst, um das Angelspiel in deine andere Replit-Webseite zu integrieren.

### Ordnerstruktur
```
fishing-game-export/
├── components/
│   ├── FishingGame.tsx    # Hauptspiel-Komponente
│   └── CatchPopup.tsx     # Fang-Popup
├── stores/
│   └── useFishing.tsx     # Zustand/State Management
├── assets/
│   ├── well.png           # Brunnen-Bild
│   ├── bobber.png         # Schwimmer-Bild
│   ├── btn-cast.png       # Auswerfen-Button
│   └── btn-reel.png       # Einholen-Button
└── README.md              # Diese Anleitung
```

## Installation

### 1. Abhängigkeiten installieren

Folgende npm-Pakete werden benötigt:
```bash
npm install zustand lucide-react framer-motion
```

Falls du Tailwind CSS noch nicht hast:
```bash
npm install tailwindcss postcss autoprefixer
```

### 2. Dateien kopieren

1. Kopiere die Dateien aus `components/` in deinen `src/components/` Ordner
2. Kopiere die Dateien aus `stores/` in deinen `src/lib/stores/` Ordner (erstelle den Ordner falls nötig)
3. Kopiere die Bilder aus `assets/` in deinen `public/` Ordner

### 3. Import-Pfade anpassen

In den Komponenten werden folgende Import-Pfade verwendet:
- `@/lib/stores/useFishing` - Passe dies an deine Projektstruktur an

Falls dein Projekt keine `@/` Alias hat, ändere die Imports zu relativen Pfaden:
```tsx
// In FishingGame.tsx ändern:
import { useFishing, generateFish, Fish, FishState } from "../lib/stores/useFishing";
import { CatchPopup } from "./CatchPopup";

// In CatchPopup.tsx ändern:
import { useFishing } from "../lib/stores/useFishing";
```

### 4. Komponente verwenden

```tsx
import { FishingGame } from "./components/FishingGame";

function App() {
  return (
    <div className="w-full h-screen">
      <FishingGame />
    </div>
  );
}
```

## Wichtige Hinweise

- Die Komponente füllt ihren Container aus (`w-full h-full`)
- Stelle sicher, dass der Container eine feste Höhe hat
- Die Assets müssen im `public/` Ordner liegen, damit sie unter `/well.png`, `/bobber.png`, etc. erreichbar sind

## Anpassungen

### Fischarten ändern
In `stores/useFishing.tsx` findest du die `FISH_TYPES` Array - dort kannst du Fischarten hinzufügen/ändern.

### Fischgröße ändern
In `stores/useFishing.tsx` bei `generateFish()` findest du `sizeScale` - ändere die Werte für größere/kleinere Fische.

### Sprache ändern
Die UI ist auf Deutsch. Ändere die Texte in `FishingGame.tsx` und `CatchPopup.tsx` für andere Sprachen.
