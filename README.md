# BlockFlow Automation MVP 0.42

BlockFlow egy lokális Chrome extension, amellyel általános weboldalakon lehet böngészőautomatizmusokat összeállítani vizuális, blokkos felületen. A cél az, hogy a gyakori adminisztrációs, adatgyűjtési, email-előkészítési, figyelési és riportkészítési folyamatokat programozás nélkül lehessen felépíteni.

Az extension nem használ AI-t és nem küld adatot külső szolgáltatásnak. A workflow-k, sablonok, lokális adatok és beállítások a Chrome extension storage-ban maradnak.

## Mire hasznos?

- weboldali mezők adatainak kinyerése
- űrlapmezők kitöltése, kattintások automatizálása
- oldalak figyelése szöveg, elem, mezőérték, URL vagy értékváltozás alapján
- feltételes automatizmusok építése
- email sablon összeállítása és mailto ablak megnyitása
- hosszú email törzs vágólapra másolása
- screenshot készítése
- PDF riport összeállítása begyűjtött adatokból és képernyőképekből
- DOCX / Word riport készítése begyűjtött adatokból és screenshotokból
- felhasználói visszajelzés kérése futás közben
- rendszerértesítés küldése
- lokális adatok mentése és visszaolvasása

## Telepítés fejlesztői módban

1. Csomagold ki a ZIP fájlt.
2. Nyisd meg: `chrome://extensions`.
3. Kapcsold be a Developer mode / Fejlesztői mód kapcsolót.
4. Kattints a **Load unpacked** gombra.
5. Válaszd ki a kicsomagolt `blockflow-extension-v0.32` mappát.
6. Frissítsd újra a már nyitott céloldalakat, hogy az új content script biztosan betöltődjön.

## Fő felületek

### Toolbar popup

Az extension ikonjára kattintva megjelenik egy kis popup, ahonnan megnyitható:

- Builder
- Sidebar
- kiválasztott workflow futtatása

### Builder

A Builder a fő szerkesztőfelület. Külön ablakban nyílik meg, hogy kényelmesebb legyen a workflow építése. A v0.32-ben a Builder alapértelmezett szélessége nagyobb lett, a jobb oldali beállítási sáv pedig kényelmesebben olvasható.

A Builder három fő részből áll:

- bal oldalon: automatizmuslista és blokkpaletta
- középen: az aktuális workflow blokklistája
- jobb oldalon: beállítások, változók, ellenőrzés, figyelők, sablonok, verziók és napló

### Sidebar

A Sidebar gyorsabb futtatásra és használatra való, amikor nem akarod a teljes Buildert megnyitni.

## Workflow indítása

Új automatizmus létrehozásakor először indítóblokkot kell választani. Alapértelmezett blokk nem kerül automatikusan a workflow-ba.

Támogatott indítók:

- **Indítás**: kézi futtatáshoz
- **Figyelő trigger**: automatikus indításhoz feltételek alapján
- **Időzített indítás**: időközönként vagy napi időpontban

Ha egy workflow csak Figyelő triggerrel indul, akkor a normál **Futtatás** gomb is ellenőrzi a figyelő feltételeket. Ha a feltétel nem igaz, a műveletek nem futnak le. Teszteléshez használható a **Kényszerített futtatás**, amely átugorja az indítófeltételeket.

## Figyelő trigger és figyelő feltételek

A Figyelő trigger automatikusan ellenőrzi az oldalt, és csak akkor indítja a workflow-t, ha a benne lévő feltételek teljesülnek.

Feltételek:

- **Feltétel: szöveg**: szöveg/karakter megjelenik az oldalon
- **Feltétel: elem**: elem létezik vagy látható
- **Feltétel: mezőérték**: input/textarea/select vagy más elem értéke megfelel egy feltételnek
- **Feltétel: URL**: az aktuális URL tartalmaz, pontosan egyezik, kezdődik vagy végződik valamivel
- **Feltétel: érték változik**: előző figyelési körből a jelenlegi körre adott irányú változás történik
- **Feltételcsoport**: logikai csoport a Figyelő triggeren belül

A Figyelő trigger saját logikája lehet:

- minden feltétel igaz
- bármelyik feltétel igaz
- egyik feltétel sem igaz

A Feltételcsoport ugyanezeket tudja, és trigger alá vagy másik feltételcsoport alá húzható. Így ilyen logika is építhető:

```text
Figyelő trigger
  Status változik: ebből → abba
  Feltételcsoport: bármelyik igaz
    Mező tartalmazza Eggyik
    Mező tartalmazza Másik
```

Ez azt jelenti, hogy a workflow csak akkor indul, ha a státuszváltozás megtörtént, és közben a CBI mező High vagy Critical értéket tartalmaz.

## Blokkok mozgatása

A használt blokkoknál a mozgatógombok kontextusfüggők. Csak azok a gombok jelennek meg, amelyek az adott helyzetben használhatók.

Példák:

- legfelső blokknál nincs felfelé mozgatás
- legalul lévő blokknál nincs lefelé mozgatás
- figyelőfeltétel nem húzható ki érvénytelen főszintre
- konténeren belül a mozgatás az adott szinten történik

Ez csökkenti a félreérthető vagy érvénytelen műveleteket.

## Elem kiválasztása az oldalról

Több blokk használ oldalelem-kiválasztást:

- Kattintás
- Beillesztés / kitöltés
- Adat kinyerése
- Feltétel: elem
- Feltétel: mezőérték
- Feltétel: érték változik
- Görgetés
- Táblázatból kinyerés
- Popup/új ablak adatkinyerés

A kiválasztó a cél tabot fókuszálja, hover kerettel jelzi az aktuális elemet, majd stabil elemleírást ment. A kinyerésnél több azonosítót is használhat: ID, CSS selector, XPath, label, ARIA, title, valamint BMC/Remedy jellegű `arid`, `ardbn`, `WIN_...` mezőazonosítókat.

## Adat kinyerése

Az **Adat kinyerése** blokk képes:

- input/textarea/select érték olvasására
- látható szöveg olvasására
- HTML tartalom olvasására
- attribútum olvasására, például `title`, `aria-label`, `placeholder`
- teljes DOM-ban, akár rejtett vagy inaktív fülön lévő mezők között is keresni

Ez különösen hasznos olyan enterprise rendszereknél, ahol az oldal HTML-je már betöltődött, de az adat éppen nem látható aktív fülön.

## Szöveg keresése az oldalon

A v0.32-ben bekerült a **Szöveg keresése az oldalon** blokk. Ez egyszerű, regex nélküli keresésre való.

Beállítható:

- keresett szöveg
- tartalmazza vagy pontos egyezés
- kis/nagybetű érzékenység
- látható szövegben, teljes DOM-ban vagy teljes oldalon keressen
- input/textarea/select értékeket is figyeljen-e
- attribútumokat is figyeljen-e, például `title`, `aria-label`, `placeholder`, `alt`

Visszaadott változók:

- `{{szoveg_talalat}}`: true / false
- `{{szoveg_talalat_db}}`: találatok száma
- `{{szoveg_talalat_szoveg}}`: első találat környezete
- `{{szoveg_talalat_hely}}`: hol találta meg, például textarea value vagy attribútum: title
- `{{szoveg_talalat_selector}}`: CSS selector
- `{{szoveg_talalat_xpath}}`: XPath
- `{{szoveg_talalat_lista}}`: első találatok rövid listája

Ez akkor hasznos, ha egy oldalról nem konkrét mezőt akarsz kinyerni, hanem meg akarod tudni, hogy egy kifejezés hol szerepel.

## Adatkezelő blokkok

Elérhető adatblokkok:

- Változó beállítása
- Adat átalakítása
- Szövegrész kinyerése
- Regex keresés
- Szöveg keresése az oldalon
- Maszkolás
- Vágólapról beolvasás
- Lokális mentés
- Lokális beolvasás
- Összehasonlítás
- Számítás
- Adat validálása

A változókat `{{valtozonev}}` formában lehet használni. A jobb oldali Változók panelen a változó chipek kattinthatók: kattintásra a teljes `{{valtozonev}}` szöveg vágólapra kerül.

## Maszkolás

A Maszkolás blokk karakterek vagy sorok alapján tud adatot maszkolni.

Támogatott:

- karakteralapú maszkolás
- soralapú maszkolás
- invert maszkolás
- üres maszk karakter
- üres maszkolt sor szöveg

Így érzékeny adatok PDF vagy email előtt tisztíthatók.

## Email funkciók

Az extension nem küld emailt automatikusan.

Email blokkok:

- Email összeállítása
- Email sablon használata
- Email előnézet
- Email megnyitása

