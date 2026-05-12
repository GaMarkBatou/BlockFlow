# BlockFlow Chrome Extension MVP v0.9

Lokális Chrome extension weboldali automatizmusokhoz.

## Fő funkciók

- Popup gyorsindító
- Chrome side panel
- Külön ablakban nyíló Builder
- Blokkos workflow szerkesztő
- Elemkiválasztás hover kerettel
- Import / export
- Validáció és dry-run
- Futási napló
- If / else és repeat konténerblokkok
- Watcher-trigger workflow automatikus indítással
- Domain / path / exact URL / URL-részlet alapú watcher scope
- Felhasználóbarát watcher szerkesztő popupok nélkül
- Felhasználóbarát email sablon szerkesztő popupok nélkül
- Maszkolás blokk karakter- vagy soralapú adat maszkoláshoz

## Maszkolás blokk

A blokk egy forrás szöveget vagy változót kap, például `{{email}}`, majd új változóba menti a maszkolt eredményt.

- Karakter alapú: első/utolsó N karakter meghagyása, köztes rész maszkolása.
- Sor alapú: első/utolsó N sor meghagyása, köztes sorok helyettesítése.

## Watcher

A watcher csak nyitott, normál weboldal tabon fut stabilan. Chrome belső oldalakon és tiltott oldalakon a content script korlátai miatt nem fut.

## Telepítés

1. Csomagold ki a ZIP-et.
2. Nyisd meg: `chrome://extensions`.
3. Kapcsold be a Developer mode-ot.
4. Load unpacked.
5. Válaszd ki a kicsomagolt mappát.

## v0.10

- A Watcher panel kompakt lett: rövid lista látszik a jobb oldalon, részletes szerkesztés modal ablakban történik.
- Az Email sablon panel kompakt lett: rövid lista + külön nagy szerkesztőablak.
- A korábbi `Elem kiválasztása az oldalról` útvonal változatlan maradt.
