# BlockFlow Automation MVP 0.48

BlockFlow egy lokális Chrome extension, amellyel általános weboldalakon lehet böngészőautomatizmusokat összeállítani vizuális, blokkos felületen. A cél az, hogy a gyakori adminisztrációs, adatgyűjtési, email-előkészítési, figyelési és riportkészítési folyamatokat programozás nélkül lehessen felépíteni.

Az extension nem használ AI-t, és nem küld adatot külső szolgáltatásnak. A workflow-k, sablonok, lokális adatok és beállítások a Chrome extension storage-ban maradnak.

## Mire hasznos?

- weboldali mezők adatainak kinyerése
- űrlapmezők kitöltése, kattintások automatizálása
- oldalak figyelése szöveg, elem, mezőérték, URL vagy értékváltozás alapján
- feltételes automatizmusok építése
- email sablon összeállítása és `mailto:` ablak megnyitása
- hosszú email törzs vágólapra másolása
- screenshot készítése
- PDF riport készítése begyűjtött adatokból és képernyőképekből
- DOCX / Word riport készítése begyűjtött adatokból és screenshotokból
- felhasználói visszajelzés kérése futás közben
- rendszerértesítés és hangjelzés küldése
- lokális adatok mentése és visszaolvasása
- kész workflow exportálása önálló mini extensionként

## Telepítés fejlesztői módban

1. Csomagold ki a ZIP fájlt.
2. Nyisd meg: `chrome://extensions`.
3. Kapcsold be a **Developer mode / Fejlesztői mód** kapcsolót.
4. Kattints a **Load unpacked** gombra.
5. Válaszd ki a kicsomagolt `blockflow-extension-v0.48` mappát.
6. Frissítsd újra a már nyitott céloldalakat, hogy az új content script biztosan betöltődjön.

## Fő felületek

### Toolbar popup

Az extension ikonjára kattintva egy kis popup jelenik meg. Innen megnyitható a Builder, a Sidebar, illetve futtatható a kiválasztott workflow.

### Builder

A Builder a fő szerkesztőfelület. Külön ablakban nyílik meg, hogy kényelmesebb legyen a workflow építése.

A Builder három fő részből áll:

- bal oldalon: automatizmuslista és blokkpaletta
- középen: az aktuális workflow blokklistája
- jobb oldalon: beállítások, változók, ellenőrzés, figyelők, sablonok, verziók és napló

A blokkpaletta kategóriái összecsukhatók, így nagyobb blokklista esetén kevesebbet kell görgetni.

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

A Figyelő trigger és a Feltételcsoport logikája lehet:

- minden feltétel igaz
- bármelyik feltétel igaz
- egyik feltétel sem igaz

Példa:

```text
Figyelő trigger
  Státusz változik: ebből → abba
  Feltételcsoport: bármelyik igaz
    Mező tartalmazza: Egyik érték
    Mező tartalmazza: Másik érték
```

Ez azt jelenti, hogy a workflow csak akkor indul, ha a státuszváltozás megtörtént, és közben az adott mező az egyik vagy másik keresett értéket tartalmazza.

## Blokkok mozgatása és beszúrása

A használt blokkoknál a mozgatógombok kontextusfüggők. Csak azok a gombok jelennek meg, amelyek az adott helyzetben használhatók.

Példák:

- legfelső blokknál nincs felfelé mozgatás
- legalul lévő blokknál nincs lefelé mozgatás
- figyelőfeltétel nem húzható ki érvénytelen főszintre
- konténeren belül a mozgatás az adott szinten történik

Ha a blokkpalettából kattintással adsz hozzá új blokkot, és van kijelölt blokk, akkor az új blokk közvetlenül a kijelölt blokk után kerül. Ha nincs kijelölt blokk, az új blokk a workflow végére kerül. A drag-and-drop továbbra is a húzással megadott célhelyet használja.

## Csoport blokk

A Csoport blokk workflow-részek rendszerezésére való.

Támogatott:

