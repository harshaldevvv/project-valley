# Privacy

Project Valley is a browser game with no accounts, no telemetry, no analytics, no ads and no server of its own.

- **Network:** it only loads its own files (code, models, sounds, textures) from the site you play it on. It sends
  nothing about you or your play anywhere.
- **Saves** are stored in your browser's IndexedDB (database `project-valley-saves`) on your device.
- **Settings** (graphics, controls, difficulty) and dismissed tips are stored in your browser's `localStorage` for
  the site you play on.
- To reset everything, clear the site data for that site in your browser settings.