Az Email megnyitása blokk `mailto:` linket nyit. Ha az email törzse túl hosszú a mailto linkhez, akkor a törzs vágólapra kerül, és a levelező csak címzettel/tárggyal nyílik meg.

## PDF funkciók

A PDF kategória külön blokkcsoportként szerepel.

PDF blokkok:

- PDF indítása
- PDF szöveg hozzáadása
- PDF táblázat hozzáadása
- PDF screenshot hozzáadása
- PDF új oldal
- PDF mentése / előnézet

A PDF blokkokkal begyűjtött adatokból és screenshotokból riport készíthető. A blokkok támogatják a változókat, például:

```text
Ticket: {{ticket_id}}
Státusz: {{status}}
URL: {{current_url}}
```

PDF opciók:

- fájlnév
- A4 / Letter / Legal
- álló / fekvő tájolás
- margó
- betűméret
- fejléc / lábléc
- szövegstílus
- táblázatszegély
- screenshot méretezés
- letöltés / előnézet / letöltés + előnézet


## DOCX funkciók

A DOCX kategória szerkeszthető Word-riportok készítésére való.

DOCX blokkok:

- DOCX indítása
- DOCX szöveg hozzáadása
- DOCX táblázat hozzáadása
- DOCX screenshot / kép hozzáadása
- DOCX új oldal
- DOCX mentése

A DOCX blokkok a PDF blokkokhoz hasonlóan változókat használnak, de a végeredmény szerkeszthető `.docx` fájl.

## Felhasználói visszajelzés és értesítés

Blokkok:

- Felhasználói üzenet
- Adat bekérése
- Választás kérése
- Rendszerértesítés
- Hangjelzés

A visszajelzésre váró blokkok külön extension ablakot használnak, nem weboldalba injektált overlayt. Ez stabilabb, mert nem függ a weboldal CSS-étől.

## Képernyőkép

A Képernyőkép blokk a Chrome `captureVisibleTab` jellegű működésére épül, ezért csak az aktív/látható tabról tud képet készíteni.

Módok:

- előnézet új tabon
- PNG letöltés
- vágólapra másolás
- csak változóba mentés


## Record mód

A Builder középső munkaterületének tetején, az automatizáció neve mellett található a **Record** gomb. Record indításakor a céloldalon végzett alapműveletek workflow-vázzá alakulnak.

Rögzített műveletek:

- kattintás
- mezőkitöltés / select / checkbox változás
- Enter, Tab, Escape billentyű
- hosszabb szünetekből egyszerű Várakozás blokk

Record közben csak a **Pause** és **Stop** gombok jelennek meg. Stop után a rögzített műveletekből szerkeszthető blokkok készülnek. Jelszó vagy érzékenynek tűnő mezők értékét a recorder nem menti el konkrét szövegként.

## Futtatásbiztonság és hibakezelés

A workflow-k validálhatók futtatás előtt. A napló jelzi, melyik blokk futott, és hiba esetén hol akadt el.

A figyelő storage szinkronizálása úgy működik, hogy mentéskor az adott workflow régi watcher rekordjai törlődnek, és csak az aktív figyelő blokkokból jönnek létre új figyelők.

Az extension reload/frissítés utáni régi content script példányok csendesen leállítják a figyelő loopot, így az `Extension context invalidated` hiba nem ismétlődik folyamatosan.

## Import / export / verziók

Támogatott:

- egy workflow exportálása
- teljes export
- import
- import előnézet
- ellenőrzött / nem ellenőrzött jelzés
- mentett verziók visszaállítása

Importált workflow futtatása előtt javasolt ellenőrzést és dry-runt használni.


## v0.41 újdonságok

- A **Próbáld meg / hiba esetén** blokkba most már húzhatók blokkok mind a próbálkozási, mind a hibaágba.
- A **Szöveg keresése az oldalon** blokk opcionálisan görgetéssel is keres dinamikus vagy virtualizált oldalakon. Több körben görgeti az oldalt vagy a kiválasztott/belső görgethető konténert, majd minden kör után újraolvassa a DOM-ot.
- A **Görgetés** blokk új **Görgetés szövegig** móddal bővült, amely addig görget, amíg a megadott szöveg meg nem jelenik, vagy el nem éri a megadott próbálkozási limitet.

## Fejlesztési út

A projekt fejlesztése több lépésben épült fel:

1. alap Chrome extension: popup, sidebar, Builder
2. blokkos workflow szerkesztő
3. elemkiválasztó az oldalról
4. adatkinyerés, kattintás, beillesztés, email összeállítás
5. figyelő triggerek és automatikus indítás
6. watcher storage stabilizálás és mentési szinkron
7. Apple Shortcuts-szerű blokk-kártyák
8. figyelő trigger konténer és feltételblokkok
9. értékváltozás figyelése előző/jelenlegi állapot alapján
10. felhasználói visszajelző extension ablak
11. rendszerértesítés, hangjelzés, felhasználói adatbekérés
12. robusztusabb DOM-alapú adatkinyerés rejtett mezőkből is
13. sok új adat-, logika-, popup-, email- és PDF blokk
14. PDF riportkészítés adatokból és screenshotokból
15. jobb oldali magyarázó beállítási panel
16. v0.32: kattintható változó chipek, kontextusfüggő blokkmozgató gombok, szélesebb Builder, Szöveg keresése az oldalon blokk helyvisszaadással

## Ismert korlátok

- Chrome belső oldalakon, Chrome Web Store oldalon és tiltott oldalaknál content script nem fut.
- Cross-origin iframe tartalma böngészőbiztonsági okból nem mindig olvasható.
- Screenshot csak aktív/látható tabról készíthető.
- `mailto:` viselkedése függ az operációs rendszertől és az alapértelmezett levelezőprogramtól.
- Automatikus emailküldés nincs és szándékosan nem része a működésnek.

## Javasolt használati minta

1. Hozz létre új automatizmust.
2. Válassz indítást: Indítás, Figyelő trigger vagy Időzített indítás.
3. Válaszd ki az oldalról a szükséges elemeket.
4. Nyerd ki az adatokat változókba.
5. Tisztítsd, maszkoljad vagy validáld az adatokat.
6. Építs emailt vagy PDF riportot.
7. Ellenőrizd a workflow-t.
8. Futtasd dry-run módban.
9. Ha rendben van, futtasd élesben vagy aktiváld a figyelőt.


## v0.32 újdonságok

- Mini extension export: kész workflow-ból Builder nélküli, önálló futtató extension ZIP generálása.
- Hangjelzés blokk saját feltöltött hanggal, hangerővel és ismétléssel.
- Táblázatból kinyerés blokk N. sor opcióval.
- Maszkolás blokk Clear / trim móddal, amikor a maszkolandó rész törlődik.


## v0.34 kiegészítés

A Mini extension export most már kezeli a **Másik automatizmus futtatása** blokkokat. Exportáláskor az aktuális automatizmus mellé bekerülnek a meghívott automatizmusok is, rekurzívan. Így ha egy workflow egy másik workflow-t alfolyamatként hív meg, a generált mini extension önállóan is megtalálja és le tudja futtatni a meghívott automatizmust.

A mini extension továbbra sem tartalmaz Buildert, Sidebar-t vagy szerkesztőfelületet; csak a beégetett automatizmusokat és a futtatáshoz szükséges runtime-ot. A fő automatizmus figyelői és időzítői regisztrálódnak automatikusan, a meghívott workflow-k alfolyamatként kerülnek a csomagba.


## v0.35 kompatibilitási fejlesztések

A v0.35 fő célja a modern webappok és a ServiceNow / SNOW jellegű jegykezelő felületek stabilabb kezelése.

Újdonságok:

- **Framework-kompatibilis kitöltés** a Beillesztés / kitöltés blokkban. A blokk már nem csak egyszerűen beírja az értéket, hanem React/Vue/Angular/SNOW jellegű felületeknél is hasznos `input`, `change` és `blur` eseményeket küld.
- **Kitöltési módok**:
  - framework-kompatibilis értékadás
  - egyszerű értékadás
  - szimulált gépelés
  - paste esemény jellegű mód