- csoportszintű ki/bekapcsolás
- összecsukás a Builderben
- összecsukott nézetben a benne lévő blokkok ikonjainak megjelenítése

Ha a csoport inaktív, a benne lévő blokkok futáskor kimaradnak, de nem törlődnek.

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

A kiválasztó a cél tabot fókuszálja, hover kerettel jelzi az aktuális elemet, majd stabil elemleírást ment. A kinyerésnél több azonosítót is használhat: ID, CSS selector, XPath, label, ARIA, title, valamint enterprise rendszerekben gyakori technikai mezőazonosítókat.

## Modern webapp / ServiceNow / SNOW kompatibilitás

A BlockFlow DOM-alapú általános automatizáló, de több modern webapp-kompatibilitási fejlesztést is tartalmaz.

Támogatott irányok:

- framework-kompatibilis kitöltés React/Vue/Angular/SNOW jellegű felületekhez
- `input`, `change` és `blur` események küldése kitöltés után
- szimulált gépelés érzékeny mezőkhöz
- SPA navigáció figyelése: `pushState`, `replaceState`, `popstate`, `hashchange`
- Shadow DOM keresés több elem-alapú blokknál
- elem újrakeresése minden művelet előtt
- custom/dropdown komponensek kezelése
- ServiceNow/SNOW jellegű attribútumok figyelése, például `aria-label`, `role`, `data-testid`, `data-field`, `data-name`

## Adat kinyerése

Az **Adat kinyerése** blokk képes:

- input/textarea/select érték olvasására
- látható szöveg olvasására
- HTML tartalom olvasására
- attribútum olvasására, például `title`, `aria-label`, `placeholder`
- teljes DOM-ban, akár rejtett vagy inaktív fülön lévő mezők között is keresni

Ez különösen hasznos olyan enterprise rendszereknél, ahol az oldal HTML-je már betöltődött, de az adat éppen nem látható aktív fülön.

## Szöveg keresése az oldalon

A **Szöveg keresése az oldalon** blokk egyszerű, regex nélküli keresésre való.

Beállítható:

- keresett szöveg
- tartalmazza vagy pontos egyezés
- kis/nagybetű érzékenység
- látható szövegben, teljes DOM-ban vagy teljes oldalon keressen
- input/textarea/select értékeket is figyeljen-e
- attribútumokat is figyeljen-e, például `title`, `aria-label`, `placeholder`, `alt`
- dinamikus/virtualizált oldalon görgetéssel is keressen

Visszaadott változók:

- `{{szoveg_talalat}}`: true / false
- `{{szoveg_talalat_db}}`: találatok száma
- `{{szoveg_talalat_szoveg}}`: első találat környezete
- `{{szoveg_talalat_hely}}`: hol találta meg
- `{{szoveg_talalat_selector}}`: CSS selector
- `{{szoveg_talalat_xpath}}`: XPath
- `{{szoveg_talalat_lista}}`: első találatok rövid listája
- `{{szoveg_talalat_sor_selector}}`: találathoz tartozó sor selector
- `{{szoveg_talalat_click_selector}}`: közeli/kattintható elem selector
- `{{szoveg_talalat_panel_selector}}`: közeli panel/kártya selector
- `{{szoveg_talalat_gomb_selector}}`: közeli gomb selector

Ez akkor hasznos, ha egy oldalról nem konkrét mezőt akarsz kinyerni, hanem meg akarod tudni, hogy egy kifejezés hol szerepel, és később a találat környezetében akarsz kattintani vagy adatot gyűjteni.

## Görgetés és dinamikus oldalak

A Görgetés blokk nem csak az egész oldalt tudja görgetni, hanem belső görgethető konténert is kezelhet.

Görgetési célok:

- automatikus
- teljes oldal
- cél elem legközelebbi görgethető konténere
- kézzel kiválasztott görgethető konténer

