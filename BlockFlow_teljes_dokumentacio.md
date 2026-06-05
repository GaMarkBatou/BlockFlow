# BlockFlow teljes dokumentáció

Ez a dokumentum a BlockFlow használatát, működését, fő felületeit, blokk-kategóriáit, változókezelését, import/export lehetőségeit, debug funkcióit és ismert korlátait írja le.

A dokumentáció anonimizált: nem tartalmaz konkrét céges URL-t, ügyfélnevet, ticketazonosítót vagy verzióspecifikus mappanevet.

## Tartalom

1. Áttekintés
2. Telepítés és frissítés
3. Fő fogalmak
4. Felületek
5. Workflow életciklus
6. Blokkpaletta és szerkesztés
7. Indítók
8. Figyelők és feltételek
9. Műveleti blokkok
10. Adatkinyerés és adatkezelés
11. Logika és hibakezelés
12. Felhasználói interakciók
13. Email funkciók
14. PDF riportkészítés
15. DOCX riportkészítés
16. Táblázatok és listák
17. Popup, új ablak, iframe
18. Modern webapp-kompatibilitás
19. Public log és debug
20. Import/export/default automatizmusok
21. Mini extension export
22. Record mód
23. Változók és adatfolyam
24. Validáció, dry-run, futtatás
25. Teljesítmény és stabilitás
26. Ismert korlátok
27. Ajánlott használati minták
28. Hibaelhárítás

---

## 1. Áttekintés

A BlockFlow egy lokális böngészőautomatizáló extension. Vizuális, blokkos felületen lehet vele automatizmusokat létrehozni általános weboldalakhoz.

Tipikus felhasználások:

- weboldali mezők adatainak kinyerése;
- táblázatok és listák feldolgozása;
- űrlapmezők kitöltése;
- gombokra, linkekre vagy dinamikus elemekre kattintás;
- figyelő automatizmusok építése;
- oldalváltozás, szöveg, mezőérték vagy URL figyelése;
- email előkészítése;
- PDF és DOCX riport generálása;
- felhasználói visszajelzés kérése;
- workflow-k exportálása és importálása;
- kész automatizmus mini extensionként való exportálása.

A BlockFlow nem AI-alapú. A működése a böngészőben elérhető DOM-ra, extension API-kra, local storage-ra és a felhasználó által összeállított blokkokra épül.

---

## 2. Telepítés és frissítés

### Telepítés fejlesztői módban

1. Csomagold ki az extension ZIP-fájlt.
2. Nyisd meg a böngésző extension-kezelő oldalát.
3. Kapcsold be a fejlesztői módot.
4. Válaszd a kicsomagolt extension betöltését.
5. Tallózd be a kicsomagolt extension mappáját.
6. Nyisd meg vagy frissítsd újra a céloldalakat.

### Frissítés

1. Cseréld le a kicsomagolt extension mappáját az új verzió tartalmára.
2. Az extension-kezelőben nyomj reloadot az extensionnél.
3. Zárd be és nyisd újra a Builder ablakot.
4. Frissítsd újra a céloldalakat.

Fontos: ha a Builder vagy egy céloldal nyitva marad frissítés közben, előfordulhat, hogy még a régi scriptpéldány fut.

---

## 3. Fő fogalmak

### Workflow / automatizmus

Egy teljes folyamat, amely blokkokból áll. Egy workflow tartalmazhat indítót, feltételeket, műveleteket, adatkinyerést, riportkészítést és felhasználói interakciókat.

### Blokk

Egy művelet vagy feltétel egysége. Például:

- Kattintás;
- Adat kinyerése;
- Szöveg keresése;
- PDF szöveg hozzáadása;
- Rendszerértesítés;
- Várj betöltésre.

### Konténerblokk

Olyan blokk, amely más blokkokat tartalmazhat. Példák:

- Csoport;
- Ha;
- Ismételd;
- Próbáld meg / hiba esetén;
- Figyelő trigger;
- Feltételcsoport.

### Változó

