const BF = (() => {
  const SCHEMA_VERSION = 21;

  const DEFAULT_WORKFLOW = () => ({
    id: crypto.randomUUID(),
    name: 'Új automatizmus',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: true,
    publicLogEnabled: false,
    publicLogWidth: 280,
    publicLogOpacity: 0.82,
    publicLogDownload: true,
    blocks: []
  });

  const BLOCKS = {
    trigger: { name: 'Indítás', desc: 'A workflow manuálisan indul.' },
    triggerGroup: { name: 'Figyelő trigger', desc: 'Indító-konténer: feltételek alapján automatikusan indítja a workflow-t.' },
    clickTrigger: { name: 'Kattintás trigger', desc: 'Automatikus indító: akkor indul, amikor a felhasználó a kiválasztott elemre kattint.' },
    conditionText: { name: 'Feltétel: szöveg', desc: 'Igaz, ha a megadott szöveg vagy karakter megjelenik az oldalon.' },
    conditionElement: { name: 'Feltétel: elem', desc: 'Igaz, ha a kiválasztott elem megtalálható az oldalon.' },
    conditionField: { name: 'Feltétel: mezőérték', desc: 'Igaz, ha egy mező értéke megfelel a megadott feltételnek.' },
    conditionUrl: { name: 'Feltétel: URL', desc: 'Igaz, ha az aktuális URL megfelel a megadott feltételnek.' },
    conditionChange: { name: 'Feltétel: érték változik', desc: 'Igaz, ha egy mező/szöveg az előző figyelési körhöz képest a megadott irányba változik.' },
    conditionGroup: { name: 'Feltételcsoport', desc: 'Figyelőn belüli logikai csoport: minden/bármelyik/egyik sem feltétel igaz.' },
    click: { name: 'Kattintás', desc: 'Kattint egy kiválasztott oldalelemre.' },
    fill: { name: 'Beillesztés / kitöltés', desc: 'Szöveget ír egy mezőbe framework-kompatibilis eseményekkel is.' },
    selectOption: { name: 'Legördülő opció kiválasztása', desc: 'Custom/modern dropdown megnyitása és opció kiválasztása szöveg alapján.' },
    injectCss: { name: 'CSS injektálása', desc: 'Egyedi CSS szabályokat szúr be az aktuális oldalba vagy eltávolítja a korábbi injektált stílust.' },
    extract: { name: 'Adat kinyerése', desc: 'Szöveget vagy mezőértéket változóba ment.' },
    wait: { name: 'Várakozás', desc: 'Időre, szövegre vagy elemre vár.' },
    ifBlock: { name: 'Ha...', desc: 'Feltételt ellenőriz, és hamis esetben átugorhat blokkokat.' },
    repeatBlock: { name: 'Ismételd...', desc: 'A következő N blokkot többször lefuttatja.' },
    popupWait: { name: 'Várj popupra', desc: 'Megvárja, amíg weboldali modal/popup megjelenik.' },
    popupExtract: { name: 'Popup adat kinyerése', desc: 'Popup címét vagy szövegét változóba menti.' },
    popupClick: { name: 'Popup gomb', desc: 'Popupban gombot nyom szöveg alapján.' },
    copy: { name: 'Vágólapra másolás', desc: 'Szöveget vagy változót másol.' },
    email: { name: 'Email összeállítása', desc: 'Email draftot készít változókból.' },
    openEmail: { name: 'Email megnyitása', desc: 'Mailto linket nyit; hosszú törzsnél vágólapra másol.' },
    rowLoop: { name: 'Minden sorra...', desc: 'Egyszerű táblázat/lista sorfeldolgozó konténer.' },
    mask: { name: 'Maszkolás', desc: 'Kinyert adat maszkolása karakterek vagy sorok alapján.' },
    userPrompt: { name: 'Felhasználói üzenet', desc: 'Futás közben felugró ablakot mutat, opcionálisan visszajelzésre vár.' },
    pageButton: { name: 'Oldalba illesztett gomb', desc: 'Gombot szúr be az aktuális oldalba, és kattintásig vár.' },

    transform: { name: 'Adat átalakítása', desc: 'Szöveg tisztítása, kis/nagybetű, számok/betűk megtartása.' },
    textSlice: { name: 'Szövegrész kinyerése', desc: 'Szöveget vág ki kezdő/záró minta, sor vagy karakter alapján.' },
    regex: { name: 'Regex keresés', desc: 'Reguláris kifejezés alapján találatot ment változóba.' },
    textSearch: { name: 'Szöveg keresése az oldalon', desc: 'Egyszerű szöveget keres az oldalon, és visszaadja a találat helyét is.' },
    errorSearch: { name: 'Hibaüzenet keresése', desc: 'Alert, validációs és hibaüzenet jellegű elemeket keres az oldalon.' },
    fieldByLabel: { name: 'Mező keresése címke alapján', desc: 'Enterprise/SNOW jellegű felületeken label vagy aria alapján mezőt keres.' },
    setVar: { name: 'Változó beállítása', desc: 'Fix vagy interpolált értéket ment változóba.' },
    userInput: { name: 'Adat bekérése', desc: 'Extension ablakban adatot kér a felhasználótól.' },
    userChoice: { name: 'Választás kérése', desc: 'Opciók közül választást kér, majd változóba menti.' },
    tableExtract: { name: 'Táblázatból kinyerés', desc: 'Sor/oszlop alapján adatot nyer ki táblázatból vagy listából.' },
    elementLoop: { name: 'Minden találatra...', desc: 'Több megtalált elemre futtatja a behúzott blokkokat.' },
    waitUntil: { name: 'Várj amíg...', desc: 'Feltétel teljesüléséig vár, timeouttal.' },
    waitLoad: { name: 'Várj betöltésre', desc: 'Kattintás, URL-váltás vagy SPA frissülés után megvárja, amíg az oldal/panel betöltődött.' },
    scroll: { name: 'Görgetés', desc: 'Oldalt vagy kijelölt elemet görget nézetbe.' },
    keyPress: { name: 'Billentyű lenyomása', desc: 'Enter, Tab, Escape, Ctrl+A/C/V vagy saját billentyűkombináció.' },
    clipboardRead: { name: 'Vágólapról beolvasás', desc: 'Vágólap szövegét változóba menti.' },
    openUrl: { name: 'URL megnyitása', desc: 'URL-t nyit aktuális tabon, új tabon vagy új ablakban.' },
    pageInfo: { name: 'Oldal adatai', desc: 'Aktuális URL, cím, domain változókba mentése.' },
    screenshot: { name: 'Képernyőkép', desc: 'Látható oldalrész képernyőképét készíti el.' },
    tryBlock: { name: 'Próbáld meg...', desc: 'Hibakezelő konténer: siker és hiba ág.' },
    preflight: { name: 'Elem ellenőrzése', desc: 'Ellenőrzi, hogy egy elem létezik-e futás előtt.' },
    localSet: { name: 'Lokális mentés', desc: 'Értéket ment lokális storage-ba.' },
    localGet: { name: 'Lokális beolvasás', desc: 'Értéket olvas lokális storage-ból.' },
    compare: { name: 'Összehasonlítás', desc: 'Két értéket összehasonlít, eredményt változóba ment.' },
    math: { name: 'Számítás', desc: 'Egyszerű matematikai műveletet végez.' },
    retryBlock: { name: 'Próbáld újra...', desc: 'Behúzott blokkokat többször próbál futtatni.' },
    popupWindowWait: { name: 'Várj új ablakra', desc: 'Új böngészőablakot vagy tabot vár URL/cím alapján.' },
    popupWindowExtract: { name: 'Új ablakból kinyerés', desc: 'Új ablak/tab oldaláról adatot kér le.' },
    popupWindowClose: { name: 'Új ablak bezárása', desc: 'Korábban megtalált popup/tab bezárása.' },
    iframeBlock: { name: 'Iframe-ben...', desc: 'Behúzott blokkok célját iframe kontextusban kezeli.' },
    findElements: { name: 'Elemek keresése', desc: 'Több elemet keres, találatszámot és szöveget ment.' },
    emailTemplate: { name: 'Email sablon használata', desc: 'Mentett email sablont tölt draft változóba.' },
    emailPreview: { name: 'Email előnézet', desc: 'Emailt megmutat, majd megnyitás/másolás/megszakítás döntést kér.' },
    validateData: { name: 'Adat validálása', desc: 'Változót ellenőriz email/nem üres/tartalmazza mintával.' },
    comment: { name: 'Megjegyzés', desc: 'Nem fut, csak dokumentáció a workflow-ban.' },
    groupBlock: { name: 'Csoport', desc: 'Vizuális csoportosító konténer.' },
    callWorkflow: { name: 'Másik automatizmus futtatása', desc: 'Másik workflow-t hív meg.' },
    returnResult: { name: 'Eredmény visszaadása', desc: 'Workflow eredményváltozót állít be.' },
    stopRun: { name: 'Leállítás', desc: 'Megállítja a futást megadott üzenettel.' },
    sound: { name: 'Hangjelzés', desc: 'Rövid hangjelzést ad, akár saját feltöltött hanggal.' },
    pdfStart: { name: 'PDF indítása', desc: 'Új PDF dokumentum létrehozása futás közben.' },
    pdfText: { name: 'PDF szöveg hozzáadása', desc: 'Szöveget, címsort vagy megjegyzést ad az aktuális PDF-hez.' },
    pdfTable: { name: 'PDF táblázat hozzáadása', desc: 'Kulcs-érték vagy oszlopos táblázatot ad az aktuális PDF-hez.' },
    pdfScreenshot: { name: 'PDF screenshot hozzáadása', desc: 'Képernyőképet ad az aktuális PDF-hez.' },
    pdfPageBreak: { name: 'PDF új oldal', desc: 'Oldaltörést szúr be az aktuális PDF-be.' },
    pdfSave: { name: 'PDF mentése / előnézet', desc: 'Az összeállított PDF letöltése vagy előnézete.' },
    docxStart: { name: 'DOCX indítása', desc: 'Új szerkeszthető Word/DOCX riport indítása.' },
    docxText: { name: 'DOCX szöveg hozzáadása', desc: 'Szöveget vagy címsort ad az aktuális DOCX dokumentumhoz.' },
    docxTable: { name: 'DOCX táblázat hozzáadása', desc: 'Kulcs-érték táblázatot ad a DOCX dokumentumhoz.' },
    docxScreenshot: { name: 'DOCX screenshot / kép hozzáadása', desc: 'Képernyőképet vagy képváltozót illeszt a DOCX dokumentumba.' },
    docxPageBreak: { name: 'DOCX új oldal', desc: 'Oldaltörést szúr be a DOCX dokumentumba.' },
    docxSave: { name: 'DOCX mentése', desc: 'Letölti az összeállított DOCX riportot.' },
    scheduledTrigger: { name: 'Időzített indítás', desc: 'Automatikus indítás időközönként vagy megadott időpontban.' },
    systemNotify: { name: 'Rendszerértesítés', desc: 'Chrome rendszerértesítést küld szerkeszthető szöveggel.' }
  };

  const PALETTE = [
    { cat: 'Indítás', type: 'trigger' },
    { cat: 'Indítás', type: 'triggerGroup' },
    { cat: 'Indítás', type: 'clickTrigger' },
    { cat: 'Indítás', type: 'scheduledTrigger' },
    { cat: 'Figyelő feltételek', type: 'conditionText' },
    { cat: 'Figyelő feltételek', type: 'conditionElement' },
    { cat: 'Figyelő feltételek', type: 'conditionField' },
    { cat: 'Figyelő feltételek', type: 'conditionUrl' },
    { cat: 'Figyelő feltételek', type: 'conditionChange' },
    { cat: 'Figyelő feltételek', type: 'conditionGroup' },
    { cat: 'Műveletek', type: 'click' },
    { cat: 'Műveletek', type: 'fill' },
    { cat: 'Műveletek', type: 'selectOption' },
    { cat: 'Műveletek', type: 'injectCss' },
    { cat: 'Műveletek', type: 'wait' },
    { cat: 'Műveletek', type: 'copy' },
    { cat: 'Műveletek', type: 'scroll' },
    { cat: 'Műveletek', type: 'keyPress' },
    { cat: 'Műveletek', type: 'openUrl' },
    { cat: 'Adatkinyerés', type: 'extract' },
    { cat: 'Adatkinyerés', type: 'tableExtract' },
    { cat: 'Adatkinyerés', type: 'findElements' },
    { cat: 'Adatkinyerés', type: 'pageInfo' },
    { cat: 'Adatkinyerés', type: 'screenshot' },
    { cat: 'Adatkinyerés', type: 'textSearch' },
    { cat: 'Adatkinyerés', type: 'errorSearch' },
    { cat: 'Adatkinyerés', type: 'fieldByLabel' },
    { cat: 'Adat', type: 'setVar' },
    { cat: 'Adat', type: 'transform' },
    { cat: 'Adat', type: 'textSlice' },
    { cat: 'Adat', type: 'regex' },
    { cat: 'Adat', type: 'clipboardRead' },
    { cat: 'Adat', type: 'localSet' },
    { cat: 'Adat', type: 'localGet' },
    { cat: 'Adat', type: 'compare' },
    { cat: 'Adat', type: 'math' },
    { cat: 'Adat', type: 'validateData' },
    { cat: 'Logika', type: 'ifBlock' },
    { cat: 'Logika', type: 'repeatBlock' },
    { cat: 'Logika', type: 'waitUntil' },
    { cat: 'Logika', type: 'waitLoad' },
    { cat: 'Logika', type: 'retryBlock' },
    { cat: 'Logika', type: 'tryBlock' },
    { cat: 'Logika', type: 'preflight' },
    { cat: 'Logika', type: 'stopRun' },
    { cat: 'Logika', type: 'comment' },
    { cat: 'Logika', type: 'groupBlock' },
    { cat: 'Logika', type: 'callWorkflow' },
    { cat: 'Logika', type: 'returnResult' },
    { cat: 'Felhasználó', type: 'userPrompt' },
    { cat: 'Felhasználó', type: 'pageButton' },
    { cat: 'Felhasználó', type: 'userInput' },
    { cat: 'Felhasználó', type: 'userChoice' },
    { cat: 'Felhasználó', type: 'systemNotify' },
    { cat: 'Felhasználó', type: 'sound' },
    { cat: 'Popup', type: 'popupWait' },
    { cat: 'Popup', type: 'popupExtract' },
    { cat: 'Popup', type: 'popupClick' },
    { cat: 'Popup', type: 'popupWindowWait' },
    { cat: 'Popup', type: 'popupWindowExtract' },
    { cat: 'Popup', type: 'popupWindowClose' },
    { cat: 'PDF', type: 'pdfStart' },
    { cat: 'PDF', type: 'pdfText' },
    { cat: 'PDF', type: 'pdfTable' },
    { cat: 'PDF', type: 'pdfScreenshot' },
    { cat: 'PDF', type: 'pdfPageBreak' },
    { cat: 'PDF', type: 'pdfSave' },
    { cat: 'DOCX', type: 'docxStart' },
    { cat: 'DOCX', type: 'docxText' },
    { cat: 'DOCX', type: 'docxTable' },
    { cat: 'DOCX', type: 'docxScreenshot' },
    { cat: 'DOCX', type: 'docxPageBreak' },
    { cat: 'DOCX', type: 'docxSave' },
    { cat: 'Haladó', type: 'iframeBlock' },
    { cat: 'Email', type: 'email' },
    { cat: 'Email', type: 'openEmail' },
    { cat: 'Email', type: 'emailTemplate' },
    { cat: 'Email', type: 'emailPreview' },
    { cat: 'Táblázat', type: 'rowLoop' },
    { cat: 'Táblázat', type: 'elementLoop' },
    { cat: 'Adatkinyerés', type: 'mask' }
  ];

  function newBlock(type) {
    const id = crypto.randomUUID();
    if (type === 'click') return { id, type, target: null, targetMode: 'manual', targetVar: '', timeoutMs: 5000, confirmRisky: true, autoScroll: true, clickMode: 'normal', clickableFallback: true, matchIndex: 1 };
    if (type === 'fill') return { id, type, target: null, value: '', timeoutMs: 5000, fillMode: 'framework', blurAfter: true, typeDelayMs: 25, shadowSearch: true };
    if (type === 'selectOption') return { id, type, target: null, targetMode: 'manual', targetVar: '', optionText: '', matchMode: 'contains', caseSensitive: false, timeoutMs: 5000, openDelayMs: 250, shadowSearch: true, scrollOptions: true, maxOptionScrolls: 10 };
    if (type === 'injectCss') return { id, type, mode: 'add', styleId: 'blockflow-custom-style', cssText: '', replaceExisting: true, resultName: 'css_injektalva' };
    if (type === 'extract') return { id, type, target: null, extractMode: 'auto', searchScope: 'dom', allowHidden: true, varName: 'adat', timeoutMs: 5000 };
    if (type === 'wait') return { id, type, waitMode: 'time', ms: 1000, text: '', target: null, timeoutMs: 5000 };
    if (type === 'triggerGroup') return { id, type, triggerEnabled: true, logic: 'all', scope: 'domain', domain: '', path: '/', url: '', urlContains: '', intervalSec: 2, throttleSec: 15, runOnce: false, children: [] };
    if (type === 'clickTrigger') return { id, type, triggerEnabled: true, target: null, scope: 'domain', domain: '', path: '/', url: '', urlContains: '', throttleSec: 15, runOnce: false };
    if (type === 'conditionText') return { id, type, text: '', caseSensitive: false };
    if (type === 'conditionElement') return { id, type, target: null, requireVisible: true };
    if (type === 'conditionField') return { id, type, target: null, operator: 'contains', value: '', caseSensitive: false };
    if (type === 'conditionUrl') return { id, type, operator: 'contains', value: '' };
    if (type === 'conditionChange') return { id, type, target: null, readMode: 'auto', attributeName: 'title', searchScope: 'dom', changeMode: 'fromTo', fromValue: '', toValue: '', operator: 'equals', caseSensitive: false, firstRun: 'learn' };
    if (type === 'conditionGroup') return { id, type, logic: 'all', children: [] };
    if (type === 'ifBlock') return { id, type, conditionMode: 'textExists', text: '', target: null, timeoutMs: 1000, value: '', children: [], elseChildren: [] };
    if (type === 'repeatBlock') return { id, type, repeatCount: 2, children: [] };
    if (type === 'popupWait') return { id, type, timeoutMs: 10000 };
    if (type === 'popupExtract') return { id, type, extractMode: 'text', varName: 'popup_szoveg' };
    if (type === 'popupClick') return { id, type, buttonText: 'OK', timeoutMs: 5000 };
    if (type === 'copy') return { id, type, value: '' };
    if (type === 'email') return { id, type, to: '{{email}}', subject: '', body: '', resultName: 'email_draft' };
    if (type === 'openEmail') return { id, type, draftName: 'email_draft', maxUrlLength: 1800 };
    if (type === 'rowLoop') return { id, type, target: null, rowVar: 'sor_szoveg', maxRows: 20, children: [] };
    if (type === 'mask') return { id, type, source: '{{adat}}', resultName: 'maszkolt_adat', maskMode: 'characters', invertMask: false, clearTrim: false, maskChar: '*', keepStart: 2, keepEnd: 2, keepFirstLines: 1, keepLastLines: 1, maskLineText: '***' };
    if (type === 'transform') return { id, type, source: '{{adat}}', operation: 'trim', resultName: 'atalakitott_adat' };
    if (type === 'textSlice') return { id, type, source: '{{adat}}', mode: 'between', startText: '', endText: '', lineNumber: 1, charStart: 0, charEnd: 100, resultName: 'szovegresz' };
    if (type === 'regex') return { id, type, source: '{{adat}}', pattern: '', flags: 'i', group: 0, allMatches: false, resultName: 'regex_talalat' };
    if (type === 'textSearch') return { id, type, query: '', operator: 'contains', searchScope: 'all', caseSensitive: false, includeValues: true, includeAttributes: true, resultName: 'szoveg_talalat', countName: 'szoveg_talalat_db', contextName: 'szoveg_talalat_szoveg', placeName: 'szoveg_talalat_hely', selectorName: 'szoveg_talalat_selector', xpathName: 'szoveg_talalat_xpath', elementName: 'szoveg_talalat_elem', rowSelectorName: 'szoveg_talalat_sor_selector', clickableSelectorName: 'szoveg_talalat_click_selector', parentSelectorName: 'szoveg_talalat_panel_selector', nearButtonSelectorName: 'szoveg_talalat_gomb_selector' };
    if (type === 'errorSearch') return { id, type, includeAlerts: true, includeAriaLive: true, includeErrorClasses: true, includeInvalidFields: true, resultName: 'hiba_van', textName: 'hiba_szoveg', selectorName: 'hiba_selector', countName: 'hiba_db' };
    if (type === 'fieldByLabel') return { id, type, labelText: '', matchMode: 'contains', caseSensitive: false, shadowSearch: true, resultName: 'mezo_ertek', selectorName: 'mezo_selector', xpathName: 'mezo_xpath', elementName: 'mezo_elem' };
    if (type === 'setVar') return { id, type, varName: 'valtozo', value: '' };
    if (type === 'pageButton') return { id, type, label: 'Folytatás', tooltip: 'Kattints a BlockFlow folytatásához', waitForClick: true, position: 'bottomRight', target: null, placement: 'floating', customRight: 24, customBottom: 24, customUnit: 'px', customZIndex: 2147483647, timeoutSec: 300, onTimeout: 'stop', removeAfterClick: true, resultName: 'button_clicked' };
    if (type === 'userInput') return { id, type, title: 'Adat bekérése', message: 'Adj meg egy értéket:', inputType: 'text', placeholder: '', defaultValue: '', resultName: 'user_input', feedbackStyle: 'default', accent: 'blue', windowSize: 'normal' };
    if (type === 'userChoice') return { id, type, title: 'Választás', message: 'Válassz egy opciót:', options: 'Igen\nNem', resultName: 'valasztas', feedbackStyle: 'default', accent: 'blue', windowSize: 'normal' };
    if (type === 'tableExtract') return { id, type, target: null, rowMode: 'first', rowIndex: 1, rowContains: '', rowColumnIndex: 0, columnMode: 'index', columnIndex: 1, columnHeader: '', includeHeader: false, skipEmptyRows: true, missingRowMode: 'empty', virtualSearch: false, maxScrolls: 10, scrollAmount: 600, resultName: 'tabla_adat', timeoutMs: 5000 };
    if (type === 'elementLoop') return { id, type, target: null, selector: '', itemVar: 'elem_szoveg', indexVar: 'elem_index', maxItems: 20, children: [] };
    if (type === 'waitUntil') return { id, type, conditionMode: 'textExists', text: '', target: null, operator: 'contains', value: '', timeoutMs: 10000, stableMs: 800, spinnerSelector: '' };
    if (type === 'waitLoad') return { id, type, loadMode: 'auto', target: null, spinnerSelector: '', stableMs: 800, timeoutMs: 15000, onTimeout: 'error' }; 
    if (type === 'scroll') return { id, type, mode: 'element', target: null, targetMode: 'manual', targetVar: '', scrollTarget: 'auto', scrollContainer: null, direction: 'down', amount: 500, align: 'center' };
    if (type === 'keyPress') return { id, type, target: null, key: 'Enter', ctrl: false, alt: false, shift: false, meta: false };
    if (type === 'clipboardRead') return { id, type, resultName: 'clipboard' };
    if (type === 'openUrl') return { id, type, url: '', mode: 'newTab' };
    if (type === 'pageInfo') return { id, type, prefix: 'page' };
    if (type === 'screenshot') return { id, type, resultName: 'screenshot_data_url', action: 'preview', fileName: 'blockflow-screenshot' };
    if (type === 'tryBlock') return { id, type, children: [], elseChildren: [] };
    if (type === 'preflight') return { id, type, target: null, targetMode: 'manual', targetVar: '', requireVisible: false, onFail: 'stop' };
    if (type === 'localSet') return { id, type, key: '', value: '' };
    if (type === 'localGet') return { id, type, key: '', resultName: 'local_adat', defaultValue: '' };
    if (type === 'compare') return { id, type, left: '{{adat}}', operator: 'equals', right: '', resultName: 'osszehasonlitas' };
    if (type === 'math') return { id, type, left: '0', operator: 'add', right: '1', resultName: 'szamitas' };
    if (type === 'retryBlock') return { id, type, attempts: 3, delayMs: 1000, children: [] };
    if (type === 'popupWindowWait') return { id, type, matchMode: 'urlContains', value: '', timeoutMs: 15000, resultName: 'popup_tab_id' };
    if (type === 'popupWindowExtract') return { id, type, tabVar: 'popup_tab_id', target: null, extractMode: 'auto', varName: 'popup_adat', timeoutMs: 5000 };
    if (type === 'popupWindowClose') return { id, type, tabVar: 'popup_tab_id' };
    if (type === 'iframeBlock') return { id, type, target: null, iframeMode: 'manual', urlContains: '', iframeIndex: 1, children: [] };
    if (type === 'findElements') return { id, type, target: null, selector: '', resultName: 'talalatok', countName: 'talalat_db', maxItems: 50 };
    if (type === 'emailTemplate') return { id, type, templateId: '', to: '{{email}}', resultName: 'email_draft' };
    if (type === 'emailPreview') return { id, type, draftName: 'email_draft', resultName: 'email_preview_action', feedbackStyle: 'default', accent: 'blue', windowSize: 'large' };
    if (type === 'validateData') return { id, type, source: '{{adat}}', validation: 'notEmpty', pattern: '', onFail: 'stop' };
    if (type === 'comment') return { id, type, note: 'Megjegyzés...' };
    if (type === 'groupBlock') return { id, type, title: 'Csoport', groupEnabled: true, collapsed: false, children: [] };
    if (type === 'callWorkflow') return { id, type, workflowId: '', resultPrefix: 'called' };
    if (type === 'returnResult') return { id, type, value: '{{adat}}', resultName: 'result' };
    if (type === 'stopRun') return { id, type, message: 'Futás leállítva.' };
    if (type === 'sound') return { id, type, soundSource: 'builtIn', tone: 'success', customSoundName: '', customSoundData: '', volume: 0.7, repeatCount: 1 };
    if (type === 'scheduledTrigger') return { id, type, triggerEnabled: true, scheduleMode: 'interval', intervalMinutes: 15, timeOfDay: '08:00', days: 'mon,tue,wed,thu,fri' };
    if (type === 'userPrompt') return { id, type, title: 'BlockFlow', message: 'Ellenőrizd az eredményt, majd folytasd.', mode: 'wait', buttonText: 'Folytatás', cancelText: 'Megszakítás', resultName: '', feedbackStyle: 'default', accent: 'blue', windowSize: 'normal' };
    if (type === 'systemNotify') return { id, type, title: 'BlockFlow', message: 'Az automatizmus elért egy értesítési ponthoz.' };
    if (type === 'pdfStart') return { id, type, title: 'BlockFlow riport', fileName: 'blockflow-riport.pdf', pageSize: 'a4', orientation: 'portrait', margin: 40, fontSize: 11, header: '', footer: 'date,page,url' };
    if (type === 'pdfText') return { id, type, heading: '', text: 'Szöveg: {{adat}}', style: 'normal', align: 'left', fontSize: 11, spaceAfter: 10 };
    if (type === 'pdfTable') return { id, type, title: 'Adatok', rows: 'Ticket | {{ticket_id}}\nStátusz | {{status}}', border: true, columnMode: '30/70', emptyValue: '-' };
    if (type === 'pdfScreenshot') return { id, type, source: 'current', dataVar: 'screenshot_data_url', caption: 'Képernyőkép', sizeMode: 'fitWidth', pageBreakBefore: false, border: true };
    if (type === 'pdfPageBreak') return { id, type, onlyIfLowSpace: false };
    if (type === 'pdfSave') return { id, type, action: 'downloadPreview', fileName: '{{today}}_blockflow-riport.pdf', previewBeforeSave: false };
    if (type === 'docxStart') return { id, type, title: 'BlockFlow riport', fileName: '{{today}}_blockflow-riport.docx', pageSize: 'a4', orientation: 'portrait', margin: 720, fontSize: 22 };
    if (type === 'docxText') return { id, type, heading: '', text: 'Szöveg: {{adat}}', style: 'normal', align: 'left' };
    if (type === 'docxTable') return { id, type, title: 'Adatok', rows: 'Ticket | {{ticket_id}}\nStátusz | {{status}}', border: true, emptyValue: '-' };
    if (type === 'docxScreenshot') return { id, type, source: 'current', dataVar: 'screenshot_data_url', caption: 'Képernyőkép', width: 600, pageBreakBefore: false };
    if (type === 'docxPageBreak') return { id, type };
    if (type === 'docxSave') return { id, type, fileName: '' };
    return { id, type };
  }

  function blockTitle(block) {
    const meta = BLOCKS[block.type] || { name: block.type };
    if (block.type === 'click') return `Kattints: ${block.target?.label || (block.targetMode && block.targetMode !== 'manual' ? (block.targetMode === 'selector' ? '{{' + (block.targetVar || 'szoveg_talalat_selector') + '}}' : block.targetMode === 'xpath' ? '{{' + (block.targetVar || 'szoveg_talalat_xpath') + '}}' : '{{' + (block.targetVar || 'last_element') + '}}') : 'nincs kiválasztva')}`;
    if (block.type === 'fill') return `Illeszd be ide: ${block.target?.label || (block.targetMode && block.targetMode !== 'manual' ? '{{' + (block.targetVar || 'last_element') + '}}' : 'nincs kiválasztva')}`;
    if (block.type === 'extract') return `Nyerd ki: ${block.target?.label || 'nincs kiválasztva'} → {{${block.varName || 'adat'}}}`;
    if (block.type === 'wait') return block.waitMode === 'time' ? `Várj ${block.ms || 1000} ms` : `Várakozás: ${block.waitMode}`;
    if (block.type === 'triggerGroup') return `Figyelő trigger: ${triggerLogicLabel(block.logic || 'all')}`;
    if (block.type === 'clickTrigger') return `Kattintás trigger: ${block.target?.label || 'nincs cél elem'}`;
    if (block.type === 'conditionText') return `Feltétel: szöveg megjelenik: ${short(block.text || 'szöveg/karakter')}`;
    if (block.type === 'conditionElement') return `Feltétel: elem megjelenik: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'conditionField') return `Feltétel: mezőérték ${operatorLabel(block.operator || 'contains')} ${short(block.value || '')}`;
    if (block.type === 'conditionUrl') return `Feltétel: URL ${operatorLabel(block.operator || 'contains')} ${short(block.value || '')}`;
    if (block.type === 'conditionChange') return `Feltétel: érték változik ${changeModeLabel(block.changeMode || 'fromTo', block.fromValue || '', block.toValue || '')}`;
    if (block.type === 'conditionGroup') return `Feltételcsoport: ${triggerLogicLabel(block.logic || 'all')}`;
    if (block.type === 'ifBlock') return `Ha: ${conditionLabel(block)}`;
    if (block.type === 'repeatBlock') return `Ismételd ${block.repeatCount || 2} alkalommal`;
    if (block.type === 'popupWait') return 'Várj weboldali popupra';
    if (block.type === 'popupExtract') return `Popupból nyerd ki → {{${block.varName || 'popup_szoveg'}}}`;
    if (block.type === 'popupClick') return `Popup gomb: ${block.buttonText || 'OK'}`;
    if (block.type === 'copy') return 'Másold vágólapra';
    if (block.type === 'email') return `Email összeállítása → {{${block.resultName || 'email_draft'}}}`;
    if (block.type === 'openEmail') return `Email megnyitása: {{${block.draftName || 'email_draft'}}}`;
    if (block.type === 'rowLoop') return `Minden sorra: ${block.target?.label || 'nincs lista/táblázat'}`;
    if (block.type === 'mask') return `Maszkolás → {{${block.resultName || 'maszkolt_adat'}}}`;
    if (block.type === 'transform') return `Adat átalakítása → {{${block.resultName || 'atalakitott_adat'}}}`;
    if (block.type === 'textSlice') return `Szövegrész kinyerése → {{${block.resultName || 'szovegresz'}}}`;
    if (block.type === 'regex') return `Regex keresés → {{${block.resultName || 'regex_talalat'}}}`;
    if (block.type === 'textSearch') return `Szöveg keresése: ${short(block.query || '')} → {{${block.selectorName || 'szoveg_talalat_selector'}}}`;
    if (block.type === 'errorSearch') return `Hibaüzenet keresése → {{${block.resultName || 'hiba_van'}}}`;
    if (block.type === 'fieldByLabel') return `Mező címke alapján: ${short(block.labelText || '')} → {{${block.resultName || 'mezo_ertek'}}}`;
    if (block.type === 'setVar') return `Változó: {{${block.varName || 'valtozo'}}}`;
    if (block.type === 'userInput') return `Adat bekérése → {{${block.resultName || 'user_input'}}}`;
    if (block.type === 'userChoice') return `Választás → {{${block.resultName || 'valasztas'}}}`;
    if (block.type === 'selectOption') return 'Legördülő opció: ' + (block.optionText || 'nincs opció');
    if (block.type === 'tableExtract') return `Táblázatból kinyerés → {{${block.resultName || 'tabla_adat'}}}`;
    if (block.type === 'elementLoop') return `Minden találatra: {{${block.itemVar || 'elem_szoveg'}}}`;
    if (block.type === 'waitUntil') return `Várj amíg: ${conditionLabel(block)}`;
    if (block.type === 'waitLoad') return `Várj betöltésre: ${loadModeLabel(block.loadMode || 'auto')}`;
    if (block.type === 'scroll') return `Görgetés: ${block.mode || 'element'}`;
    if (block.type === 'keyPress') return `Billentyű: ${block.key || 'Enter'}`;
    if (block.type === 'clipboardRead') return `Vágólap beolvasása → {{${block.resultName || 'clipboard'}}}`;
    if (block.type === 'openUrl') return `URL megnyitása: ${short(block.url || '')}`;
    if (block.type === 'pageInfo') return `Oldal adatai → {{${block.prefix || 'page'}_*}}`;
    if (block.type === 'screenshot') return `Képernyőkép → {{${block.resultName || 'screenshot_data_url'}}}`;
    if (block.type === 'tryBlock') return `Próbáld meg / hiba esetén`;
    if (block.type === 'preflight') return `Elem ellenőrzése: ${block.target?.label || 'nincs elem'}`;
    if (block.type === 'localSet') return `Lokális mentés: ${block.key || 'kulcs'}`;
    if (block.type === 'localGet') return `Lokális beolvasás → {{${block.resultName || 'local_adat'}}}`;
    if (block.type === 'compare') return `Összehasonlítás → {{${block.resultName || 'osszehasonlitas'}}}`;
    if (block.type === 'math') return `Számítás → {{${block.resultName || 'szamitas'}}}`;
    if (block.type === 'retryBlock') return `Próbáld újra ${block.attempts || 3}x`;
    if (block.type === 'popupWindowWait') return `Várj új ablakra → {{${block.resultName || 'popup_tab_id'}}}`;
    if (block.type === 'popupWindowExtract') return `Új ablakból kinyerés → {{${block.varName || 'popup_adat'}}}`;
    if (block.type === 'popupWindowClose') return `Új ablak bezárása`;
    if (block.type === 'iframeBlock') return `Iframe-ben: ${block.target?.label || 'nincs iframe'}`;
    if (block.type === 'findElements') return `Elemek keresése → {{${block.countName || 'talalat_db'}}}`;
    if (block.type === 'emailTemplate') return `Email sablon használata → {{${block.resultName || 'email_draft'}}}`;
    if (block.type === 'emailPreview') return `Email előnézet: {{${block.draftName || 'email_draft'}}}`;
    if (block.type === 'validateData') return `Validálás: ${block.validation || 'notEmpty'}`;
    if (block.type === 'comment') return `Megjegyzés`;
    if (block.type === 'groupBlock') return `Csoport: ${short(block.title || '')}${block.groupEnabled === false ? ' (kikapcsolva)' : ''}`;
    if (block.type === 'callWorkflow') return `Másik automatizmus futtatása`;
    if (block.type === 'returnResult') return `Eredmény visszaadása → {{${block.resultName || 'result'}}}`;
    if (block.type === 'stopRun') return `Leállítás`;
    if (block.type === 'sound') return block.soundSource === 'custom' ? `Hangjelzés: saját hang${block.customSoundName ? ' · ' + short(block.customSoundName) : ''}` : `Hangjelzés: ${block.tone || 'success'}`;
    if (block.type === 'pdfStart') return `PDF indítása: ${short(block.fileName || 'riport.pdf')}`;
    if (block.type === 'pdfText') return `PDF szöveg: ${short(block.heading || block.text || '')}`;
    if (block.type === 'pdfTable') return `PDF táblázat: ${short(block.title || 'Adatok')}`;
    if (block.type === 'pdfScreenshot') return `PDF screenshot: ${short(block.caption || block.source || '')}`;
    if (block.type === 'pdfPageBreak') return 'PDF új oldal';
    if (block.type === 'pdfSave') return `PDF mentése: ${short(block.fileName || 'riport.pdf')}`;
    if (block.type === 'docxStart') return `DOCX indítása: ${short(block.fileName || 'riport.docx')}`;
    if (block.type === 'docxText') return `DOCX szöveg: ${short(block.heading || block.text || '')}`;
    if (block.type === 'docxTable') return `DOCX táblázat: ${short(block.title || 'Adatok')}`;
    if (block.type === 'docxScreenshot') return `DOCX screenshot: ${short(block.caption || block.source || '')}`;
    if (block.type === 'docxPageBreak') return 'DOCX új oldal';
    if (block.type === 'docxSave') return `DOCX mentése: ${short(block.fileName || 'riport.docx')}`;
    if (block.type === 'scheduledTrigger') return `Időzített indítás: ${block.scheduleMode === 'daily' ? block.timeOfDay : (block.intervalMinutes || 15) + ' percenként'}`;
    if (block.type === 'userPrompt') return `${block.mode === 'wait' ? 'Várj visszajelzésre' : 'Felugró üzenet'}: ${short(block.title || 'BlockFlow')}`;
    if (block.type === 'systemNotify') return `Rendszerértesítés: ${short(block.title || 'BlockFlow')}`;
    return meta.name;
  }

  function conditionLabel(block) {
    if (block.conditionMode === 'textExists') return `szöveg létezik: ${short(block.text || '')}`;
    if (block.conditionMode === 'elementExists') return `elem létezik: ${block.target?.label || 'nincs elem'}`;
    if (block.conditionMode === 'valueContains') return `elem értéke tartalmazza: ${short(block.value || '')}`;
    if (block.conditionMode === 'urlContains') return `URL tartalmazza: ${short(block.value || '')}`;
    return block.conditionMode || 'feltétel';
  }

  function triggerLogicLabel(logic) {
    return ({ all:'minden feltétel igaz', any:'bármelyik feltétel igaz', none:'egyik feltétel sem igaz' })[logic || 'all'] || logic;
  }

  function changeModeLabel(mode, fromValue = '', toValue = '') {
    const from = short(fromValue || 'bármi', 28);
    const to = short(toValue || 'bármi', 28);
    if (mode === 'anyTo') return `bármi → ${to}`;
    if (mode === 'fromAny') return `${from} → bármi`;
    if (mode === 'anyChange') return 'bármilyen változás';
    return `${from} → ${to}`;
  }

  function loadModeLabel(mode) {
    return ({ auto:'automatikus', pageReady:'oldal betöltődött', domStable:'DOM stabil', spinnerGone:'spinner eltűnt', elementVisible:'elem megjelent', elementClickable:'elem kattintható' })[mode || 'auto'] || mode;
  }

  function operatorLabel(op) {
    return ({ contains:'tartalmazza', notContains:'nem tartalmazza', equals:'pontosan ez', notEquals:'nem pontosan ez', empty:'üres', notEmpty:'nem üres', startsWith:'ezzel kezdődik', endsWith:'ezzel végződik' })[op || 'contains'] || op;
  }

  function blockDesc(block) {
    if (block.type === 'fill') return `Mit: ${short(block.value || '')}`;
    if (block.type === 'extract') return `Mód: ${block.extractMode || 'auto'} · ${block.searchScope === 'visible' ? 'látható' : 'teljes DOM'}`;
    if (block.type === 'wait') return block.waitMode === 'text' ? `Szöveg: ${block.text || ''}` : (block.target?.label || '');
    if (block.type === 'userPrompt') return `${block.mode === 'wait' ? 'megáll és visszajelzésre vár' : 'csak értesít'} · ${short(block.message || '')}`;
    if (block.type === 'systemNotify') return short(block.message || '');
    if (block.type === 'pdfStart') return `${block.pageSize || 'A4'} · ${block.orientation === 'landscape' ? 'fekvő' : 'álló'} · margó ${block.margin || 40}`;
    if (block.type === 'pdfText') return short(block.text || '');
    if (block.type === 'pdfTable') return `${(block.rows || '').split('\n').filter(Boolean).length} sor`;
    if (block.type === 'pdfScreenshot') return `${block.source || 'current'} · ${block.sizeMode || 'fitWidth'}`;
    if (block.type === 'pdfSave') return block.action || 'downloadPreview';
    if (block.type === 'triggerGroup') {
      const scope = block.scope || 'domain';
      const labels = { domain:'domain', path:'domain + path', exact:'pontos URL', contains:'URL tartalmazza', any:'bármely oldal' };
      let detail = '';
      if (scope === 'domain') detail = block.domain || 'aktuális domain';
      else if (scope === 'path') detail = `${block.domain || 'aktuális domain'}${block.path || '/'}`;
      else if (scope === 'exact') detail = block.url || 'aktuális URL';
      else if (scope === 'contains') detail = block.urlContains || 'nincs részlet megadva';
      else detail = 'minden oldal';
      return `${block.triggerEnabled === false ? 'inaktív' : 'aktív'} · ${triggerLogicLabel(block.logic || 'all')} · ${labels[scope] || scope}: ${detail} · ${block.throttleSec || 15} mp szünet`;
    }
    if (block.type === 'conditionText') return `${block.caseSensitive ? 'kis/nagybetű számít' : 'kis/nagybetű nem számít'} · ${short(block.text || '')}`;
    if (block.type === 'clickTrigger') return block.target?.label || 'Nincs cél elem';
    if (block.type === 'conditionElement') return block.target?.label || 'Nincs cél elem';
    if (block.type === 'conditionField') return `${block.target?.label || 'nincs mező'} · ${operatorLabel(block.operator || 'contains')} · ${short(block.value || '')}`;
    if (block.type === 'conditionUrl') return `${operatorLabel(block.operator || 'contains')} · ${short(block.value || '')}`;
    if (block.type === 'conditionChange') return `${block.target?.label || 'nincs mező'} · ${changeModeLabel(block.changeMode || 'fromTo', block.fromValue || '', block.toValue || '')} · ${operatorLabel(block.operator || 'equals')}`;
    if (block.type === 'ifBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk csak igaz feltételnél fut.`;
    if (block.type === 'repeatBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk ismétlődik.`;
    if (block.type === 'rowLoop') return `Max sor: ${block.maxRows || 20} · gyermek blokkok: ${(block.children||[]).length}`;
    if (block.type === 'email') return `Címzett: ${block.to || ''} | Tárgy: ${short(block.subject || '')}`;
    if (block.type === 'copy') return short(block.value || '');
    if (block.type === 'mask') return `${block.maskMode === 'lines' ? 'Soralapú' : 'Karakteralapú'}${block.invertMask ? ' · invert' : ''}${block.clearTrim ? ' · clear/trim' : ''} · Forrás: ${short(block.source || '')}`;
    if (block.type === 'textSearch') return `${block.searchScope === 'visible' ? 'látható szöveg' : block.searchScope === 'dom' ? 'teljes DOM' : 'teljes oldal'} · selector: {{${block.selectorName || 'szoveg_talalat_selector'}}} · sor: {{${block.rowSelectorName || 'szoveg_talalat_sor_selector'}}}`;
    if (block.type === 'errorSearch') return `alert/error/invalid keresés · szöveg: {{${block.textName || 'hiba_szoveg'}}}`;
    if (block.type === 'fieldByLabel') return `${block.matchMode === 'equals' ? 'pontos címke' : 'címke tartalmazza'} · selector: {{${block.selectorName || 'mezo_selector'}}}`;
    if (['transform','textSlice','regex','setVar','compare','math','validateData'].includes(block.type)) return `Forrás: ${short(block.source || block.left || block.value || '')}`;
    if (['comment','groupBlock'].includes(block.type)) return short(block.note || block.title || '');
    if (block.type === 'waitLoad') return `${loadModeLabel(block.loadMode || 'auto')} · timeout ${block.timeoutMs || 15000} ms · stabil ${block.stableMs || 800} ms`;
    if (block.type === 'scheduledTrigger') return block.triggerEnabled === false ? 'inaktív' : 'mentés után automatikus időzítőként aktív';
    return (BLOCKS[block.type] || {}).desc || '';
  }

  function short(s, n=90){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }

  function prepareDefaultWorkflows(payload) {
    const incoming = Array.isArray(payload?.workflows) ? payload.workflows : (payload?.blocks ? [payload] : []);
    const stamp = new Date().toISOString();
    return incoming.filter(w => w && Array.isArray(w.blocks)).map(w => ({
      ...w,
      id: w.id || crypto.randomUUID(),
      source: w.source || 'default',
      defaultSource: true,
      imported: w.imported === true,
      verified: w.verified === true,
      importedAt: w.importedAt || stamp,
      updatedAt: w.updatedAt || stamp,
      name: w.name || 'Alap automatizmus'
    }));
  }

  async function loadDefaultWorkflowsIfAvailable() {
    try {
      const response = await fetch(chrome.runtime.getURL('default.json'), { cache: 'no-store' });
      if (!response.ok) return [];
      const payload = await response.json();
      return prepareDefaultWorkflows(payload);
    } catch (err) {
      console.warn('Default automatizmusok betöltése sikertelen:', err);
      return [];
    }
  }

  async function getStore() {
    const data = await chrome.storage.local.get(['workflows', 'activeWorkflowId', 'templates', 'defaultsImported']);
    let workflows = Array.isArray(data.workflows) ? data.workflows : [];
    let templates = Array.isArray(data.templates) ? data.templates : defaultTemplates();

    if (!workflows.length && data.defaultsImported !== true) {
      const defaultWorkflows = await loadDefaultWorkflowsIfAvailable();
      if (defaultWorkflows.length) {
        workflows = defaultWorkflows;
        const activeWorkflowId = workflows[0].id;
        await chrome.storage.local.set({ workflows, activeWorkflowId, templates, defaultsImported: true });
        return { workflows, activeWorkflowId, templates };
      }
      await chrome.storage.local.set({ defaultsImported: true });
    }

    if (!workflows.length) {
      const w = DEFAULT_WORKFLOW();
      workflows = [w];
      await chrome.storage.local.set({ workflows, activeWorkflowId: w.id, templates });
      return { workflows, activeWorkflowId: w.id, templates };
    }

    if (!Array.isArray(data.templates)) await chrome.storage.local.set({ templates });
    return { workflows, activeWorkflowId: data.activeWorkflowId || workflows[0].id, templates };
  }

  function defaultTemplates() {
    return [{ id: crypto.randomUUID(), name: 'Alap email sablon', subject: 'Megkeresés - {{nev}}', body: 'Kedves {{nev}},\n\n{{popup_szoveg}}\n\nÜdvözlettel,' }];
  }

  async function getTemplates() {
    const data = await chrome.storage.local.get('templates');
    if (Array.isArray(data.templates)) return data.templates;
    const t = defaultTemplates();
    await chrome.storage.local.set({ templates: t });
    return t;
  }

  async function saveTemplates(templates) { await chrome.storage.local.set({ templates }); }

  async function pushVersion(workflow) {
    if (!workflow?.id) return;
    const key = `versions_${workflow.id}`;
    const data = await chrome.storage.local.get(key);
    const versions = Array.isArray(data[key]) ? data[key] : [];
    versions.unshift({ at: new Date().toISOString(), workflow: typeof structuredClone === 'function' ? structuredClone(workflow) : JSON.parse(JSON.stringify(workflow)) });
    await chrome.storage.local.set({ [key]: versions.slice(0, 20) });
  }

  async function getVersions(workflowId) {
    const key = `versions_${workflowId}`;
    const data = await chrome.storage.local.get(key);
    return Array.isArray(data[key]) ? data[key] : [];
  }

  async function saveWorkflow(workflow) {
    const store = await getStore();
    workflow.updatedAt = new Date().toISOString();
    const workflows = store.workflows.map(w => w.id === workflow.id ? workflow : w);
    const existing = store.workflows.find(w => w.id === workflow.id);
    if (existing) await pushVersion(existing);
    if (!workflows.find(w => w.id === workflow.id)) workflows.push(workflow);
    await chrome.storage.local.set({ workflows, activeWorkflowId: workflow.id });
  }

  async function setActiveWorkflow(id) { await chrome.storage.local.set({ activeWorkflowId: id }); }

  function downloadJson(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportPayload(workflows) {
    return { app: 'BlockFlow Automation MVP', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), workflows };
  }

  function walkBlocks(blocks, fn) {
    for (const b of blocks || []) {
      fn(b);
      if (Array.isArray(b.children)) walkBlocks(b.children, fn);
      if (Array.isArray(b.elseChildren)) walkBlocks(b.elseChildren, fn);
    }
  }

  function analyzeImport(payload) {
    const incoming = Array.isArray(payload?.workflows) ? payload.workflows : (payload?.blocks ? [payload] : []);
    if (!incoming.length) throw new Error('Nem található importálható workflow.');
    const workflows = incoming.map(w => {
      const types = [];
      let riskyCount = 0;
      walkBlocks(w.blocks || [], b => {
        if (b.type) types.push(b.type);
        if (['click','fill','openEmail','popupClick','copy'].includes(b.type)) riskyCount++;
      });
      return {
        name: w.name || 'Importált automatizmus',
        blockCount: types.length,
        blocks: types,
        riskyCount,
        originalId: w.id || null
      };
    });
    return { schemaVersion: payload?.schemaVersion || 1, workflows, rawCount: incoming.length };
  }

  async function importPayload(payload) {
    const incoming = Array.isArray(payload?.workflows) ? payload.workflows : (payload?.blocks ? [payload] : []);
    if (!incoming.length) throw new Error('Nem található importálható workflow.');
    const store = await getStore();
    const stamp = new Date().toISOString();
    const prepared = incoming.map(w => ({
      ...w,
      id: crypto.randomUUID(),
      imported: true,
      verified: false,
      importedAt: stamp,
      name: `${w.name || 'Importált automatizmus'} (import)`
    }));
    await chrome.storage.local.set({ workflows: [...store.workflows, ...prepared], activeWorkflowId: prepared[0].id });
    return prepared;
  }

  async function sendToTarget(payload, tabId) {
    return chrome.runtime.sendMessage({ type: 'SEND_TO_TARGET_TAB', payload, tabId });
  }

  async function getTargetTab(tabId) { return chrome.runtime.sendMessage({ type: 'GET_TARGET_TAB', tabId }); }

  function collectVariables(workflow) {
    const vars = new Set(['current_url', 'today', 'selected_text', 'popup_szoveg', 'last_result', 'last_text', 'last_value', 'last_selector', 'last_xpath', 'last_element', 'last_screenshot']);
    walkBlocks(workflow.blocks || [], b => {
      if (['extract','popupExtract'].includes(b.type) && b.varName) vars.add(b.varName);
      if (b.type === 'mask' && b.resultName) vars.add(b.resultName);
      if (b.type === 'email' && b.resultName) vars.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) vars.add(b.rowVar);
      if (b.type === 'elementLoop') { if (b.itemVar) vars.add(b.itemVar); if (b.indexVar) vars.add(b.indexVar); }
      ['transform','textSlice','regex','textSearch','errorSearch','fieldByLabel','setVar','userInput','userChoice','tableExtract','clipboardRead','screenshot','localGet','compare','math','returnResult','findElements','emailTemplate','emailPreview'].forEach(t => { if (b.type === t && (b.resultName || b.varName || b.countName)) { if (b.resultName) vars.add(b.resultName); if (b.varName) vars.add(b.varName); if (b.countName) vars.add(b.countName); } });
      if (b.type === 'pageInfo') { const p = b.prefix || 'page'; vars.add(`${p}_url`); vars.add(`${p}_title`); vars.add(`${p}_domain`); vars.add(`${p}_path`); }
      if (b.type === 'textSearch') { ['resultName','countName','contextName','placeName','selectorName','xpathName','elementName','rowSelectorName','clickableSelectorName','parentSelectorName','nearButtonSelectorName'].forEach(k => { if (b[k]) vars.add(b[k]); }); vars.add('szoveg_talalat_lista'); }
      if (b.type === 'errorSearch') { ['resultName','textName','selectorName','countName'].forEach(k => { if (b[k]) vars.add(b[k]); }); }
      if (b.type === 'fieldByLabel') { ['resultName','selectorName','xpathName','elementName'].forEach(k => { if (b[k]) vars.add(b[k]); }); }
      if (b.type === 'pageButton') { vars.add(b.resultName || 'button_clicked'); vars.add('button_clicked_at'); }
      if (b.type === 'pdfSave') vars.add('pdf_file_name');
      if (b.type === 'docxSave') vars.add('docx_file_name');
      if (b.type === 'popupWindowWait' && b.resultName) vars.add(b.resultName);
    });
    return [...vars];
  }

  function collectVariableRefs(workflow) {
    const refs = new Set();
    const re = /{{\s*([\w.-]+)\s*}}/g;
    walkBlocks(workflow.blocks || [], b => {
      for (const v of Object.values(b)) {
        if (typeof v === 'string') { let m; while ((m = re.exec(v))) refs.add(m[1]); }
      }
    });
    return [...refs];
  }


  const BLOCK_IO = {
    extract: { outputs: ['text:value', 'element:target'] },
    textSearch: { outputs: ['boolean:found', 'number:count', 'text:context', 'selector:selector', 'xpath:xpath', 'element:elementRef', 'selector:rowSelector', 'selector:clickableSelector'] },
    fieldByLabel: { outputs: ['text:value', 'selector:selector', 'xpath:xpath', 'element:elementRef'] },
    findElements: { outputs: ['text:list', 'number:count'] },
    tableExtract: { outputs: ['text:value'] },
    screenshot: { outputs: ['image:dataUrl'] },
    clipboardRead: { outputs: ['text:value'] },
    userInput: { outputs: ['text:value'] },
    userChoice: { outputs: ['text:value'] },
    pageButton: { outputs: ['boolean:clicked', 'time:clickedAt'] },
    errorSearch: { outputs: ['boolean:found', 'text:errorText', 'selector:selector', 'number:count'] },
    compare: { outputs: ['boolean:result'] },
    math: { outputs: ['number:result'] },
    pdfSave: { outputs: ['file:pdf'] },
    docxSave: { outputs: ['file:docx'] },
    popupWindowWait: { outputs: ['tab:tabId'] },
    callWorkflow: { outputs: ['object:prefixedVars'] }
  };

  const BLOCK_CAPABILITIES = {
    click: ['dom','elementRef','scroll'], fill: ['dom','elementRef','forms','frameworkEvents'], selectOption: ['dom','elementRef','dropdown'],
    extract: ['dom','elementRef','read'], textSearch: ['dom','textSearch','scrollSearch'], tableExtract: ['dom','table'],
    screenshot: ['tabs','capture'], pdfSave: ['downloads','pdf'], docxSave: ['downloads','docx'], systemNotify: ['notifications'],
    clipboardRead: ['clipboardRead'], copy: ['clipboardWrite'], openEmail: ['tabs','mailto','clipboardWrite'], openUrl: ['tabs'],
    triggerGroup: ['watcher','storage'], clickTrigger: ['clickWatcher','storage'], scheduledTrigger: ['alarms','storage'],
    userPrompt: ['feedbackWindow'], userInput: ['feedbackWindow'], userChoice: ['feedbackWindow'], emailPreview: ['feedbackWindow'],
    pageButton: ['pageOverlay'], sound: ['audio'], localSet: ['storage'], localGet: ['storage']
  };

  function blockOutputSpec(block) {
    if (!block) return [];
    const base = BLOCK_IO[block.type]?.outputs || [];
    const dynamic = [];
    if (block.varName) dynamic.push(`text:${block.varName}`);
    if (block.resultName) dynamic.push(`value:${block.resultName}`);
    if (block.countName) dynamic.push(`number:${block.countName}`);
    if (block.selectorName) dynamic.push(`selector:${block.selectorName}`);
    if (block.xpathName) dynamic.push(`xpath:${block.xpathName}`);
    if (block.elementName) dynamic.push(`element:${block.elementName}`);
    return [...new Set([...base, ...dynamic])];
  }

  function blockCapabilities(block) {
    return [...new Set(BLOCK_CAPABILITIES[block?.type] || [])];
  }

  function analyzeWorkflowCompatibility(workflow) {
    const capabilities = new Set();
    const outputs = [];
    let elementBlocks = 0;
    let dynamicTargets = 0;
    let feedbackBlocks = 0;
    walkBlocks(workflow?.blocks || [], b => {
      blockCapabilities(b).forEach(x => capabilities.add(x));
      const out = blockOutputSpec(b);
      if (out.length) outputs.push({ blockId: b.id, type: b.type, outputs: out });
      if (['click','fill','selectOption','extract','scroll','waitUntil','waitLoad','preflight','pageButton','tableExtract','fieldByLabel'].includes(b.type)) elementBlocks++;
      if (b.targetMode && b.targetMode !== 'manual') dynamicTargets++;
      if (['userPrompt','userInput','userChoice','emailPreview','pageButton'].includes(b.type)) feedbackBlocks++;
    });
    const recommendations = [];
    if (capabilities.has('watcher') || capabilities.has('clickWatcher')) recommendations.push('Figyelőknél érdemes domain/path scope-ot használni a felesleges DOM-ellenőrzés csökkentésére.');
    if (capabilities.has('textSearch')) recommendations.push('Nagy vagy virtualizált oldalon kapcsold be a görgetéses keresést csak akkor, ha tényleg szükséges.');
    if (elementBlocks) recommendations.push('Elem alapú blokkoknál stabilabb a selector + aria/data attribútum fallback, mint a puszta XPath.');
    if (feedbackBlocks) recommendations.push('Felhasználói interakciónál érdemes rövid címet és egyértelmű elsődleges gombot használni.');
    return { capabilities: [...capabilities], outputs, elementBlocks, dynamicTargets, feedbackBlocks, recommendations };
  }

  function validateWorkflow(workflow) {
    const issues = [];
    const defined = new Set(['current_url','today','selected_text','row_index','sor_szoveg','last_result','last_text','last_value','last_selector','last_xpath','last_element','last_screenshot']);
    walkBlocks(workflow.blocks || [], b => {
      if (b.type === 'extract' && b.varName) defined.add(b.varName);
      if (b.type === 'popupExtract' && b.varName) defined.add(b.varName);
      if (b.type === 'email' && b.resultName) defined.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) defined.add(b.rowVar);
      if (b.type === 'mask' && b.resultName) defined.add(b.resultName);
      if (b.type === 'elementLoop') { if (b.itemVar) defined.add(b.itemVar); if (b.indexVar) defined.add(b.indexVar); }
      ['transform','textSlice','regex','textSearch','errorSearch','fieldByLabel','setVar','userInput','userChoice','tableExtract','clipboardRead','screenshot','localGet','compare','math','returnResult','findElements','emailTemplate','emailPreview'].forEach(t => { if (b.type === t && (b.resultName || b.varName || b.countName)) { if (b.resultName) defined.add(b.resultName); if (b.varName) defined.add(b.varName); if (b.countName) defined.add(b.countName); } });
      if (b.type === 'pageInfo') { const p = b.prefix || 'page'; defined.add(`${p}_url`); defined.add(`${p}_title`); defined.add(`${p}_domain`); defined.add(`${p}_path`); }
      if (b.type === 'textSearch') { ['resultName','countName','contextName','placeName','selectorName','xpathName','elementName','rowSelectorName','clickableSelectorName','parentSelectorName','nearButtonSelectorName'].forEach(k => { if (b[k]) defined.add(b[k]); }); defined.add('szoveg_talalat_lista'); }
      if (b.type === 'errorSearch') { ['resultName','textName','selectorName','countName'].forEach(k => { if (b[k]) defined.add(b[k]); }); }
      if (b.type === 'fieldByLabel') { ['resultName','selectorName','xpathName','elementName'].forEach(k => { if (b[k]) defined.add(b[k]); }); }
      if (b.type === 'pageButton') { defined.add(b.resultName || 'button_clicked'); defined.add('button_clicked_at'); }
      if (b.type === 'pdfSave') defined.add('pdf_file_name');
      if (b.type === 'docxSave') defined.add('docx_file_name');
    });
    let starterCount = 0;
    walkBlocks(workflow.blocks || [], b => {
      if (b.type === 'trigger') starterCount++;
      if (b.type === 'triggerGroup' && b.triggerEnabled !== false) starterCount++;
      if (b.type === 'clickTrigger' && b.triggerEnabled !== false) starterCount++;
      if (b.type === 'scheduledTrigger' && b.triggerEnabled !== false) starterCount++;
    });
    if (!starterCount) issues.push({ level:'error', blockId:null, text:'Hiányzik az aktív indító blokk. Legalább egy szükséges: Indítás, aktív Figyelő trigger, Kattintás trigger vagy Időzített indítás.' });

    const needsTarget = ['click','fill','selectOption','extract','rowLoop'];
    function hasDynamicTarget(b) { return b && b.targetMode && b.targetMode !== 'manual' && String(b.targetVar || '').trim(); }
    walkBlocks(workflow.blocks || [], b => {
      if (needsTarget.includes(b.type) && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:`${BLOCKS[b.type]?.name || b.type}: hiányzik a cél elem.` });
      if (b.type === 'triggerGroup' && b.triggerEnabled !== false && !(b.children || []).length) issues.push({ level:'error', blockId:b.id, text:'Figyelő trigger: legalább egy feltétel szükséges.' });
      if (b.type === 'clickTrigger' && b.triggerEnabled !== false && !b.target) issues.push({ level:'error', blockId:b.id, text:'Kattintás trigger: hiányzik a figyelt cél elem.' });
      if ((b.type === 'conditionElement' || b.type === 'conditionField' || b.type === 'conditionChange') && !b.target) issues.push({ level:'error', blockId:b.id, text:`${BLOCKS[b.type]?.name || b.type}: hiányzik a cél elem.` });
      if (b.type === 'wait' && b.waitMode === 'element' && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:'Várakozás elemre: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && ['elementExists','valueContains'].includes(b.conditionMode) && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:'Ha blokk: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && b.conditionMode === 'textExists' && !String(b.text||'').trim()) issues.push({ level:'warning', blockId:b.id, text:'Ha blokk: üres keresett szöveg.' });
      if (b.type === 'conditionText' && !String(b.text||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Szöveg feltétel: üres figyelt szöveg.' });
      if (b.type === 'conditionUrl' && !['empty','notEmpty'].includes(b.operator || 'contains') && !String(b.value||'').trim()) issues.push({ level:'error', blockId:b.id, text:'URL feltétel: hiányzik az ellenőrzött érték.' });
      if (b.type === 'conditionChange') {
        const mode = b.changeMode || 'fromTo';
        if ((mode === 'fromTo' || mode === 'anyTo') && !String(b.toValue||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Érték változik feltétel: hiányzik a célérték.' });
        if ((mode === 'fromTo' || mode === 'fromAny') && !String(b.fromValue||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Érték változik feltétel: hiányzik a kiinduló érték.' });
      }
      if (b.type === 'email' && !String(b.to||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Email blokk: hiányzik a címzett.' });
      if (b.type === 'textSearch' && !String(b.query||'').trim()) issues.push({ level:'warning', blockId:b.id, text:'Szöveg keresése: üres keresett szöveg.' });
      if (b.type === 'fieldByLabel' && !String(b.labelText||'').trim()) issues.push({ level:'warning', blockId:b.id, text:'Mező keresése címke alapján: üres címke.' });
      if (b.type === 'mask' && !String(b.source||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Maszkolás blokk: hiányzik a forrás szöveg vagy változó.' });
      if (b.type === 'mask' && !String(b.resultName||'').trim()) issues.push({ level:'error', blockId:b.id, text:t('validation.maskMissingResult') });
      if (b.type === 'openEmail' && !String(b.draftName||'').trim()) issues.push({ level:'error', blockId:b.id, text:t('validation.emailMissingDraft') });
      if (b.type === 'openUrl' && !String(b.url||'').trim()) issues.push({ level:'error', blockId:b.id, text:t('validation.openUrlMissingUrl') });
      if (b.type === 'selectOption' && !String(b.optionText||'').trim()) issues.push({ level:'warning', blockId:b.id, text:t('validation.selectOptionEmpty') });
      if (b.type === 'scroll' && (b.mode || 'element') === 'element' && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:t('validation.scrollMissingTarget') });
      if (b.type === 'scroll' && b.direction === 'untilText' && !String(b.searchText||'').trim()) issues.push({ level:'warning', blockId:b.id, text:t('validation.scrollUntilTextEmpty') });
      if (b.type === 'waitLoad' && ['elementVisible','elementClickable'].includes(b.loadMode || '') && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:t('validation.waitLoadMissingTarget') });
      if (b.type === 'preflight' && !b.target && !hasDynamicTarget(b)) issues.push({ level:'error', blockId:b.id, text:t('validation.preflightMissingTarget') });
      if (b.type === 'pageButton' && ['afterTarget','beforeTarget'].includes(b.position || '') && !b.target) issues.push({ level:'error', blockId:b.id, text:t('validation.pageButtonMissingTarget') });
      if (b.type === 'click' && /delete|remove|send|submit|pay|confirm|order|törl|küld|fizet|rendel|végleges/i.test(`${b.target?.label || ''} ${b.target?.text || ''}`)) issues.push({ level:'warning', blockId:b.id, text:t('validation.riskyClick', { label: b.target?.label || t('validation.targetElement') }) });
    });
    for (const ref of collectVariableRefs(workflow)) {
      if (!defined.has(ref)) issues.push({ level:'warning', blockId:null, text:t('validation.variableNotDefined', { name: ref }) });
    }
    return { ok: !issues.some(i => i.level === 'error'), issues };
  }

  function countBlocks(blocks) {
    let n = 0;
    walkBlocks(blocks || [], () => n++);
    return n;
  }



  const I18N = {
    selected: 'auto',
    active: 'hu',
    fallback: 'hu',
    languages: [],
    dict: {},
    fallbackDict: {},
    loaded: false
  };

  async function fetchJson(path, fallback = {}) {
    try {
      const url = chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (err) {
      console.warn('BlockFlow i18n load failed:', path, err);
      return fallback;
    }
  }

  function normalizeLanguage(code) {
    return String(code || 'hu').toLowerCase().split('-')[0];
  }

  function resolveLanguage(selected, languages) {
    const list = (languages || []).filter(l => l.code && l.code !== 'auto');
    const supported = new Set(list.map(l => l.code));
    if (selected && selected !== 'auto' && supported.has(selected)) return selected;
    const browser = normalizeLanguage(navigator.language || 'hu');
    return supported.has(browser) ? browser : (I18N.fallback || 'hu');
  }

  async function initI18n() {
    const meta = await fetchJson('locales/languages.json', { fallback: 'hu', languages: [{ code:'auto', nativeName:'Auto' }, { code:'hu', nativeName:'Magyar', file:'hu.json' }] });
    I18N.languages = meta.languages || [];
    I18N.fallback = meta.fallback || 'hu';
    let selected = meta.default || 'auto';
    try {
      const store = await chrome.storage.local.get(['uiLanguage']);
      selected = store.uiLanguage || selected;
    } catch {}
    I18N.selected = selected;
    I18N.active = resolveLanguage(selected, I18N.languages);
    const activeInfo = I18N.languages.find(l => l.code === I18N.active) || { file: I18N.active + '.json' };
    const fallbackInfo = I18N.languages.find(l => l.code === I18N.fallback) || { file: I18N.fallback + '.json' };
    I18N.fallbackDict = await fetchJson('locales/' + (fallbackInfo.file || (I18N.fallback + '.json')), {});
    I18N.dict = I18N.active === I18N.fallback ? I18N.fallbackDict : await fetchJson('locales/' + (activeInfo.file || (I18N.active + '.json')), {});
    I18N.loaded = true;
    applyBlockTranslations();
    applyI18nToDom(document);
    return I18N;
  }

  async function setLanguage(code) {
    try { await chrome.storage.local.set({ uiLanguage: code || 'auto' }); } catch {}
    I18N.loaded = false;
    await initI18n();
    return I18N;
  }

  function t(key, vars) {
    const str = Object.prototype.hasOwnProperty.call(I18N.dict, key) ? I18N.dict[key]
      : (Object.prototype.hasOwnProperty.call(I18N.fallbackDict, key) ? I18N.fallbackDict[key] : key);
    if (!vars) return str;
    return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '');
  }

  function applyBlockTranslations() {
    for (const [type, meta] of Object.entries(BLOCKS)) {
      const name = t('block.' + type + '.name');
      const desc = t('block.' + type + '.desc');
      if (name && !name.startsWith('block.')) meta.name = name;
      if (desc && !desc.startsWith('block.')) meta.desc = desc;
    }
    PALETTE.forEach(item => {
      if (!item.__catKey) item.__catKey = item.cat;
      const cat = t('category.' + item.__catKey);
      if (cat && !cat.startsWith('category.')) item.cat = cat;
    });
  }

  function applyI18nToDom(root = document) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    const html = document.documentElement;
    if (html) html.lang = I18N.active || 'hu';
  }

  function languageLabel(code) {
    const item = I18N.languages.find(l => l.code === code) || I18N.languages.find(l => l.code === I18N.active);
    return item?.nativeName || item?.label || String(code || '').toUpperCase();
  }

  return { SCHEMA_VERSION, DEFAULT_WORKFLOW, BLOCKS, PALETTE, newBlock, blockTitle, blockDesc, triggerLogicLabel, operatorLabel, changeModeLabel, blockOutputSpec, blockCapabilities, analyzeWorkflowCompatibility, getStore, saveWorkflow, setActiveWorkflow, downloadJson, exportPayload, analyzeImport, importPayload, sendToTarget, getTargetTab, collectVariables, collectVariableRefs, validateWorkflow, getTemplates, saveTemplates, getVersions, pushVersion, countBlocks, walkBlocks, short, initI18n, setLanguage, t, applyI18nToDom, get i18n(){ return I18N; }, languageLabel };
})();