A **Görgetés szövegig** mód addig görget, amíg a keresett szöveg meg nem jelenik, vagy el nem éri a megadott próbálkozási limitet. Ez olyan oldalakon hasznos, ahol a lista vagy táblázat csak a látható elemeket tölti be.

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
- Hibaüzenet keresése
- Mező keresése címke alapján

A változókat `{{valtozonev}}` formában lehet használni. A jobb oldali Változók panelen a változó chipek kattinthatók: kattintásra a teljes `{{valtozonev}}` szöveg vágólapra kerül.

## Maszkolás

A Maszkolás blokk karakterek vagy sorok alapján tud adatot maszkolni.

Támogatott:

- karakteralapú maszkolás
- soralapú maszkolás
- invert maszkolás
- üres maszk karakter
- üres maszkolt sor szöveg
- Clear / trim mód, amikor a maszkolandó rész törlődik

Így érzékeny adatok PDF, DOCX vagy email előtt tisztíthatók.

## Táblázatok és listák

A Táblázatból kinyerés blokk támogatja:

- első / utolsó / N. sor kiválasztását
- fejlécnév alapján oszlop választását
- üres sorok kezelését
- virtualizált lista/tábla görgetéses keresését

A modern webappokban gyakori, hogy a táblázat csak a látható sorokat tartja a DOM-ban. Ilyenkor a görgetéses keresés segíthet a később betöltődő sorok elérésében.

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

A PDF blokkokkal begyűjtött adatokból és screenshotokból riport készíthető. A blokkok támogatják a változókat.

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

Az előnézet közvetlen PDF blob URL-t nyit meg új tabon. Helyes fájlnévhez a **Letöltés** vagy **Letöltés + előnézet** mód ajánlott.

## DOCX funkciók

A DOCX kategória szerkeszthető Word-riportok készítésére való.

DOCX blokkok:

- DOCX indítása
- DOCX szöveg hozzáadása
- DOCX táblázat hozzáadása
- DOCX screenshot / kép hozzáadása
- DOCX új oldal
- DOCX mentése

A DOCX blokkok a PDF blokkokhoz hasonlóan változókat használnak, de a végeredmény szerkeszthető `.docx` fájl. Ha a DOCX mentése blokk nem ad meg külön fájlnevet, akkor a DOCX indítása blokk fájlnevét használja.

## Felhasználói visszajelzés és értesítés

Blokkok:

- Felhasználói üzenet
- Adat bekérése
- Választás kérése
- Rendszerértesítés
- Hangjelzés

A visszajelzésre váró blokkok külön extension ablakot használnak, nem weboldalba injektált overlayt. Ez stabilabb, mert nem függ a weboldal CSS-étől.

A Hangjelzés blokk támogat beépített hangokat és saját feltöltött hangot is.

## Képernyőkép

A Képernyőkép blokk a Chrome `captureVisibleTab` jellegű működésére épül, ezért csak az aktív/látható tabról tud képet készíteni.

Módok:

- előnézet új tabon
- PNG letöltés
- vágólapra másolás
- csak változóba mentés

## Record mód

A Builder középső munkaterületének tetején, az automatizáció neve mellett található a **Rec** gomb. Record indításakor a céloldalon végzett alapműveletek workflow-vázzá alakulnak.

Rögzített műveletek:

- kattintás
- mezőkitöltés / select / checkbox változás
- Enter, Tab, Escape billentyű
- hosszabb szünetekből egyszerű Várakozás blokk

Record közben csak a **Pause** és **Stop** gombok jelennek meg. Stop után a rögzített műveletekből normál, szerkeszthető blokkok készülnek. Jelszó vagy érzékenynek tűnő mezők értékét a recorder nem menti el konkrét szövegként.

## Mini extension export

A Mini extension export kész workflow-ból Builder nélküli, önálló futtató Chrome extension ZIP-et generál.

A generált extension tartalmazza:

- manifest
- background/content runtime
- beégetett fő workflow
- meghívott workflow-k, ha a fő workflow másik automatizmust hív meg
- figyelők/időzítők futtatásához szükséges runtime

