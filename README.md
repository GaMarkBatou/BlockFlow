# BlockFlow Automation

BlockFlow egy lokális, vizuális Chrome/Chromium böngészőautomatizáló extension. Általános weboldalakon használható kattintások, mezőkitöltések, adatkinyerések, figyelők, riportok, email-előkészítések és felhasználói visszajelzéses folyamatok összeállítására programozás nélkül.

A projekt célja, hogy ismétlődő adminisztrációs és ellenőrzési feladatokat blokkos felületen lehessen felépíteni, tesztelni, exportálni és szükség esetén önálló mini extensionként futtatni.

## Fő tulajdonságok

- Vizuális, blokkos workflow-szerkesztő.
- Manuális, figyelő, időzített és kattintás-alapú indítás.
- Oldalelem-kiválasztás hover kerettel.
- Kattintás, kitöltés, görgetés, várakozás, URL megnyitás.
- Adatkinyerés látható és rejtett DOM-elemekből.
- Szövegkeresés oldalon, dinamikus/virtualizált listákban is.
- Feltételcsoportok, értékváltozás-figyelés, try/catch jellegű hibakezelés.
- Email összeállítás `mailto:` alapon, automatikus küldés nélkül.
- PDF és DOCX riportkészítés begyűjtött adatokból és képernyőképekből.
- Screenshot, hangjelzés, rendszerértesítés, oldalba illesztett gomb.
- Record mód egyszerű workflow-váz rögzítéséhez.
- Public log: oldalon látható, letölthető futási napló debughoz.
- Import/export, default automatizmusok, mini extension export.
- Modern webapp-kompatibilitási fejlesztések React/Vue/Angular/ServiceNow jellegű rendszerekhez.

## Adatkezelés és működési elv

A BlockFlow lokálisan működik. Nem használ AI-t, és nem küld workflow-adatokat külső szolgáltatásnak.

Tárolt adatok:

- workflow-k;
- sablonok;
- beállítások;
- lokális változók;
- feltöltött hangok;
- default import állapota;
- futási/ellenőrzési metaadatok.

Ezek a böngésző extension storage-ában vagy nagyobb lokális adatok esetén böngészőoldali lokális tárolásban maradnak.

## Telepítés fejlesztői módban

1. Csomagold ki az extension ZIP-fájlt.
2. Nyisd meg a böngésző extension-kezelő oldalát.
3. Kapcsold be a fejlesztői módot.
4. Válaszd a kicsomagolt extension betöltését.
5. Tallózd be a kicsomagolt extension mappáját.
6. Frissítsd újra azokat a céloldalakat, amelyeken automatizmust szeretnél futtatni.

Megjegyzés: frissítés után érdemes bezárni és újranyitni a Builder ablakot is, hogy biztosan az aktuális fájlok fussanak.

## Gyors kezdés

1. Nyisd meg a Buildert az extension popupból.
2. Hozz létre új automatizmust.
3. Válassz indítót: manuális indítás, figyelő trigger, időzített indítás vagy kattintás trigger.
4. Adj hozzá műveleti blokkokat.
5. Válassz ki oldalelemeket a céloldalról, ha szükséges.
6. Használj változókat `{{valtozo_nev}}` formában.
7. Ellenőrizd vagy futtasd dry-run módban.
8. Mentsd az automatizmust.
9. Aktiváld a figyelőt, vagy futtasd manuálisan.

## Fő felületek

### Popup

Az extension ikonjára kattintva megjelenő kis vezérlő. Innen megnyitható a Builder, a Sidebar, illetve elindítható a kiválasztott workflow.

### Builder

A fő szerkesztőfelület. Három fő részből áll:

- bal oldalon automatizmuslista és blokkpaletta;
- középen az aktuális workflow blokklistája;
- jobb oldalon a kiválasztott blokk beállításai, változók, ellenőrzés, sablonok, verziók, napló és import-előnézet.

A blokkpaletta kategóriái összecsukhatók, a blokkbeszúrás a kijelölt blokk után történik, ha van aktív kijelölés.

### Sidebar

Gyorsabb futtatásra és használatra szolgál, amikor nincs szükség a teljes Builder megnyitására.

## Blokk-kategóriák

A palettában a blokkok funkció szerint csoportosítva jelennek meg. A főbb kategóriák:

- Indítás
- Figyelő feltételek
- Műveletek
- Adatkinyerés / Adat
- Logika
- Felhasználó
- Email
- PDF
- DOCX
- Táblázat
- Popup / új ablak
- Haladó

## Fontosabb funkciók röviden

### Indítók

- **Indítás**: kézi futtatás.
- **Figyelő trigger**: feltételek alapján automatikusan indul.
- **Időzített indítás**: időközönként vagy időpontra.
- **Kattintás trigger**: akkor indul, amikor a felhasználó egy kiválasztott oldalelemen kattint.

### Figyelők

A figyelők képesek szöveget, elemet, mezőértéket, URL-t vagy értékváltozást figyelni. Feltételcsoportokkal összetett logika is építhető.

### Adatfolyam és változók

A blokkok változókat állíthatnak elő. A változók `{{valtozo}}` formában használhatók emailben, PDF-ben, DOCX-ben, értesítésben, CSS-ben, URL-ben és több blokk beállításaiban.

Általános futási változók:

- `{{current_url}}`
- `{{today}}`
- `{{selected_text}}`
- `{{last_result}}`
- `{{last_text}}`
- `{{last_value}}`
- `{{last_selector}}`
- `{{last_xpath}}`
- `{{last_element}}`
- `{{last_screenshot}}`

### Modern webapp-kompatibilitás

A rendszer több olyan megoldást tartalmaz, amely segíti a React/Vue/Angular/ServiceNow jellegű dinamikus oldalak kezelését:

- framework-kompatibilis mezőkitöltés;
- input/change/blur események;
- szimulált gépelés;
- SPA navigáció figyelése;
- Shadow DOM keresés;
- belső görgethető konténerek kezelése;
- virtualizált táblázatok/listák görgetéses keresése;
- label/ARIA/data attribútum alapú elemkeresés.

### Public log

Workflow-szinten bekapcsolható. Futás közben az oldalon egy izolált, félig áttetsző naplópanel jelenik meg, amely mutatja a blokkok futását, az átadott értékeket, találatokat, selectorokat és hibákat. A napló TXT-ként letölthető.

### Mini extension export

Egy kész workflow külön, Builder nélküli mini extensionként exportálható. A generált extension csak a futtatáshoz szükséges workflow-t és runner logikát tartalmazza, szerkesztőfelületet nem.

### Default automatizmusok

Az extension tartalmazhat `default.json` fájlt. Ez a meglévő import/export formátummal kompatibilis. Új telepítésnél, ha még nincs workflow, a default automatizmusok automatikusan betöltődhetnek.

## Ismert korlátok

- Böngésző belső oldalain és tiltott extension-területeken content script nem fut.
- Cross-origin iframe tartalma böngészőbiztonsági okból nem mindig hozzáférhető.
- Screenshot csak aktív/látható tabról készíthető.
- `mailto:` viselkedése függ az operációs rendszertől és az alapértelmezett levelezőprogramtól.
- Automatikus emailküldés nincs és szándékosan nem része a működésnek.
- Dinamikus/virtualizált listákban a keresés csak a betöltött vagy görgetéssel elérhető elemekre támaszkodhat.
- Céges böngészőpolicy korlátozhatja a vágólap, értesítés, fejlesztői mód vagy extension-telepítés működését.

## Változásnapló

### v0.58

- Public log megjelenítési javítás: a panel Shadow DOM-mal izolált lett, így az oldal CSS-e nem tudja összenyomni vagy elrontani.
- Stabil minimális magasság, külön fejléc, naplótest és TXT letöltési gomb.
- A public log panel megjelenése dinamikus/összetett oldalakon is stabilabb lett.

### v0.57

- Public log funkció bevezetése workflow-szintű kapcsolóval.
- Futás közben az oldalon jobb oldali, félig áttetsző naplópanel jelenik meg.
- A napló mutatja a blokkok futását, átadott értékeket, selectorokat, találatokat, hibákat és a futás végét.
- TXT debug log letöltése bekerült.
- Felhasználói interakciós ablakok minimális testreszabása: ablakstílus, kiemelő szín, méret.
- Központi blokk-meta / output rendszer alapja bekerült.
- Import audit és verzió panel képességlistával és blokk-szám diff jelzéssel bővült.
- Blokk tesztelése több adatkinyerő blokknál részletesebb eredményt ad.

