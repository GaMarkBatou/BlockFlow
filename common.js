const BF = (() => {
  const SCHEMA_VERSION = 11;

  const DEFAULT_WORKFLOW = () => ({
    id: crypto.randomUUID(),
    name: 'Új automatizmus',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: true,
    blocks: []
  });

  const BLOCKS = {
    trigger: { name: 'Indítás', desc: 'A workflow manuálisan indul.' },
    triggerGroup: { name: 'Figyelő trigger', desc: 'Indító-konténer: feltételek alapján automatikusan indítja a workflow-t.' },
    conditionText: { name: 'Feltétel: szöveg', desc: 'Igaz, ha a megadott szöveg vagy karakter megjelenik az oldalon.' },
    conditionElement: { name: 'Feltétel: elem', desc: 'Igaz, ha a kiválasztott elem megtalálható az oldalon.' },
    conditionField: { name: 'Feltétel: mezőérték', desc: 'Igaz, ha egy mező értéke megfelel a megadott feltételnek.' },
    conditionUrl: { name: 'Feltétel: URL', desc: 'Igaz, ha az aktuális URL megfelel a megadott feltételnek.' },
    conditionChange: { name: 'Feltétel: érték változik', desc: 'Igaz, ha egy mező/szöveg az előző figyelési körhöz képest a megadott irányba változik.' },
    click: { name: 'Kattintás', desc: 'Kattint egy kiválasztott oldalelemre.' },
    fill: { name: 'Beillesztés / kitöltés', desc: 'Szöveget ír egy mezőbe.' },
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

    transform: { name: 'Adat átalakítása', desc: 'Szöveg tisztítása, kis/nagybetű, számok/betűk megtartása.' },
    textSlice: { name: 'Szövegrész kinyerése', desc: 'Szöveget vág ki kezdő/záró minta, sor vagy karakter alapján.' },
    regex: { name: 'Regex keresés', desc: 'Reguláris kifejezés alapján találatot ment változóba.' },
    setVar: { name: 'Változó beállítása', desc: 'Fix vagy interpolált értéket ment változóba.' },
    userInput: { name: 'Adat bekérése', desc: 'Extension ablakban adatot kér a felhasználótól.' },
    userChoice: { name: 'Választás kérése', desc: 'Opciók közül választást kér, majd változóba menti.' },
    tableExtract: { name: 'Táblázatból kinyerés', desc: 'Sor/oszlop alapján adatot nyer ki táblázatból vagy listából.' },
    elementLoop: { name: 'Minden találatra...', desc: 'Több megtalált elemre futtatja a behúzott blokkokat.' },
    waitUntil: { name: 'Várj amíg...', desc: 'Feltétel teljesüléséig vár, timeouttal.' },
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
    sound: { name: 'Hangjelzés', desc: 'Rövid hangjelzést ad.' },
    scheduledTrigger: { name: 'Időzített indítás', desc: 'Automatikus indítás időközönként vagy megadott időpontban.' },
    systemNotify: { name: 'Rendszerértesítés', desc: 'Chrome rendszerértesítést küld szerkeszthető szöveggel.' }
  };

  const PALETTE = [
    { cat: 'Indítás', type: 'trigger' },
    { cat: 'Indítás', type: 'triggerGroup' },
    { cat: 'Indítás', type: 'scheduledTrigger' },
    { cat: 'Figyelő feltételek', type: 'conditionText' },
    { cat: 'Figyelő feltételek', type: 'conditionElement' },
    { cat: 'Figyelő feltételek', type: 'conditionField' },
    { cat: 'Figyelő feltételek', type: 'conditionUrl' },
    { cat: 'Figyelő feltételek', type: 'conditionChange' },
    { cat: 'Műveletek', type: 'click' },
    { cat: 'Műveletek', type: 'fill' },
    { cat: 'Műveletek', type: 'wait' },
    { cat: 'Műveletek', type: 'copy' },
    { cat: 'Műveletek', type: 'scroll' },
    { cat: 'Műveletek', type: 'keyPress' },
    { cat: 'Műveletek', type: 'openUrl' },
    { cat: 'Műveletek', type: 'userPrompt' },
    { cat: 'Műveletek', type: 'userInput' },
    { cat: 'Műveletek', type: 'userChoice' },
    { cat: 'Műveletek', type: 'systemNotify' },
    { cat: 'Műveletek', type: 'sound' },
    { cat: 'Adatkinyerés', type: 'extract' },
    { cat: 'Adatkinyerés', type: 'tableExtract' },
    { cat: 'Adatkinyerés', type: 'findElements' },
    { cat: 'Adatkinyerés', type: 'pageInfo' },
    { cat: 'Adatkinyerés', type: 'screenshot' },
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
    { cat: 'Logika', type: 'retryBlock' },
    { cat: 'Logika', type: 'tryBlock' },
    { cat: 'Logika', type: 'preflight' },
    { cat: 'Logika', type: 'stopRun' },
    { cat: 'Logika', type: 'comment' },
    { cat: 'Logika', type: 'groupBlock' },
    { cat: 'Logika', type: 'callWorkflow' },
    { cat: 'Logika', type: 'returnResult' },
    { cat: 'Popup', type: 'popupWait' },
    { cat: 'Popup', type: 'popupExtract' },
    { cat: 'Popup', type: 'popupClick' },
    { cat: 'Popup', type: 'popupWindowWait' },
    { cat: 'Popup', type: 'popupWindowExtract' },
    { cat: 'Popup', type: 'popupWindowClose' },
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
    if (type === 'click') return { id, type, target: null, timeoutMs: 5000, confirmRisky: true };
    if (type === 'fill') return { id, type, target: null, value: '', timeoutMs: 5000 };
    if (type === 'extract') return { id, type, target: null, extractMode: 'auto', searchScope: 'dom', allowHidden: true, varName: 'adat', timeoutMs: 5000 };
    if (type === 'wait') return { id, type, waitMode: 'time', ms: 1000, text: '', target: null, timeoutMs: 5000 };
    if (type === 'triggerGroup') return { id, type, triggerEnabled: true, logic: 'all', scope: 'domain', domain: '', path: '/', url: '', urlContains: '', intervalSec: 2, throttleSec: 15, runOnce: false, children: [] };
    if (type === 'conditionText') return { id, type, text: '', caseSensitive: false };
    if (type === 'conditionElement') return { id, type, target: null, requireVisible: true };
    if (type === 'conditionField') return { id, type, target: null, operator: 'contains', value: '', caseSensitive: false };
    if (type === 'conditionUrl') return { id, type, operator: 'contains', value: '' };
    if (type === 'conditionChange') return { id, type, target: null, readMode: 'auto', attributeName: 'title', searchScope: 'dom', changeMode: 'fromTo', fromValue: '', toValue: '', operator: 'equals', caseSensitive: false, firstRun: 'learn' };
    if (type === 'ifBlock') return { id, type, conditionMode: 'textExists', text: '', target: null, timeoutMs: 1000, value: '', children: [], elseChildren: [] };
    if (type === 'repeatBlock') return { id, type, repeatCount: 2, children: [] };
    if (type === 'popupWait') return { id, type, timeoutMs: 10000 };
    if (type === 'popupExtract') return { id, type, extractMode: 'text', varName: 'popup_szoveg' };
    if (type === 'popupClick') return { id, type, buttonText: 'OK', timeoutMs: 5000 };
    if (type === 'copy') return { id, type, value: '' };
    if (type === 'email') return { id, type, to: '{{email}}', subject: '', body: '', resultName: 'email_draft' };
    if (type === 'openEmail') return { id, type, draftName: 'email_draft', maxUrlLength: 1800 };
    if (type === 'rowLoop') return { id, type, target: null, rowVar: 'sor_szoveg', maxRows: 20, children: [] };
    if (type === 'mask') return { id, type, source: '{{adat}}', resultName: 'maszkolt_adat', maskMode: 'characters', invertMask: false, maskChar: '*', keepStart: 2, keepEnd: 2, keepFirstLines: 1, keepLastLines: 1, maskLineText: '***' };
    if (type === 'transform') return { id, type, source: '{{adat}}', operation: 'trim', resultName: 'atalakitott_adat' };
    if (type === 'textSlice') return { id, type, source: '{{adat}}', mode: 'between', startText: '', endText: '', lineNumber: 1, charStart: 0, charEnd: 100, resultName: 'szovegresz' };
    if (type === 'regex') return { id, type, source: '{{adat}}', pattern: '', flags: 'i', group: 0, allMatches: false, resultName: 'regex_talalat' };
    if (type === 'setVar') return { id, type, varName: 'valtozo', value: '' };
    if (type === 'userInput') return { id, type, title: 'Adat bekérése', message: 'Adj meg egy értéket:', inputType: 'text', placeholder: '', defaultValue: '', resultName: 'user_input' };
    if (type === 'userChoice') return { id, type, title: 'Választás', message: 'Válassz egy opciót:', options: 'Igen\nNem', resultName: 'valasztas' };
    if (type === 'tableExtract') return { id, type, target: null, rowMode: 'first', rowContains: '', columnIndex: 1, resultName: 'tabla_adat', timeoutMs: 5000 };
    if (type === 'elementLoop') return { id, type, target: null, selector: '', itemVar: 'elem_szoveg', indexVar: 'elem_index', maxItems: 20, children: [] };
    if (type === 'waitUntil') return { id, type, conditionMode: 'textExists', text: '', target: null, operator: 'contains', value: '', timeoutMs: 10000 };
    if (type === 'scroll') return { id, type, mode: 'element', target: null, direction: 'down', amount: 500 };
    if (type === 'keyPress') return { id, type, target: null, key: 'Enter', ctrl: false, alt: false, shift: false, meta: false };
    if (type === 'clipboardRead') return { id, type, resultName: 'clipboard' };
    if (type === 'openUrl') return { id, type, url: '', mode: 'newTab' };
    if (type === 'pageInfo') return { id, type, prefix: 'page' };
    if (type === 'screenshot') return { id, type, resultName: 'screenshot_data_url', action: 'preview', fileName: 'blockflow-screenshot' };
    if (type === 'tryBlock') return { id, type, children: [], elseChildren: [] };
    if (type === 'preflight') return { id, type, target: null, requireVisible: false, onFail: 'stop' };
    if (type === 'localSet') return { id, type, key: '', value: '' };
    if (type === 'localGet') return { id, type, key: '', resultName: 'local_adat', defaultValue: '' };
    if (type === 'compare') return { id, type, left: '{{adat}}', operator: 'equals', right: '', resultName: 'osszehasonlitas' };
    if (type === 'math') return { id, type, left: '0', operator: 'add', right: '1', resultName: 'szamitas' };
    if (type === 'retryBlock') return { id, type, attempts: 3, delayMs: 1000, children: [] };
    if (type === 'popupWindowWait') return { id, type, matchMode: 'urlContains', value: '', timeoutMs: 15000, resultName: 'popup_tab_id' };
    if (type === 'popupWindowExtract') return { id, type, tabVar: 'popup_tab_id', target: null, extractMode: 'auto', varName: 'popup_adat', timeoutMs: 5000 };
    if (type === 'popupWindowClose') return { id, type, tabVar: 'popup_tab_id' };
    if (type === 'iframeBlock') return { id, type, target: null, children: [] };
    if (type === 'findElements') return { id, type, target: null, selector: '', resultName: 'talalatok', countName: 'talalat_db', maxItems: 50 };
    if (type === 'emailTemplate') return { id, type, templateId: '', to: '{{email}}', resultName: 'email_draft' };
    if (type === 'emailPreview') return { id, type, draftName: 'email_draft', resultName: 'email_preview_action' };
    if (type === 'validateData') return { id, type, source: '{{adat}}', validation: 'notEmpty', pattern: '', onFail: 'stop' };
    if (type === 'comment') return { id, type, note: 'Megjegyzés...' };
    if (type === 'groupBlock') return { id, type, title: 'Csoport', children: [] };
    if (type === 'callWorkflow') return { id, type, workflowId: '', resultPrefix: 'called' };
    if (type === 'returnResult') return { id, type, value: '{{adat}}', resultName: 'result' };
    if (type === 'stopRun') return { id, type, message: 'Futás leállítva.' };
    if (type === 'sound') return { id, type, tone: 'success' };
    if (type === 'scheduledTrigger') return { id, type, triggerEnabled: true, scheduleMode: 'interval', intervalMinutes: 15, timeOfDay: '08:00', days: 'mon,tue,wed,thu,fri' };
    if (type === 'userPrompt') return { id, type, title: 'BlockFlow', message: 'Ellenőrizd az eredményt, majd folytasd.', mode: 'wait', buttonText: 'Folytatás', cancelText: 'Megszakítás', resultName: '' };
    if (type === 'systemNotify') return { id, type, title: 'BlockFlow', message: 'Az automatizmus elért egy értesítési ponthoz.' };
    return { id, type };
  }

  function blockTitle(block) {
    const meta = BLOCKS[block.type] || { name: block.type };
    if (block.type === 'click') return `Kattints: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'fill') return `Illeszd be ide: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'extract') return `Nyerd ki: ${block.target?.label || 'nincs kiválasztva'} → {{${block.varName || 'adat'}}}`;
    if (block.type === 'wait') return block.waitMode === 'time' ? `Várj ${block.ms || 1000} ms` : `Várakozás: ${block.waitMode}`;
    if (block.type === 'triggerGroup') return `Figyelő trigger: ${triggerLogicLabel(block.logic || 'all')}`;
    if (block.type === 'conditionText') return `Feltétel: szöveg megjelenik: ${short(block.text || 'szöveg/karakter')}`;
    if (block.type === 'conditionElement') return `Feltétel: elem megjelenik: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'conditionField') return `Feltétel: mezőérték ${operatorLabel(block.operator || 'contains')} ${short(block.value || '')}`;
    if (block.type === 'conditionUrl') return `Feltétel: URL ${operatorLabel(block.operator || 'contains')} ${short(block.value || '')}`;
    if (block.type === 'conditionChange') return `Feltétel: érték változik ${changeModeLabel(block.changeMode || 'fromTo', block.fromValue || '', block.toValue || '')}`;
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
    if (block.type === 'setVar') return `Változó: {{${block.varName || 'valtozo'}}}`;
    if (block.type === 'userInput') return `Adat bekérése → {{${block.resultName || 'user_input'}}}`;
    if (block.type === 'userChoice') return `Választás → {{${block.resultName || 'valasztas'}}}`;
    if (block.type === 'tableExtract') return `Táblázatból kinyerés → {{${block.resultName || 'tabla_adat'}}}`;
    if (block.type === 'elementLoop') return `Minden találatra: {{${block.itemVar || 'elem_szoveg'}}}`;
    if (block.type === 'waitUntil') return `Várj amíg: ${conditionLabel(block)}`;
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
    if (block.type === 'groupBlock') return `Csoport: ${short(block.title || '')}`;
    if (block.type === 'callWorkflow') return `Másik automatizmus futtatása`;
    if (block.type === 'returnResult') return `Eredmény visszaadása → {{${block.resultName || 'result'}}}`;
    if (block.type === 'stopRun') return `Leállítás`;
    if (block.type === 'sound') return `Hangjelzés: ${block.tone || 'success'}`;
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

  function operatorLabel(op) {
    return ({ contains:'tartalmazza', notContains:'nem tartalmazza', equals:'pontosan ez', notEquals:'nem pontosan ez', empty:'üres', notEmpty:'nem üres', startsWith:'ezzel kezdődik', endsWith:'ezzel végződik' })[op || 'contains'] || op;
  }

  function blockDesc(block) {
    if (block.type === 'fill') return `Mit: ${short(block.value || '')}`;
    if (block.type === 'extract') return `Mód: ${block.extractMode || 'auto'} · ${block.searchScope === 'visible' ? 'látható' : 'teljes DOM'}`;
    if (block.type === 'wait') return block.waitMode === 'text' ? `Szöveg: ${block.text || ''}` : (block.target?.label || '');
    if (block.type === 'userPrompt') return `${block.mode === 'wait' ? 'megáll és visszajelzésre vár' : 'csak értesít'} · ${short(block.message || '')}`;
    if (block.type === 'systemNotify') return short(block.message || '');
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
    if (block.type === 'conditionElement') return block.target?.label || 'Nincs cél elem';
    if (block.type === 'conditionField') return `${block.target?.label || 'nincs mező'} · ${operatorLabel(block.operator || 'contains')} · ${short(block.value || '')}`;
    if (block.type === 'conditionUrl') return `${operatorLabel(block.operator || 'contains')} · ${short(block.value || '')}`;
    if (block.type === 'conditionChange') return `${block.target?.label || 'nincs mező'} · ${changeModeLabel(block.changeMode || 'fromTo', block.fromValue || '', block.toValue || '')} · ${operatorLabel(block.operator || 'equals')}`;
    if (block.type === 'ifBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk csak igaz feltételnél fut.`;
    if (block.type === 'repeatBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk ismétlődik.`;
    if (block.type === 'rowLoop') return `Max sor: ${block.maxRows || 20} · gyermek blokkok: ${(block.children||[]).length}`;
    if (block.type === 'email') return `Címzett: ${block.to || ''} | Tárgy: ${short(block.subject || '')}`;
    if (block.type === 'copy') return short(block.value || '');
    if (block.type === 'mask') return `${block.maskMode === 'lines' ? 'Soralapú' : 'Karakteralapú'}${block.invertMask ? ' · invert' : ''} · Forrás: ${short(block.source || '')}`;
    if (['transform','textSlice','regex','setVar','compare','math','validateData'].includes(block.type)) return `Forrás: ${short(block.source || block.left || block.value || '')}`;
    if (['comment','groupBlock'].includes(block.type)) return short(block.note || block.title || '');
    if (block.type === 'scheduledTrigger') return block.triggerEnabled === false ? 'inaktív' : 'mentés után automatikus időzítőként aktív';
    return (BLOCKS[block.type] || {}).desc || '';
  }

  function short(s, n=90){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }

  async function getStore() {
    const data = await chrome.storage.local.get(['workflows', 'activeWorkflowId', 'templates']);
    let workflows = data.workflows || [];
    if (!workflows.length) {
      const w = DEFAULT_WORKFLOW();
      workflows = [w];
      await chrome.storage.local.set({ workflows, activeWorkflowId: w.id, templates: defaultTemplates() });
      return { workflows, activeWorkflowId: w.id, templates: defaultTemplates() };
    }
    if (!Array.isArray(data.templates)) await chrome.storage.local.set({ templates: defaultTemplates() });
    return { workflows, activeWorkflowId: data.activeWorkflowId || workflows[0].id, templates: Array.isArray(data.templates) ? data.templates : defaultTemplates() };
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
    const vars = new Set(['current_url', 'today', 'selected_text', 'popup_szoveg']);
    walkBlocks(workflow.blocks || [], b => {
      if (['extract','popupExtract'].includes(b.type) && b.varName) vars.add(b.varName);
      if (b.type === 'mask' && b.resultName) vars.add(b.resultName);
      if (b.type === 'email' && b.resultName) vars.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) vars.add(b.rowVar);
      if (b.type === 'elementLoop') { if (b.itemVar) vars.add(b.itemVar); if (b.indexVar) vars.add(b.indexVar); }
      ['transform','textSlice','regex','setVar','userInput','userChoice','tableExtract','clipboardRead','screenshot','localGet','compare','math','returnResult','findElements','emailTemplate','emailPreview'].forEach(t => { if (b.type === t && (b.resultName || b.varName || b.countName)) { if (b.resultName) vars.add(b.resultName); if (b.varName) vars.add(b.varName); if (b.countName) vars.add(b.countName); } });
      if (b.type === 'pageInfo') { const p = b.prefix || 'page'; vars.add(`${p}_url`); vars.add(`${p}_title`); vars.add(`${p}_domain`); vars.add(`${p}_path`); }
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

  function validateWorkflow(workflow) {
    const issues = [];
    const defined = new Set(['current_url','today','selected_text','row_index','sor_szoveg']);
    walkBlocks(workflow.blocks || [], b => {
      if (b.type === 'extract' && b.varName) defined.add(b.varName);
      if (b.type === 'popupExtract' && b.varName) defined.add(b.varName);
      if (b.type === 'email' && b.resultName) defined.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) defined.add(b.rowVar);
      if (b.type === 'mask' && b.resultName) defined.add(b.resultName);
      if (b.type === 'elementLoop') { if (b.itemVar) defined.add(b.itemVar); if (b.indexVar) defined.add(b.indexVar); }
      ['transform','textSlice','regex','setVar','userInput','userChoice','tableExtract','clipboardRead','screenshot','localGet','compare','math','returnResult','findElements','emailTemplate','emailPreview'].forEach(t => { if (b.type === t && (b.resultName || b.varName || b.countName)) { if (b.resultName) defined.add(b.resultName); if (b.varName) defined.add(b.varName); if (b.countName) defined.add(b.countName); } });
      if (b.type === 'pageInfo') { const p = b.prefix || 'page'; defined.add(`${p}_url`); defined.add(`${p}_title`); defined.add(`${p}_domain`); defined.add(`${p}_path`); }
    });
    let starterCount = 0;
    walkBlocks(workflow.blocks || [], b => {
      if (b.type === 'trigger') starterCount++;
      if (b.type === 'triggerGroup' && b.triggerEnabled !== false) starterCount++;
      if (b.type === 'scheduledTrigger' && b.triggerEnabled !== false) starterCount++;
    });
    if (!starterCount) issues.push({ level:'error', blockId:null, text:'Hiányzik az aktív indító blokk. Legalább egy szükséges: Indítás vagy aktív Figyelő trigger.' });

    const needsTarget = ['click','fill','extract','rowLoop'];
    walkBlocks(workflow.blocks || [], b => {
      if (needsTarget.includes(b.type) && !b.target) issues.push({ level:'error', blockId:b.id, text:`${BLOCKS[b.type]?.name || b.type}: hiányzik a cél elem.` });
      if (b.type === 'triggerGroup' && b.triggerEnabled !== false && !(b.children || []).length) issues.push({ level:'error', blockId:b.id, text:'Figyelő trigger: legalább egy feltétel szükséges.' });
      if ((b.type === 'conditionElement' || b.type === 'conditionField' || b.type === 'conditionChange') && !b.target) issues.push({ level:'error', blockId:b.id, text:`${BLOCKS[b.type]?.name || b.type}: hiányzik a cél elem.` });
      if (b.type === 'wait' && b.waitMode === 'element' && !b.target) issues.push({ level:'error', blockId:b.id, text:'Várakozás elemre: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && ['elementExists','valueContains'].includes(b.conditionMode) && !b.target) issues.push({ level:'error', blockId:b.id, text:'Ha blokk: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && b.conditionMode === 'textExists' && !String(b.text||'').trim()) issues.push({ level:'warning', blockId:b.id, text:'Ha blokk: üres keresett szöveg.' });
      if (b.type === 'conditionText' && !String(b.text||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Szöveg feltétel: üres figyelt szöveg.' });
      if (b.type === 'conditionUrl' && !['empty','notEmpty'].includes(b.operator || 'contains') && !String(b.value||'').trim()) issues.push({ level:'error', blockId:b.id, text:'URL feltétel: hiányzik az ellenőrzött érték.' });
      if (b.type === 'conditionChange') {
        const mode = b.changeMode || 'fromTo';
        if ((mode === 'fromTo' || mode === 'anyTo') && !String(b.toValue||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Érték változik feltétel: hiányzik a célérték.' });
        if ((mode === 'fromTo' || mode === 'fromAny') && !String(b.fromValue||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Érték változik feltétel: hiányzik a kiinduló érték.' });
      }
      if (b.type === 'email' && !String(b.to||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Email blokk: hiányzik a címzett.' });
      if (b.type === 'mask' && !String(b.source||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Maszkolás blokk: hiányzik a forrás szöveg vagy változó.' });
      if (b.type === 'mask' && !String(b.resultName||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Maszkolás blokk: hiányzik az eredmény változó neve.' });
      if (b.type === 'openEmail' && !String(b.draftName||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Email megnyitása: hiányzik a draft változó neve.' });
      if (b.type === 'click' && /delete|remove|send|submit|pay|confirm|order|törl|küld|fizet|rendel|végleges/i.test(`${b.target?.label || ''} ${b.target?.text || ''}`)) issues.push({ level:'warning', blockId:b.id, text:`Kockázatos kattintás lehet: ${b.target?.label || 'cél elem'}.` });
    });
    for (const ref of collectVariableRefs(workflow)) {
      if (!defined.has(ref)) issues.push({ level:'warning', blockId:null, text:`A {{${ref}}} változó nincs korábban létrehozva.` });
    }
    return { ok: !issues.some(i => i.level === 'error'), issues };
  }

  function countBlocks(blocks) {
    let n = 0;
    walkBlocks(blocks || [], () => n++);
    return n;
  }

  return { SCHEMA_VERSION, DEFAULT_WORKFLOW, BLOCKS, PALETTE, newBlock, blockTitle, blockDesc, triggerLogicLabel, operatorLabel, changeModeLabel, getStore, saveWorkflow, setActiveWorkflow, downloadJson, exportPayload, analyzeImport, importPayload, sendToTarget, getTargetTab, collectVariables, collectVariableRefs, validateWorkflow, getTemplates, saveTemplates, getVersions, pushVersion, countBlocks, walkBlocks, short };
})();