Nem tartalmazza:

- Buildert
- Sidebar-t
- blokkpalettát
- beállítási UI-t
- dry-run vagy validációs UI-t

## Import / export / verziók

Támogatott:

- egy workflow exportálása
- teljes export
- import
- import előnézet
- ellenőrzött / nem ellenőrzött jelzés
- mentett verziók visszaállítása
- mini extension export

Importált workflow futtatása előtt javasolt ellenőrzést és dry-runt használni.

## Futtatásbiztonság és hibakezelés

A workflow-k validálhatók futtatás előtt. A napló jelzi, melyik blokk futott, és hiba esetén hol akadt el.

A figyelő storage szinkronizálása úgy működik, hogy mentéskor az adott workflow régi watcher rekordjai törlődnek, és csak az aktív figyelő blokkokból jönnek létre új figyelők.

Az extension reload/frissítés utáni régi content script példányok csendesen leállítják a figyelő loopot, így az `Extension context invalidated` hiba nem ismétlődik folyamatosan.

## Ismert korlátok

- Chrome belső oldalakon, Chrome Web Store oldalon és tiltott oldalaknál content script nem fut.
- Cross-origin iframe tartalma böngészőbiztonsági okból nem mindig olvasható.
- Screenshot csak aktív/látható tabról készíthető.
- `mailto:` viselkedése függ az operációs rendszertől és az alapértelmezett levelezőprogramtól.
- Automatikus emailküldés nincs és szándékosan nem része a működésnek.
- PDF előnézetnél a böngésző saját PDF viewerének mentése blob névből dolgozhat; helyes fájlnévhez a BlockFlow Letöltés módját használd.

## Javasolt használati minta

1. Hozz létre új automatizmust.
2. Válassz indítást: Indítás, Figyelő trigger vagy Időzített indítás.
3. Válaszd ki az oldalról a szükséges elemeket.
4. Nyerd ki az adatokat változókba.
5. Tisztítsd, maszkoljad vagy validáld az adatokat.
6. Építs emailt, PDF vagy DOCX riportot.
7. Ellenőrizd a workflow-t.
8. Futtasd dry-run módban.
9. Ha rendben van, futtasd élesben vagy aktiváld a figyelőt.

## Változásnapló

### v0.48

- Edge kompatibilitási javítás a Builder workflow-váltásához.
  - Az automatizmus kiválasztása most lokális Builder state-ből azonnal történik.
  - A workflow-kártya és a Megnyitás gomb ugyanazt a stabil kiválasztási útvonalat használja.
  - A storage mentés nem blokkolja a UI-váltást, így Edge alatt is stabilabb az automatizmusok közötti váltás.
- Importált / nem ellenőrzött állapot kezelése javítva.
  - Sikeres Ellenőrzés után az automatizmus ellenőrzött lesz.
  - Sikeres Dry-run, normál futás vagy kényszerített futás után szintén eltűnik a nem ellenőrzött jelzés.
  - Módosítás után az automatizmus újra nem ellenőrzött állapotba kerül, amíg nincs új sikeres ellenőrzés vagy futás.


### v0.46

- README rendezése és verzióhelyes változásnapló kialakítása.
- Az ismétlődő / rossz helyre került verziószakaszok tisztítása.

### v0.45

- DOCX mentésnél a DOCX indítása blokkban megadott fájlnév elsőbbséget kap, ha a DOCX mentése blokk alapértelmezett vagy üres fájlnévvel fut.
- Csoport blokk kikapcsolt állapotban futáskor kihagyja a benne lévő blokkokat.

### v0.44

- Vágólapról beolvasás blokk robusztusabb lett.
- A blokk szükség esetén extension tulajdonú segédablakot használ a vágólap beolvasásához.
- A beolvasott érték bekerül a megadott változóba, valamint a `{{last_result}}`, `{{last_text}}` és `{{last_value}}` változókba.
- A mini extension export is tartalmazza a vágólap-beolvasó segédfájlokat.