### v0.56

- Átfogó minőségi audit és stabilitási javítások.
- Görgetés blokk beállítás-renderelési hiba javítva.
- Numeric mezők egységesebb kezelése.
- Workflow-váltáskor kevesebb felesleges mentés és storage-írás történik.
- Változó chipek vágólapra másolása hibatűrőbb lett.
- Validáció bővült hiányzó célok és kötelező értékek felismerésével.
- Szövegkeresés találati kontextusának feldolgozása hatékonyabb lett.
- Mező keresése címke alapján blokk jobban tölti a `last_*` változókat.

### v0.55

- Javítva az Oldalba illesztett gomb beállításainál előforduló `targetPickerHtml is not defined` hiba.
- Cél elem választó kompatibilitási alias bekerült a régi és új inspector hívásokhoz.

### v0.54

- Oldalba illesztett gomb elem elé / elem után elhelyezése javítva.
- A felesleges „csak jelenítse meg” mód kikerült.
- Új Custom elhelyezés: bal/jobb/felső/alsó távolság px/% egységgel és z-index beállítással.

### v0.53

- Új **Felhasználó** blokk-kategória.
- Ide kerültek a felhasználói interakciós blokkok: Felhasználói üzenet, Oldalba illesztett gomb, Adat bekérése, Választás kérése, Rendszerértesítés, Hangjelzés.
- Az Oldalba illesztett gomb láthatóvá vált a blokkpalettában.

### v0.52

- Új blokk: **Várj betöltésre**.
- Támogatott módok: automatikus, oldal betöltődött, DOM stabil, spinner eltűnt, kiválasztott elem megjelent, kiválasztott elem kattintható.
- Timeout és timeout esetén folytatás/leállás opciók.

### v0.51

- Új blokk: **Oldalba illesztett gomb**.
- A workflow várhat arra, hogy a felhasználó az aktuális oldalon megjelenő gombra kattintson.
- Támogatott elhelyezések: sarkok, középen alul, kiválasztott elem elé/után.
- Eredményváltozók: kattintott-e, kattintás ideje.

### v0.50

- `default.json` támogatás alapértelmezett automatizmusokhoz.
- A default fájl kompatibilis a meglévő import/export formátummal.
- Első induláskor, üres workflow-lista esetén automatikusan betölthetők az alap automatizmusok.

### v0.49

- Új indító blokk: **Kattintás trigger**.
- A workflow akkor indulhat, amikor a felhasználó egy kiválasztott oldalelemen kattint.
- URL megnyitása blokk ellenőrizve és dokumentálva a Műveletek kategóriában.
- Kattintás trigger támogatás bekerült a mini extension exportba is.

### v0.48

- Edge alatt stabilabb Builder workflow-váltás.
- A workflow-váltás először memóriában történik, a storage mentés nem blokkolja a UI-váltást.
- Importált workflow „nem ellenőrzött” jelzése sikeres ellenőrzés, dry-run, futtatás vagy kényszerített futtatás után eltűnik.
- Módosítás után a workflow újra ellenőrizetlen állapotba kerülhet.

### v0.47

- Új blokk: **CSS injektálása**.
- CSS hozzáadása/frissítése/eltávolítása az aktuális oldalba azonosító alapján.
- Változók használhatók a CSS szabályokban is.

### v0.46

- README átrendezése és változásnapló tisztítása.
- Funkciók témakörökbe rendezve.
- Verziókhoz tartozó változások pontosabb csoportosítása.

### v0.45

- DOCX fájlnévkezelés javítva: a DOCX mentése blokk nem írja felül indokolatlanul a DOCX indítása blokkban megadott fájlnevet.
- Csoport blokk inaktív állapota futáskor is érvényesül: a kikapcsolt csoport blokkjai kimaradnak.

### v0.44

- Vágólapról beolvasás blokk javítva.
- Többlépcsős vágólapolvasás: Clipboard API, legacy fallback, extension segédablak.
- Mini extension export tartalmazza a vágólap-beolvasó segédfájlokat.

### v0.43

- Csoport blokk csoportszintű ki/bekapcsolást kapott.
- Csoport blokk összecsukható lett.
- Összecsukott csoport alatt a benne lévő blokkok ikonjai láthatók.