A workflow futása közben tárolt adat. A változók `{{valtozo_nev}}` formában használhatók.

### Selector / XPath / ElementRef

Elemhivatkozások, amelyekkel a BlockFlow újra megtalálja az oldalelemeket futás közben.

### Public log

Oldalon megjelenő debug panel, amely futás közben mutatja a workflow lépéseit.

---

## 4. Felületek

### Popup

Az extension ikonjára kattintva megjelenő kis vezérlő. Funkciói:

- Builder megnyitása;
- Sidebar megnyitása;
- workflow kiválasztása;
- gyors futtatás.

### Builder

A fő szerkesztő. Három fő területből áll:

- bal oldal: automatizmuslista és blokkpaletta;
- közép: aktuális workflow blokkjai;
- jobb oldal: kiválasztott blokk részletes beállításai és segédpanelek.

A Builder külön ablakban működik, hogy hosszabb workflow-k is kényelmesen szerkeszthetők legyenek.

### Sidebar

Gyors futtatáshoz és egyszerű használathoz való. Nem helyettesíti a Builder teljes szerkesztőfunkcióit.

### Céloldal

Az a weboldal, ahol a workflow fut. A content script ezen az oldalon végzi az elemkeresést, kattintást, kitöltést, görgetést, public log megjelenítését és más oldalműveleteket.

---

## 5. Workflow életciklus

Egy workflow tipikus életútja:

1. Létrehozás.
2. Indító kiválasztása.
3. Blokkok hozzáadása.
4. Elemkiválasztás a céloldalon.
5. Változók és beállítások kitöltése.
6. Ellenőrzés.
7. Dry-run.
8. Éles futtatás vagy figyelő aktiválása.
9. Szükség esetén export/import vagy mini extension export.

### Mentett / nem mentett állapot

A Builder jelzi, ha módosítás történt. Workflow-váltáskor csak akkor történik mentés, ha tényleges változás volt.

### Ellenőrzött / nem ellenőrzött állapot

Importált workflow-k alapból nem ellenőrzöttek. Sikeres ellenőrzés, dry-run vagy futás után ellenőrzött állapotba kerülhetnek. Módosítás után újra szükséges lehet az ellenőrzés.

---

## 6. Blokkpaletta és szerkesztés

### Kategóriák

A blokkpaletta kategóriái összecsukhatók. Ez segít hosszabb blokklista esetén.

### Blokk hozzáadása

- Ha van kijelölt blokk, az új blokk közvetlenül utána kerül.
- Ha nincs kijelölt blokk, az új blokk a workflow végére kerül.
- Drag-and-drop esetén a blokk oda kerül, ahová húzod.

### Blokk mozgatása

A mozgatógombok kontextusfüggők:

- feljebb;
- lejjebb;
- legfelülre;
- legalulra;
- kihúzás főszintre, ha értelmezhető;
- törlés.

A nem használható gombok nem jelennek meg.

### Csoport összecsukása

A Csoport blokk összecsukható. Összecsukott nézetben a benne lévő blokkok ikonként láthatók.

---

## 7. Indítók

### Indítás

Manuális futtatáshoz való. A workflow a Futtatás gombra indul.

### Figyelő trigger

Feltételek alapján automatikusan indít. Például ha megjelenik egy szöveg, megváltozik egy mezőérték vagy az URL megfelel egy szabálynak.

### Időzített indítás

Időközönként vagy meghatározott időpontban indíthat workflow-t.

### Kattintás trigger

A workflow akkor indul, ha a felhasználó egy kiválasztott oldalelemen kattint.

Beállítható:

- cél elem;
- scope;
- aktív/inaktív;
- újraindítási szünet;
- csak egyszer fusson.

---

## 8. Figyelők és feltételek

### Figyelő trigger logika

A trigger alatt lévő feltételek kiértékelése lehet:

- minden feltétel igaz;
- bármelyik feltétel igaz;
- egyik feltétel sem igaz.

### Feltétel: szöveg

Megadott szöveg megjelenését figyeli az oldalon.

### Feltétel: elem