- **Szimulált gépelés** érzékeny mezőkhöz, ahol a sima értékadás nem frissíti a webapp belső állapotát.
- **SPA navigáció figyelése**: a figyelők érzékelik a `pushState`, `replaceState`, `popstate` és `hashchange` alapú oldalváltásokat is. Ez fontos single-page appoknál.
- **Shadow DOM keresés**: az elemkereső több helyen képes shadow DOM alatt is keresni, például kattintásnál, kitöltésnél, adatkinyerésnél és szövegkeresésnél.
- **Minden művelet előtt újrakeresés**: a futtatás nem régi DOM node-ra épít, hanem a mentett selector/descriptor alapján újrakeresi az elemet. Ez hasznos újrarenderelő React/Vue/Angular/SNOW felületeknél.
- **Új blokk: Legördülő opció kiválasztása**. Custom, div-alapú vagy modern komponens-alapú dropdownokhoz készült. Először megnyitja a legördülőt, majd szöveg alapján megkeresi és kiválasztja az opciót.
- **ServiceNow/SNOW jellegű attribútumok jobb kezelése**: az elemfelismerés figyel több modern attribútumot is, például `aria-label`, `role`, `data-testid`, `data-test-id`, `data-field`, `data-name`.
- **Virtualizált lista/táblázat támogatás első lépése**: a Táblázatból kinyerés blokkban bekapcsolható görgetéses keresés, amikor a keresett sor nem található az aktuálisan látható DOM-részben.

Ezek a fejlesztések különösen hasznosak ServiceNow klasszikus és modern felületein, Agent/Workspace jellegű nézetekben, valamint React, Vue, Angular vagy web component alapú belső rendszereken.


## v0.41 javítások

A blokkpalettából kattintással hozzáadott új blokk most már nem automatikusan a workflow végére kerül. Ha van kijelölt blokk, az új blokk közvetlenül a kijelölt blokk után lesz beszúrva ugyanazon a szinten. Ha nincs kijelölt blokk, a korábbi működés marad: az új blokk a workflow végére kerül.

Figyelő feltételeknél a beszúrás a Figyelő trigger vagy Feltételcsoport kontextusát követi: meglévő feltétel kijelölésekor az új feltétel utána kerül, Figyelő trigger vagy Feltételcsoport kijelölésekor pedig annak belsejébe kerül. A drag-and-drop működés továbbra is a húzással megadott célhelyet használja.


## v0.40 javítás

- A Record mód által létrehozott blokkok mostantól teljesen normál blokkokként kerülnek be a workflow-ba.
- A rögzített blokkok szerkeszthetők, mozgathatók és törölhetők ugyanúgy, mint a kézzel hozzáadott blokkok.
- Régebbi Record-blokkokból a csak vizuális `recorded` jelölés automatikusan eltávolításra kerül megnyitáskor.


## v0.40 újdonságok

- Görgetés blokk belső görgethető konténer támogatással: automatikus, teljes oldal, legközelebbi konténer vagy kézzel kiválasztott konténer.
- Kattintás előtt okos auto-scroll és kattintható szülő fallback.
- Várj amíg blokk új módokkal: elem eltűnik, elem látható/kattintható, mezőérték változik, URL változik, spinner eltűnik, DOM stabil.
- Szöveg keresése blokk több kontextust ad vissza: találati sor, kattintható szülő, panel/kártya és közeli gomb selector.
- Táblázatból kinyerés fejlécnév alapján is tud oszlopot választani, és erősebb virtualizált lista/tábla keresést kapott.
- Legördülő opció kiválasztása blokk opciólista-görgetést, starts-with egyezést és kis/nagybetű opciót kapott.
- Új Hibaüzenet keresése blokk alert, aria-live, error/invalid class és invalid mezők keresésére.
- Új Mező keresése címke alapján blokk enterprise/SNOW jellegű label, aria és data attribútum alapú mezőfelismeréshez.
- Iframe blokk same-origin iframe-ben is képes futtatási kontextust váltani.

## v0.41 újdonságok

- PDF előnézet saját BlockFlow előnézeti oldalt kapott, helyes fájlnévvel és saját Letöltés gombbal.
- Bekerült az egyszerű DOCX riportkészítés külön DOCX blokk-kategóriával.
- A Mini extension export ZIP generátora javítva lett, hogy a letöltött csomag szabványos ZIP-ként kibontható legyen.

## v0.42 javítások

- PDF előnézet: megszűnt a saját előnézeti oldalba ágyazott iframe/object megjelenítés.
- Az előnézet most közvetlen PDF blob URL-t nyit meg új tabon, így nem jelenik meg a Chrome "This content is blocked" hibája.
- Letöltés és Letöltés + előnézet módban a saját letöltési logika továbbra is a PDF blokkban megadott fájlnevet használja.
- Ha az előnézetet a böngésző blokkolja, a rendszer letöltésre esik vissza.