### v0.42

- PDF előnézeti megjelenítés javítása: saját iframe/object preview oldal kikerült.
- Előnézet közvetlen PDF blobként nyílik meg.
- Letöltés és Letöltés + előnézet mód a megadott fájlnévvel ment.

### v0.41

- Mini extension export ZIP-generálása javítva.
- DOCX riportkészítés bekerült.
- Új DOCX blokkok: indítás, szöveg, táblázat, screenshot/kép, új oldal, mentés.
- PDF előnézet fájlnévkezelési kísérlet bekerült, amelyet később egyszerűbb preview-működés váltott fel.

### v0.40

- Próbáld meg / hiba esetén blokk drop-kezelése javítva.
- Szöveg keresése az oldalon dinamikus/virtualizált oldalon görgetéssel is kereshet.
- Görgetés blokk új módot kapott: Görgetés szövegig.

### v0.39

- Javítva az `options.map is not a function` típusú Builder betöltési hiba.
- Select renderelés védelmet kapott hibás opciólista esetére.
- Régi Record-blokkok normalizálása erősebb lett.
- Record gomb rövidült: Rec.

### v0.38

- Görgetés blokk belső görgethető konténer támogatást kapott.
- Kattintás blokk okos auto-scrollt és kattintható szülő fallbacket kapott.
- Várj amíg blokk új módokkal bővült: elem eltűnik, elem látható/kattintható, mezőérték változik, URL változik, spinner eltűnik, DOM stabil.
- Szöveg keresése blokk találati sor, kattintható szülő, panel/kártya és közeli gomb selectorokat ad vissza.
- Táblázatból kinyerés fejlécnév alapján is tud oszlopot választani.
- Legördülő opció kiválasztása opciólista-görgetést és egyezési módokat kapott.
- Új blokk: Hibaüzenet keresése.
- Új blokk: Mező keresése címke alapján.
- Same-origin iframe támogatás javítva.

### v0.37

- Record által létrehozott blokkok normál blokksémával jönnek létre.
- Rögzített blokkok szerkeszthetők, mozgathatók és törölhetők.
- Régi Record jelölések automatikusan tisztulnak.

### v0.36

- Palettából kattintással hozzáadott blokk a kijelölt blokk után kerül.
- Konténeren belüli beszúrás ugyanabba a behúzott szintbe történik.
- Figyelő feltételeknél a beszúrás a trigger/feltételcsoport kontextusát követi.

### v0.35

- ServiceNow/SNOW és modern webapp kompatibilitási erősítés.
- Framework-kompatibilis kitöltés bekerült.
- Kitöltési módok: framework-kompatibilis, egyszerű, szimulált gépelés, paste jellegű mód.
- SPA navigáció figyelése: `pushState`, `replaceState`, `popstate`, `hashchange`.
- Shadow DOM keresés több blokkban.
- Új blokk: Legördülő opció kiválasztása.
- ServiceNow/SNOW jellegű attribútumok jobb kezelése: `aria-label`, `role`, `data-testid`, `data-field`, `data-name`.
- Virtualizált lista/tábla támogatás első lépése.

### v0.34

- Mini extension export kezeli a Másik automatizmus futtatása blokkok függőségeit.
- Meghívott workflow-k rekurzívan bekerülnek a mini extensionbe.
- Meghívott workflow-k alfolyamatként érhetők el a generált mini extensionben.

### v0.33

- Record mód bevezetése.
- Record UI a középső munkaterület tetején jelenik meg.
- Rögzíthető: kattintás, mezőkitöltés, select/checkbox változás, Enter/Tab/Escape, hosszabb szünetek.
- Jelszó vagy érzékenynek tűnő mezők értékét a recorder nem menti el konkrétan.

### v0.32

- Mini extension export bekerült.
- Hangjelzés blokk saját feltöltött hanggal, hangerővel és ismétlésszámmal bővült.
- Táblázatból kinyerés blokk N. sor opciót kapott.
- Maszkolás blokk Clear / trim móddal bővült.

### v0.31

- Szöveg keresése → Kattintás flow javítva.
- Szöveg keresése blokk kattintáshoz/görgetéshez használható selector kimenetet ad.
- Kattintás validáció elfogadja a dinamikus selector/XPath/elem változókat.