### v0.43

- Csoport blokk csoportszintű ki/bekapcsolást kapott.
- Csoport blokk összecsukható lett.
- Összecsukott csoportnál a benne lévő blokkok ikonjai látszanak.

### v0.42

- PDF előnézetnél megszűnt a saját előnézeti oldalba ágyazott iframe/object megjelenítés.
- Az előnézet közvetlen PDF blob URL-t nyit meg új tabon.
- Letöltés és Letöltés + előnézet módban a saját letöltési logika a PDF blokkban megadott fájlnevet használja.

### v0.41

- Mini extension export ZIP generátora javítva lett, hogy a letöltött csomag szabványos ZIP-ként kibontható legyen.
- Bekerült az egyszerű DOCX riportkészítés külön DOCX blokk-kategóriával.
- PDF előnézet fájlnévkezelése javult, majd a v0.42-ben a blokkolt iframe/object előnézet helyett közvetlen blob előnézetre váltott.

### v0.40

- Próbáld meg / hiba esetén blokkba már húzhatók blokkok mind a próbálkozási, mind a hibaágba.
- Szöveg keresése az oldalon blokk opcionálisan görgetéssel is keres dinamikus vagy virtualizált oldalakon.
- Görgetés blokk új Görgetés szövegig móddal bővült.

### v0.39

- Javítva a `Betöltési hiba: options.map is not a function` hiba.
- A select renderelés védelmet kapott hibás opciólista esetére.
- Régi Record által létrehozott blokkok normalizálása erősebb lett.
- Record gomb rövidült: **Rec**.

### v0.38

- Görgetés blokk belső görgethető konténer támogatással bővült.
- Kattintás blokk kattintás előtt okos auto-scrollt és kattintható szülő fallbacket kapott.
- Várj amíg blokk új módokkal bővült: elem eltűnik, elem látható/kattintható, mezőérték változik, URL változik, spinner eltűnik, DOM stabil.
- Szöveg keresése blokk több kontextust ad vissza: találati sor, kattintható szülő, panel/kártya és közeli gomb selector.
- Táblázatból kinyerés fejlécnév alapján is tud oszlopot választani, és erősebb virtualizált lista/tábla keresést kapott.
- Legördülő opció kiválasztása blokk opciólista-görgetést, starts-with egyezést és kis/nagybetű opciót kapott.
- Új Hibaüzenet keresése blokk.
- Új Mező keresése címke alapján blokk.
- Iframe blokk same-origin iframe-ben is képes futtatási kontextust váltani.

### v0.37

- Record által létrehozott blokkok normál blokksémával jönnek létre.
- Rögzített blokkok szerkeszthetők, mozgathatók és törölhetők.
- Régebbi Record-blokkokból megnyitáskor automatikusan eltávolításra kerülnek a csak rögzítési jelölések.

### v0.36

- Blokkpalettából kattintással hozzáadott új blokk kijelölt blokk után kerül.
- Konténeren belüli kijelölésnél az új blokk ugyanarra a behúzott szintre kerül.
- Figyelő feltételeknél a beszúrás a Figyelő trigger vagy Feltételcsoport kontextusát követi.

### v0.35

- Modern webapp és ServiceNow/SNOW kompatibilitási fejlesztések.
- Framework-kompatibilis kitöltés a Beillesztés / kitöltés blokkban.
- Kitöltési módok: framework-kompatibilis értékadás, egyszerű értékadás, szimulált gépelés, paste esemény jellegű mód.
- SPA navigáció figyelése: `pushState`, `replaceState`, `popstate`, `hashchange`.
- Shadow DOM keresés több elem-alapú blokknál.
- Új blokk: Legördülő opció kiválasztása.
- ServiceNow/SNOW jellegű attribútumok jobb kezelése: `aria-label`, `role`, `data-testid`, `data-test-id`, `data-field`, `data-name`.
- Virtualizált lista/táblázat támogatás első lépése.