Egy elem létezését, láthatóságát vagy állapotát figyeli.

### Feltétel: mezőérték

Input, textarea, select vagy más elem értékét ellenőrzi.

### Feltétel: URL

URL-re vonatkozó feltételt vizsgál:

- tartalmazza;
- pontosan egyezik;
- kezdődik;
- végződik.

### Feltétel: érték változik

Előző figyelési kör és aktuális figyelési kör közötti változást ellenőrzi.

Módok:

- miről → mire;
- bármiről → mire;
- miről → bármire;
- bármilyen változás.

Alapértelmezésben az első kör csak megtanulja az aktuális értéket, nem indít.

### Feltételcsoport

Logikai konténer figyelőfeltételekhez. Használható összetettebb feltételrendszerhez.

---

## 9. Műveleti blokkok

### Kattintás

Egy kiválasztott vagy változóból érkező elemre kattint.

Támogatott célok:

- kézzel kiválasztott elem;
- előző találat;
- selector változó;
- XPath változó;
- elem változó.

A blokk kattintás előtt újrakeresi az elemet, szükség esetén görget, és próbálhat kattintható szülőelemet használni.

### Beillesztés / kitöltés

Mezőbe ír vagy értéket állít.

Módok:

- egyszerű értékadás;
- framework-kompatibilis értékadás;
- szimulált gépelés;
- paste jellegű mód.

Modern webappoknál a framework-kompatibilis mód javasolt, mert eseményeket is küld.

### Görgetés

Görgethet teljes oldalt, belső konténert vagy cél elemhez tartozó legközelebbi görgethető szülőt.

Támogatott:

- teljes oldal;
- automatikus scroll konténer;
- kézzel kiválasztott scroll konténer;
- görgetés szövegig.

### Várj betöltésre

Kattintás, URL megnyitás vagy dinamikus frissítés után használható.

Módok:

- automatikus;
- oldal betöltődött;
- DOM stabil;
- spinner eltűnt;
- kiválasztott elem megjelent;
- kiválasztott elem kattintható.

### URL megnyitása

Megadott URL-t nyit meg:

- aktuális tabon;
- új tabon;
- új ablakban.

### CSS injektálása

CSS szabályokat ad hozzá az aktuális oldalhoz. Azonosító alapján frissíthető vagy eltávolítható.

Felhasználási példák:

- elem kiemelése;
- ideiglenes elrejtés;
- screenshot/PDF előkészítése;
- vizuális segédjelölés.

---

## 10. Adatkinyerés és adatkezelés

### Adat kinyerése

Képes olvasni:

- mezőértéket;
- látható szöveget;
- HTML tartalmat;
- attribútumot;
- rejtett vagy inaktív tabon lévő DOM-elemet, ha a DOM-ban elérhető.

### Szöveg keresése az oldalon

Egyszerű, regex nélküli keresés. Visszaadhat:

- találat van/nincs;
- találatok száma;
- találat környezete;
- hely;
- selector;
- XPath;
- sor selector;
- kattintható selector;
- panel selector;
- közeli gomb selector.

Dinamikus listákban görgetéssel is kereshet.

### Regex keresés

Szövegminták alapján keres vagy nyer ki részletet. Akkor hasznos, ha nem konkrét szöveg, hanem minta kell.

### Szövegrész kinyerése

Egyszerűbb részszöveg-kinyeréshez használható.

### Maszkolás

Érzékeny adatok takarására vagy törlésére használható.

Módok:

- karakteralapú;
- soralapú;
- invert maszkolás;
- üres maszkolás;
- clear / trim mód.

### Vágólapról beolvasás

A vágólap szövegét változóba menti. Ha a böngésző közvetlen olvasást blokkol, extension segédablakos fallbacket használhat.

### Lokális mentés / beolvasás

Egyszerű workflow-adatok tárolására és visszaolvasására használható.

### Számítás

Egyszerű számításokat végezhet változókból.

### Adat validálása

Ellenőrizheti, hogy egy változó megfelel-e egy elvárt formának vagy feltételnek.