### v0.30

- Blokkpaletta kategóriái összecsukhatók lettek.
- Szöveg keresése blokk elemhivatkozást, selectort és XPath-et ad tovább.
- Általános utolsó eredmény változók bekerültek: `{{last_result}}`, `{{last_text}}`, `{{last_value}}`, `{{last_selector}}`, `{{last_xpath}}`, `{{last_element}}`, `{{last_screenshot}}`.
- Új blokk beszúrásakor több esetben automatikus előkitöltés történik az előző blokk kimenete alapján.

### v0.29

- Új blokk: Szöveg keresése az oldalon.
- Változó chipek kattinthatók lettek a jobb oldali panelen.
- Blokkmozgató gombok kontextusfüggő megjelenítést kaptak.
- Builder és jobb oldali beállítási sáv szélesebb lett.
- README teljesebb dokumentációt kapott.

### v0.28

- Jobb oldali Beállítások panel blokkfüggő magyarázatokat kapott.

### v0.27

- Figyelő feltételcsoport bekerült.
- PDF kategória és PDF riportkészítő blokkok bekerültek.

### v0.26

- Futtatás gomb figyelembe veszi a Figyelő trigger feltételeit.
- Kényszerített futtatás gomb bekerült debug/teszt használatra.

### v0.25

- Új feltétel: Érték változik.
- Támogatott módok: miről → mire, bármiről → mire, miről → bármire, bármilyen változás.
- Előző érték session-alapú tárolása workflow/trigger/feltétel/URL kontextusban.

### v0.24

- Képernyőkép blokk javítva.
- Email megnyitása nem viszi el tartósan a fókuszt a cél tabról.
- Blokkok legfelülre / legalulra mozgató gombokat kaptak.

### v0.23

- Több új adat-, weboldal-, felhasználói, táblázat-, logikai, popup- és időzítési blokk bekerült.
- Időzített indítás bekerült.

### v0.22

- Adat kinyerése blokk robusztusabb lett.
- Teljes DOM-ban, rejtett/inaktív fülön lévő mezőkben is tud keresni.
- Erősebb elemfelismerés ID, container, label, attribútum és technikai mezőazonosítók alapján.

### v0.21

- Extension context invalidated hiba elleni további védelem.
- Felhasználói üzenet blokk saját extension ablakot használ.

### v0.20

- Safe storage/runtime wrapper és watcher-leállítás extension reload esetére.
- Felhasználói üzenet blokk bekerült.
- Rendszerértesítés blokk bekerült.

### v0.19

- Figyelő feltételblokkok behúzása a Figyelő trigger alá javítva.

### v0.18

- Régi figyelő blokkok migrálva új Figyelő trigger + feltétel modellre.
- Builder felső gombok ikonokat kaptak.

### v0.17

- Figyelő storage tisztítása workflow mentéskor.
- Inaktív figyelő nem kerül watcher storage-ba.
- Mentve / Nem mentett módosítás jelzés bekerült.
- Új workflow-nál kötelező indítót választani.

### v0.16

- Figyelő scope részletei láthatóbbak lettek.

### v0.15

- Indítóblokkok egyenértékűek lettek.
- Jobb oldali panel betöltési hibái javítva.

### v0.14

- Toolbar popup összeomlása javítva.

### v0.13

- Fő beállítások több blokknál középről is szerkeszthetők.
- Builder három külön görgethető területre osztva.

### v0.12

- Watcher logika Figyelő trigger modell felé rendezve.
- Maszkolás invert módot és üres maszk támogatást kapott.

### v0.11

- Email sablonkártyák gombjai külön sorba kerültek.

### v0.10

- Watcher és email sablon panel kompaktabb lett.

### v0.9

- Watcher és email sablon felülete felhasználóbarátabb lett.
- Maszkolás blokk bekerült.

### v0.8 és korábbi főbb lépések

- Alap Chrome extension felépítés: popup, sidebar, Builder.
- Blokkos workflow szerkesztő.
- Oldalelem-kiválasztó hover kerettel.
- Kattintás, adatkinyerés, beillesztés, várakozás, ismétlés és email alapfunkciók.
- Builder külön ablakos működése.
- Import/export alapok.
