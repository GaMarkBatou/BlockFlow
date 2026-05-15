# BlockFlow v0.19

Lokális Chrome extension weboldal-automatizáláshoz.

## v0.19 javítás

- A Figyelő trigger blokkoknál a scope részletei is látszanak és szerkeszthetők.
- Domain/path/pontos URL/URL tartalmazza mezők közvetlenül a blokkban és a jobb oldali beállításokban is elérhetők.
- A jobb oldali panelen megjelenik az aktuális scope összefoglalója.
- Gyors gomb: jelenlegi oldal domain/path/URL adatainak kitöltése.

## Telepítés

1. Chrome: chrome://extensions
2. Developer mode bekapcsolása
3. Load unpacked
4. A kicsomagolt mappa kiválasztása


## v0.19
- Régi Figyelő: szöveg / Figyelő: elem blokkok automatikus migrációja új Figyelő trigger + feltétel modellre.
- Új figyelő feltételblokkok: szöveg, elem, mezőérték, URL.
- Figyelő trigger logika: minden / bármelyik / egyik sem.
- Builder felső gombsora ikonokat kapott.


## v0.20
- Extension context invalidated hiba elleni védelem a content script watcher loopban.
- Új blokk: Felhasználói üzenet, amely felugró ablakot mutat és opcionálisan visszajelzésre vár.
- Új blokk: Rendszerértesítés, amely Chrome rendszerértesítést küld.

## v0.22
- Az Adat kinyerése blokk alapértelmezetten a teljes DOM-ban keres, rejtett / inaktív fülön lévő mezőkben is.
- Stabilabb mezőfelismerés BMC/Remedy/WTTS jellegű oldalakon: id, konténer id, arid, ardbn, label-for, label közeli mező és CSS fallback.
- Új kinyerési módok: automatikus, mezőérték, szöveg, HTML, attribútum.
- Robusztusabb értékkiolvasás: input, textarea, select, checkbox/radio, contenteditable, title, aria-label és placeholder fallback.
- A Figyelő mezőérték feltételei is tudnak rejtett DOM mezőkből olvasni.