### Hibaüzenet keresése

Oldalon megjelenő hibákat keres:

- alert;
- aria-live;
- error/invalid class;
- aria-invalid;
- invalid mezők.

### Mező keresése címke alapján

Label, aria-label, title vagy data attribútum alapján keresi a hozzá tartozó mezőt.

---

## 11. Logika és hibakezelés

### Ha

Feltételes futtatás.

### Ismételd

Behúzott blokkokat ismétel megadott számban vagy feltétellel.

### Próbáld újra

Hibás művelet ismétlésére használható.

### Próbáld meg / hiba esetén

Try/catch jellegű blokk. Két ága van:

- próbáld meg;
- hiba esetén.

Mindkét ágba húzhatók blokkok.

### Leállítás

Megállítja a workflow futását.

### Csoport

Szervezésre, összecsukásra és ideiglenes ki/bekapcsolásra használható.

### Másik automatizmus futtatása

Egy másik workflow-t alfolyamatként hív meg. Mini extension exportnál a hívott workflow-k is bekerülnek a csomagba.

### Eredmény visszaadása

Alworkflow vagy csoportosított logika eredményének átadásához használható.

---

## 12. Felhasználói interakciók

### Felhasználói üzenet

Külön extension ablakban mutat üzenetet. Várhat visszajelzésre.

### Adat bekérése

Felhasználótól kér adatot, majd változóba menti.

### Választás kérése

Több opció közül kér választást.

### Email előnézet

Email tartalom áttekintésére szolgál megnyitás előtt.

### Rendszerértesítés

Böngésző/operációs rendszer értesítést küld.

### Hangjelzés

Beépített vagy feltöltött saját hangot tud lejátszani. Beállítható hangerő és ismétlésszám.

### Oldalba illesztett gomb

Gombot illeszt az aktuális oldalba, és a workflow addig vár, amíg a felhasználó megnyomja.

Támogatott:

- gomb felirata;
- tooltip;
- automatikus eltávolítás;
- timeout;
- timeout esetén folytatás vagy leállás;
- eredményváltozó;
- pozíció: sarkok, középen alul, elem elé/után, custom;
- custom esetén távolságok és z-index.

### Interakciós ablakok stílusa

Egyes felhasználói ablakoknál beállítható:

- ablakstílus: alap, kompakt, szélesebb, figyelemfelhívó;
- kiemelő szín;
- ablakméret.

---

## 13. Email funkciók

A BlockFlow nem küld emailt automatikusan. Az email funkciók emailt készítenek elő.

### Email összeállítása

Címzettet, tárgyat, törzset állít össze változókkal.

### Email sablon használata

Elmentett sablon alapján készít emailt.

### Email előnézet

Megmutatja az email tartalmát.

### Email megnyitása

`mailto:` linket nyit meg. Ha a törzs túl hosszú, a törzs vágólapra kerül, és a levelező csak a rövidebb mezőkkel nyílik.

---

## 14. PDF riportkészítés

### PDF indítása

Új PDF dokumentumot kezd.

Beállítások:

- fájlnév;
- cím;
- papírméret;
- tájolás;
- margó;
- betűméret;
- fejléc/lábléc.

### PDF szöveg hozzáadása

Szöveget, címsort vagy megjegyzést ad a PDF-hez.

### PDF táblázat hozzáadása

Kulcs-érték jellegű táblázatot vagy strukturált adatokat ad hozzá.

### PDF screenshot hozzáadása

Képernyőképet illeszt a PDF-be.

### PDF új oldal

Oldaltörést ad hozzá.

### PDF mentése / előnézet

Módok:

- letöltés;
- előnézet;
- letöltés + előnézet.

A helyes fájlnévhez a letöltés vagy letöltés + előnézet mód javasolt.

---

## 15. DOCX riportkészítés

A DOCX blokkok szerkeszthető Word dokumentumot hoznak létre.

### DOCX indítása

Beállítások:

- fájlnév;
- dokumentum címe;
- oldalméret;
- tájolás;
- margó;
- alap betűméret.

### DOCX szöveg hozzáadása

Címsort vagy szöveges bekezdést ad hozzá.

### DOCX táblázat hozzáadása

Táblázatos adatokat illeszt be.

### DOCX screenshot / kép hozzáadása

Képet vagy screenshotot illeszt be.

### DOCX új oldal

Oldaltörést ad hozzá.

### DOCX mentése

A dokumentumot `.docx` fájlként letölti.

---

## 16. Táblázatok és listák

### Táblázatból kinyerés

Támogatott:

- N. sor;
- első/utolsó sor;
- fejlécnév alapján oszlop;
- üres sorok kihagyása;
- fejléc beleszámítása vagy kihagyása;
- virtualizált lista görgetése.

### Elemek keresése

Több egyező elem keresésére használható. Hasznos sorok, gombok vagy ismétlődő elemek számolásához.

### Minden találatra

Listaelemek vagy találatok ismételt feldolgozásához használható.

---

## 17. Popup, új ablak, iframe

### Várj új ablakra

Megvárja, hogy új böngészőablak/tab jelenjen meg.

### Új ablakból kinyerés

Az új ablak tartalmából olvas adatot, ha hozzáférhető.

### Új ablak bezárása

Bezárja az előzőleg kezelt új ablakot.

### Iframe blokk

Same-origin iframe esetén a behúzott blokkok az iframe kontextusában futhatnak. Cross-origin iframe esetén a böngésző biztonsági korlátai érvényesek.

---

## 18. Modern webapp-kompatibilitás

Modern keretrendszerek és enterprise UI-k esetén a fő kihívások:

- dinamikusan újrarenderelt DOM;
- virtualizált listák;
- custom dropdownok;
- Shadow DOM;
- SPA navigáció;
- belső scroll konténerek;
- state-alapú inputok.

A BlockFlow több módszerrel kezeli ezeket:

- minden művelet előtt elem újrakeresése;
- framework-kompatibilis kitöltés;
- input/change/blur események;
- custom dropdown blokk;
- belső scroll konténer keresés;
- SPA navigáció figyelése;
- Shadow DOM keresés;
- label/ARIA/data attribútum alapú resolverek.

Javaslat modern appokhoz:

- kitöltésnél használd a framework-kompatibilis módot;
- kattintás előtt szükség esetén Várj betöltésre blokkot tegyél;
- táblázatoknál engedélyezd a görgetéses keresést;
- custom dropdownokhoz használd a Legördülő opció kiválasztása blokkot;
- debughoz kapcsold be a Public logot.

---

## 19. Public log és debug

### Public log bekapcsolása

Workflow-szinten kapcsolható be. Futáskor az oldalon egy jobb oldali, félig áttetsző panel jelenik meg.

### Mit mutat?

- blokk indulása;
- blokk vége;
- átadott változók;
- selectorok;
- találatszámok;
- hibák;
- user-interakciók;
- fájlnevek;
- futási eredmény.

### TXT letöltés

A panelen lévő TXT gombbal letölthető a futási log. Debugoláshoz, hibabejelentéshez vagy workflow finomításhoz hasznos.

### Shadow DOM izoláció

A public log panel izolált Shadow DOM-ban jelenik meg, ezért a céloldal CSS-e nem tudja összenyomni vagy elrontani.

---

## 20. Import/export/default automatizmusok

### Workflow export

Egy workflow JSON-ként exportálható.

### Teljes export

Az összes workflow és kapcsolódó adat exportálható.

### Import

Importáláskor előnézet és ellenőrzés segíthet az átvett workflow-k áttekintésében.

### Default automatizmusok

Az extension gyökerében lévő `default.json` a meglévő import/export formátumot használja. Új telepítésnél, ha még nincs workflow, ezek az automatizmusok betöltődhetnek.

Javasolt használat:

1. Készíts el egy vagy több workflow-t.
2. Exportáld őket JSON-ként.
3. A fájlt használd default automatizmuscsomagként.
4. Új telepítésnél ezek jelennek meg alapértelmezettként.