### v0.34

- Mini extension export kezeli a Másik automatizmus futtatása blokkokat.
- Exportáláskor a meghívott workflow-k is bekerülnek a mini extensionbe, rekurzívan.
- A meghívott workflow-k alfolyamatként kerülnek a csomagba.

### v0.33

- Record mód bekerült.
- A Record UI a középső munkaterület tetején, az automatizáció neve mellett jelenik meg.
- Rögzítéskor kattintás, mezőkitöltés, select/checkbox változás, Enter/Tab/Escape és hosszabb szünetek rögzíthetők.
- Érzékeny vagy jelszómezők értékét a recorder nem menti el konkrét szövegként.

### v0.32

- Mini extension export bekerült.
- Hangjelzés blokk saját feltöltött hanggal, hangerővel és ismétléssel bővült.
- Táblázatból kinyerés blokk N. sor opciót kapott.
- Maszkolás blokk Clear / trim móddal bővült.

### v0.31

- Szöveg keresése → Kattintás flow javítva.
- A Szöveg keresése blokk kattintás/görgetés után elsődlegesen használható selector kimenetet ad.
- Kattintás validáció elfogadja a dinamikus selector/XPath/elem változókat.

### v0.30

- Blokkpaletta kategóriái összecsukhatók lettek.
- Szöveg keresése blokk találati elemhivatkozást, selectort és XPath-et ad tovább.
- Bevezetésre kerültek az általános utolsó eredmény változók: `{{last_result}}`, `{{last_text}}`, `{{last_value}}`, `{{last_selector}}`, `{{last_xpath}}`, `{{last_element}}`, `{{last_screenshot}}`.
- Új blokkok beszúrásakor több esetben automatikus előkitöltés történik az előző blokk kimenete alapján.

### v0.29

- Szöveg keresése az oldalon blokk bekerült.
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

- Új feltétel: érték változik.
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

- Extension context invalidated hiba ellen további védelem.
- Felhasználói üzenet blokk saját extension ablakot használ.

### v0.20

- Safe storage/runtime wrapper és watcher-leállítás extension reload esetére.
- Felhasználói üzenet blokk bekerült.
- Rendszerértesítés blokk bekerült.

### v0.19

- Figyelő feltételblokkok behúzása a Figyelő trigger alá javítva.

### v0.18

- Régi Figyelő: szöveg / Figyelő: elem blokkok migrálva új Figyelő trigger + feltétel modellre.
- Builder felső gombok ikonokat kaptak.

### v0.17

- Figyelő storage teljes tisztítása workflow mentéskor.
- Inaktív figyelő nem kerül watcher storage-ba.
- Mentve / Nem mentett módosítás jelzés bekerült.
- Új workflow-nál kötelező indítót választani.

### v0.16

- Figyelő scope részletei láthatóbbak lettek a blokkon és a jobb oldali panelen.

### v0.15

- Indítóblokkok egyenértékűek lettek: Indítás, Figyelő: szöveg, Figyelő: elem.
- Jobb oldali panel betöltési hibái javítva.

### v0.14

- Toolbar popup összeomlása javítva.

### v0.13

- Fő beállítások több blokknál középről is szerkeszthetők.
- Builder három külön görgethető területre osztva.

### v0.12

- Watcherek átnevezve Figyelő triggerekre.
- Figyelők indítóblokként jelentek meg.
- Maszkolás invert módot és üres maszk támogatást kapott.

### v0.11

- Email sablonkártyák gombjai külön sorba kerültek.

### v0.10

- Watcher és email sablon panel kompaktabb lett, részletes szerkesztés modalba került.

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

### v0.47

- Új blokk: **CSS injektálása**. Egyedi CSS szabályokat tud beszúrni az aktuális oldalba, azonosító alapján frissíthető vagy eltávolítható style tagként. Hasznos ideiglenes kiemeléshez, elrejtéshez, vizuális segédjelölésekhez vagy riport/screenshot előkészítéshez.