---

## 21. Mini extension export

A Mini extension export célja, hogy egy kész automatizmus önálló, Builder nélküli extensionként fusson.

A generált mini extension tartalmazza:

- manifestet;
- background/content futtatómotort;
- beégetett fő workflow-t;
- szükséges hívott workflow-kat;
- figyelőket és időzítőket;
- visszajelző ablakokat és segédfájlokat, ha szükséges.

Nem tartalmazza:

- Buildert;
- Sidebar-t;
- blokkpalettát;
- import/export UI-t;
- validációs panelt;
- sablonszerkesztőt.

Ha a workflow másik automatizmust hív meg, az export rekurzívan beemeli a függőségeket.

---

## 22. Record mód

A Record mód a céloldalon végzett egyszerű felhasználói műveletekből workflow-vázat hoz létre.

Rögzíthető:

- kattintás;
- input/textarea változás;
- select/checkbox/radio változás;
- Enter/Tab/Escape;
- hosszabb szünetek.

A rögzített blokkok normál blokkokként viselkednek: szerkeszthetők, mozgathatók, törölhetők.

Érzékeny mezők értékét a recorder nem menti konkrétan.

---

## 23. Változók és adatfolyam

### Változóhasználat

A változók formája:

```text
{{valtozo_nev}}
```

Használhatók:

- email tárgyban és törzsben;
- PDF/DOCX szövegben;
- URL-ben;
- CSS-ben;
- értesítésben;
- blokkok beállításaiban;
- feltételekben.

### Automatikus utolsó eredmény változók

A futás során több blokk töltheti:

- `{{last_result}}`
- `{{last_text}}`
- `{{last_value}}`
- `{{last_selector}}`
- `{{last_xpath}}`
- `{{last_element}}`
- `{{last_screenshot}}`

### Szövegkeresési változók

- `{{szoveg_talalat}}`
- `{{szoveg_talalat_db}}`
- `{{szoveg_talalat_szoveg}}`
- `{{szoveg_talalat_hely}}`
- `{{szoveg_talalat_selector}}`
- `{{szoveg_talalat_xpath}}`
- `{{szoveg_talalat_lista}}`
- `{{szoveg_talalat_sor_selector}}`
- `{{szoveg_talalat_click_selector}}`
- `{{szoveg_talalat_panel_selector}}`
- `{{szoveg_talalat_gomb_selector}}`

### Public log és változók

Public log bekapcsolásakor jól látható, melyik blokk milyen értéket állított elő, és mit adott tovább.

---

## 24. Validáció, dry-run, futtatás

### Ellenőrzés

Szerkezeti és kötelező mező hibákat keres. Például:

- hiányzó cél elem;
- hiányzó URL;
- üres kötelező érték;
- hibás blokk-elhelyezés.

### Dry-run

Tesztfuttatás jellegű mód. Nem minden esetben hajt végre éles oldalműveletet, de segít látni, mi történne.

### Futtatás

Normál futtatás. Ha a workflow figyelő triggerrel indul, a futtatás figyelembe veszi a triggerfeltételeket.

### Kényszerített futtatás

Debughoz használható. Átugorhatja az indítófeltételeket, és közvetlenül a műveleti blokkokat futtatja.

---

## 25. Teljesítmény és stabilitás

A BlockFlow több optimalizálást tartalmaz:

- felesleges workflow-mentések csökkentése;
- numeric mezők egységes kezelése;
- szövegkeresési kontextus gyorsítása;
- public log izolálása;
- watcher storage tisztítása mentéskor;
- extension reload esetén régi loopok csendes leállítása;
- validációval több hiba futtatás előtt elkapható.

Nagyobb workflow-khoz javaslat:

- használj Csoport blokkokat;
- kapcsold ki átmenetileg a nem tesztelt csoportokat;
- használd a Public logot;
- használj Várj betöltésre blokkot dinamikus oldalak után;
- ne futtass szükségtelenül sűrű watcher intervallumokat.

---

## 26. Ismert korlátok

- Böngésző belső oldalakon content script nem fut.
- Cross-origin iframe tartalma nem hozzáférhető.
- Screenshot csak aktív/látható tabról készíthető.
- Blob PDF előnézetből a böngésző saját mentése adhat generált fájlnevet; helyes fájlnévhez használd a letöltési módot.
- Automatikus emailküldés nincs.
- Vágólapolvasást böngésző vagy céges policy korlátozhatja.
- Extension telepítést és fejlesztői módot céges policy korlátozhatja.
- Modern webappoknál előfordulhat, hogy custom komponenshez specifikus kattintás/gépelés szükséges.

---

## 27. Ajánlott használati minták

### Egyszerű adatkinyerés értesítéssel

```text
Indítás
Adat kinyerése
Rendszerértesítés
```

### Dinamikus keresés és kattintás

```text
Szöveg keresése az oldalon
Görgetés szövegig, ha szükséges
Kattintás: előző találat / selector változó
```

### Oldalbetöltés után adatgyűjtés

```text
URL megnyitása
Várj betöltésre
Adat kinyerése
```

### Felhasználói jóváhagyás után folytatás

```text
Adat kinyerése
Oldalba illesztett gomb: Folytatás
PDF mentése
```

### PDF riport

```text
PDF indítása
PDF szöveg hozzáadása
PDF táblázat hozzáadása
Képernyőkép
PDF screenshot hozzáadása
PDF mentése
```

### DOCX riport

```text
DOCX indítása
DOCX szöveg hozzáadása
DOCX táblázat hozzáadása
DOCX screenshot / kép hozzáadása
DOCX mentése
```

### Watcher értesítés

```text
Figyelő trigger
  Feltétel: szöveg
Szöveg keresése az oldalon
Rendszerértesítés
Hangjelzés
```

---

## 28. Hibaelhárítás

### Egy blokk nem talál elemet

Ellenőrizd:

- jó oldalon fut-e;
- az elem látható-e;
- iframe-ben van-e;
- Shadow DOM alatt van-e;
- dinamikusan később töltődik-e be;
- kell-e Várj betöltésre blokk;
- kell-e belső görgetés.

### A kitöltött mező visszaürül

Használd a framework-kompatibilis kitöltési módot, vagy a szimulált gépelést.

### A táblázatsor nem található

Lehet, hogy virtualizált lista. Kapcsold be a görgetéses keresést, és növeld a max görgetési próbálkozást.

### A PDF előnézetben rossz fájlnév jelenik meg

Használd a Letöltés vagy Letöltés + előnézet módot. A böngésző saját PDF viewerének mentési neve blob előnézetnél eltérhet.

### A public log csak csíkként látszik

Olyan verziót használj, ahol a public log Shadow DOM-mal izolált. Frissítés után töltsd újra az extensiont és a céloldalt.

### Import után nem ellenőrzött marad

Futtass Ellenőrzést vagy Dry-runt. Siker esetén az állapot ellenőrzöttre vált. Módosítás után újra ellenőrzés szükséges lehet.

### Edge-ben nem vált workflow-t

Használj friss verziót, amelyben a Builder workflow-váltás böngészőfüggetlenebb, memóriából azonnal renderelő logikát használ.

### Vágólapról beolvasás nem működik

A vágólapolvasás böngészőpolicytől függ. A BlockFlow segédablakos fallbacket használhat, de céges policy ezt is korlátozhatja.

---

## 29. Karbantartási javaslatok

- Hosszú workflow-kat Csoport blokkokkal rendezz.
- A kockázatos műveleteket tesztelés alatt kapcsold ki csoportszinten.
- Dinamikus oldalaknál használj Várj betöltésre blokkot.
- Kattintás előtt hagyd bekapcsolva az automatikus görgetést.
- Importált workflow-t mindig ellenőrizz.
- Mini extension export előtt futtass dry-runt.
- Public logot csak debug idejére kapcsold be, ha zavarja a munkafelületet.
