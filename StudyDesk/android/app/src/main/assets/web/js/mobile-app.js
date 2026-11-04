/**
 * StudyDesk Mobile Reader — Engine & Navigation
 * Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com).
 * License: GPL-3.0
 */

// --- Database (IndexedDB) ---
const DB_NAME = 'StudyDeskMobile';
const DB_VERSION = 1;
let db = null;

function openDb() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('modules')) d.createObjectStore('modules', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress', { keyPath: 'key' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'k' });
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = (e) => reject(e);
  });
}

const tx = async (store, mode = 'readonly') => (await openDb()).transaction(store, mode).objectStore(store);

const dbGet = async (store, key) => new Promise(async (res) => {
  const req = (await tx(store)).get(key);
  req.onsuccess = () => res(req.result || null);
  req.onerror = () => res(null);
});

const dbPut = async (store, val) => new Promise(async (res, rej) => {
  const t = (await openDb()).transaction(store, 'readwrite');
  t.objectStore(store).put(val);
  t.oncomplete = () => res();
  t.onerror = (e) => rej(e);
});

const dbAll = async (store) => new Promise(async (res) => {
  const req = (await tx(store)).getAll();
  req.onsuccess = () => res(req.result || []);
  req.onerror = () => res([]);
});

// App State
let currentBook = null;
let currentModule = null;
let currentPart = 'main'; // 'main' | 'exercises' | 'video'
let currentActIndex = 0;
let discoveredPeers = new Map();
let currentAudio = null;
let audioWordTimes = [];
let audioWords = [];
let assetObjectUrls = new Map();

// --- DOM References ---
const $ = (id) => document.getElementById(id);
const topBar = $('topBar');
const btnBack = $('btnBack');
const brandIcon = $('brandIcon');
const appTitle = $('appTitle');
const appSubtitle = $('appSubtitle');
const btnSync = $('btnSync');
const btnIndex = $('btnIndex');
const partTabsBar = $('partTabsBar');
const contentArea = $('contentArea');
const bottomBar = $('bottomBar');
const btnPrev = $('btnPrev');
const btnNext = $('btnNext');
const stepIndicator = $('stepIndicator');
const filePicker = $('filePicker');

// Modals & Sheets
const lyricsModal = $('lyricsModal');
const lyricsBody = $('lyricsBody');
const btnCloseLyrics = $('btnCloseLyrics');

const indexSheet = $('indexSheet');
const indexSheetList = $('indexSheetList');

const syncSheet = $('syncSheet');
const btnCloseSync = $('btnCloseSync');
const peerList = $('peerList');
const syncCodeInput = $('syncCodeInput');
const manualIpInput = $('manualIpInput');
const btnManualConnect = $('btnManualConnect');
const syncLog = $('syncLog');
const computerBooksSection = $('computerBooksSection');
const computerBooksList = $('computerBooksList');
const btnRefreshComputerBooks = $('btnRefreshComputerBooks');
const bookDownloadModal = $('bookDownloadModal');
const bookDownloadTitle = $('bookDownloadTitle');
const bookDownloadStatus = $('bookDownloadStatus');
const bookDownloadBar = $('bookDownloadBar');
const bookDownloadPct = $('bookDownloadPct');

let activeComputerHost = null;
let activeComputerPort = 0;
let lastDiscoveredBooks = [];

const bookContextSheet = $('bookContextSheet');
const btnCloseContext = $('btnCloseContext');
const ctxOpenBook = $('ctxOpenBook');
const ctxShareBook = $('ctxShareBook');
const ctxDeleteBook = $('ctxDeleteBook');
const ctxShareProgress = $('ctxShareProgress');

const pdfProgressModal = $('pdfProgressModal');
const pdfProgressBar = $('pdfProgressBar');
const pdfProgressPct = $('pdfProgressPct');

let selectedBookForContext = null;
let spotifyLyricsAnimId = null;

// Updater & Info Modals
const btnAbout = $('btnAbout');
const aboutSheet = $('aboutSheet');
const btnCloseAbout = $('btnCloseAbout');
const updateBannerContainer = $('updateBannerContainer');
const btnBannerUpdate = $('btnBannerUpdate');
const btnCheckUpdateManual = $('btnCheckUpdateManual');
const checkBetaToggle = $('checkBetaToggle');
const updateModal = $('updateModal');
const btnCancelUpdate = $('btnCancelUpdate');
const btnConfirmDownload = $('btnConfirmDownload');
let availableUpdate = null;
let isCheckingUpdate = false;

// Toast Notification
function toast(msg) {
  if (window.androidBridge && typeof window.androidBridge.showToast === 'function') {
    window.androidBridge.showToast(msg);
  }
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function vibrate(ms = 35) {
  if (window.androidBridge && typeof window.androidBridge.vibrate === 'function') {
    window.androidBridge.vibrate(ms);
  } else if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

// Asset URL Resolver
function getAssetUrl(path) {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http')) return path;
  if (!currentModule) return path;
  const key = `${currentModule.id}/${path}`;
  if (assetObjectUrls.has(key)) return assetObjectUrls.get(key);
  return path;
}

async function loadModuleAssets(moduleId) {
  // Clear old URLs
  for (const url of assetObjectUrls.values()) {
    try { URL.revokeObjectURL(url); } catch (e) {}
  }
  assetObjectUrls.clear();

  const all = await dbAll('assets');
  for (const a of all) {
    if (a.key.startsWith(moduleId + '/')) {
      const url = URL.createObjectURL(a.blob);
      assetObjectUrls.set(a.key, url);
    }
  }
}

// =====================================================================================
// StudyDesk Android Updater — GitHub Releases & Manifest Engine (Mirror of PC Updater)
// Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0)
// =====================================================================================
const APP_NAME = 'StudyDesk';
const APP_VERSION = '26.11.1-014';
const APP_CHANNEL = 'stable';
const REPO_OWNER = 'Natsvkashii';
const REPO_NAME = 'ClassManager';
const RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases`;
const MANIFEST_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/stable/update-manifest.json`;

class AppVersion {
  constructor(string, channel) {
    const clean = String(string || '').replace(/^[vV\s]+|\s+$/g, '');
    this.raw = clean;
    const lower = clean.toLowerCase();
    const ch = (channel || '').toLowerCase();
    let unstable = false;
    if (ch === 'unstable' || ch === 'beta') unstable = true;
    else if (lower.includes('unstable') || lower.includes('beta')) unstable = true;
    else if (lower.includes('stable')) unstable = false;
    else if (/[0-9]+b\b|[0-9]+b$/.test(lower)) unstable = true;
    this.isUnstable = unstable;
    const core = clean
      .replace(/\((?:unstable|stable|beta)\)/gi, '')
      .replace(/\.(?:unstable|stable|beta)\./gi, '')
      .replace(/-(?:unstable|stable|beta)/gi, '')
      .trim();
    let base = core, rev = 0;
    const dash = core.indexOf('-');
    if (dash >= 0) {
      base = core.slice(0, dash);
      rev = parseInt(core.slice(dash + 1).replace(/\D/g, ''), 10) || 0;
    }
    const parts = base.split('.');
    const num = (s) => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;
    this.major = num(parts[0]);
    this.minor = num(parts[1]);
    this.patch = num(parts[2]);
    this.revision = rev;
  }
  static compare(a, b) {
    for (const k of ['major', 'minor', 'patch', 'revision']) {
      if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
    }
    if (a.isUnstable !== b.isUnstable) return a.isUnstable ? -1 : 1;
    return 0;
  }
  lt(o) { return AppVersion.compare(this, o) < 0; }
  gt(o) { return AppVersion.compare(this, o) > 0; }
  eq(o) { return AppVersion.compare(this, o) === 0; }
  toString() { return this.raw; }
}

function manifestToRelease(m) {
  const assets = [];
  if (m.apkUrl) assets.push({ name: m.apkName || 'StudyDesk.apk', browser_download_url: m.apkUrl, size: 0 });
  return {
    tag_name: m.tag_name || `v${m.version}`,
    name: m.name || '',
    body: m.body || '',
    prerelease: !!m.prerelease || m.channel === 'beta' || m.channel === 'unstable',
    published_at: m.published_at,
    html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
    assets,
  };
}

function androidAsset(release) {
  if (!release) return null;
  const assets = release.assets || [];
  const found = assets.find(a => /^StudyDesk-.*\.apk$/i.test(a.name))
    || assets.find(a => /\.apk$/i.test(a.name));
  if (found) return found;
  if (release.apkUrl) return { name: release.apkName || 'StudyDesk.apk', browser_download_url: release.apkUrl };
  return null;
}

function pickUpdate(releases, { includeBeta = false, current = new AppVersion(APP_VERSION, APP_CHANNEL) } = {}) {
  const effective = includeBeta || current.isUnstable;
  let best = null;
  for (const rel of releases || []) {
    if (!effective && rel.prerelease) continue;
    const v = new AppVersion(rel.tag_name, rel.prerelease ? 'unstable' : 'stable');
    if (!best || v.gt(best.version)) best = { release: rel, version: v };
  }
  return best && best.version.gt(current) ? best : null;
}

async function checkForUpdates({ silent = false } = {}) {
  if (isCheckingUpdate) return;
  isCheckingUpdate = true;

  const statusText = $('updateStatusText');
  const btnIcon = $('checkUpdateIcon');
  const btnText = $('checkUpdateBtnText');

  if (!silent) {
    if (statusText) statusText.textContent = 'Verifica disponibilità su GitHub in corso...';
    if (btnIcon) btnIcon.className = 'fa fa-spinner fa-spin';
    if (btnText) btnText.textContent = 'Verifica in corso...';
  }

  const includeBeta = checkBetaToggle ? checkBetaToggle.checked : false;
  let releases = null;

  try {
    const res = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    releases = await res.json();
  } catch (err) {
    try {
      const mRes = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!mRes.ok) throw new Error(`HTTP ${mRes.status}`);
      releases = [manifestToRelease(await mRes.json())];
    } catch (e2) {
      isCheckingUpdate = false;
      if (!silent) {
        if (statusText) statusText.textContent = 'Impossibile verificare: ' + e2.message;
        if (btnIcon) btnIcon.className = 'fa fa-rotate';
        if (btnText) btnText.textContent = 'Verifica aggiornamenti ora';
        toast('Errore verifica aggiornamenti');
      }
      return;
    }
  }

  isCheckingUpdate = false;
  if (!silent) {
    if (btnIcon) btnIcon.className = 'fa fa-rotate';
    if (btnText) btnText.textContent = 'Verifica aggiornamenti ora';
  }

  const applicableReleases = (releases || []).filter(r => !!androidAsset(r));
  const found = pickUpdate(applicableReleases, { includeBeta, current: new AppVersion(APP_VERSION, APP_CHANNEL) });

  if (found) {
    const rel = found.release;
    const asset = androidAsset(rel);
    availableUpdate = { release: rel, asset: asset };

    // Update banner on bookshelf
    if (updateBannerContainer) {
      $('updateBannerTitle').textContent = `Nuovo aggiornamento: ${rel.tag_name}`;
      $('updateBannerSub').textContent = rel.prerelease ? 'Disponibile versione Beta su GitHub' : 'Disponibile versione Stabile su GitHub';
      updateBannerContainer.style.display = 'block';
    }

    if (statusText) {
      statusText.textContent = `Nuova versione trovata: ${rel.tag_name} (${rel.prerelease ? 'Beta' : 'Stabile'})`;
    }

    if (!silent) {
      openUpdateModal();
    }
  } else {
    availableUpdate = null;
    if (updateBannerContainer) updateBannerContainer.style.display = 'none';
    if (statusText) {
      statusText.textContent = `StudyDesk è aggiornato all'ultima versione (${APP_VERSION}).`;
    }
    if (!silent) {
      toast(`StudyDesk è aggiornato (${APP_VERSION})`);
    }
  }
}

function openUpdateModal() {
  if (!availableUpdate) return;
  const rel = availableUpdate.release;
  const asset = availableUpdate.asset;

  $('updateModalTitle').textContent = `Aggiornamento ${rel.tag_name}`;
  $('updateModalSub').textContent = rel.prerelease ? 'Versione Beta disponibile per il download' : 'Versione Stabile pronta per l\'installazione';

  const clBox = $('updateChangelog');
  if (clBox) {
    if (rel.body && rel.body.trim().length > 0) {
      clBox.textContent = rel.body;
      clBox.style.display = 'block';
    } else {
      clBox.style.display = 'none';
    }
  }

  $('updateProgressBar').style.width = '0%';
  $('updateProgressPct').textContent = '0%';
  $('updateProgressBytes').textContent = 'Pronto al download';
  $('btnConfirmDownload').textContent = 'Scarica e installa';
  $('btnConfirmDownload').style.display = 'inline-flex';

  updateModal.classList.add('open');
}

function startUpdateDownload() {
  if (!availableUpdate || !availableUpdate.asset) {
    toast('Nessun pacchetto APK trovato per questo aggiornamento');
    return;
  }
  const rel = availableUpdate.release;
  const asset = availableUpdate.asset;

  $('updateModalSub').textContent = 'Download pacchetto APK da GitHub...';
  $('btnConfirmDownload').style.display = 'none';
  $('updateProgressBar').style.width = '0%';
  $('updateProgressPct').textContent = '0%';
  $('updateProgressBytes').textContent = 'Avvio connessione...';

  if (window.androidBridge && typeof window.androidBridge.downloadAndInstallUpdate === 'function') {
    window.androidBridge.downloadAndInstallUpdate(asset.browser_download_url, rel.tag_name);
  } else {
    // Browser fallback
    const a = document.createElement('a');
    a.href = asset.browser_download_url;
    a.download = asset.name || 'StudyDesk-Reader.apk';
    a.click();
    $('updateModalSub').textContent = 'Download avviato nel browser!';
    setTimeout(() => updateModal.classList.remove('open'), 1600);
  }
}

// Global Download Progress Hooks
window.onUpdateDownloadProgress = function(pct, bytesLoaded, bytesTotal, msg) {
  if ($('updateProgressBar')) $('updateProgressBar').style.width = pct + '%';
  if ($('updateProgressPct')) $('updateProgressPct').textContent = pct + '%';
  if ($('updateProgressBytes')) {
    if (bytesTotal > 0) {
      const mbLoaded = (bytesLoaded / (1024 * 1024)).toFixed(1);
      const mbTotal = (bytesTotal / (1024 * 1024)).toFixed(1);
      $('updateProgressBytes').textContent = `${mbLoaded} MB / ${mbTotal} MB`;
    } else {
      const mbLoaded = (bytesLoaded / (1024 * 1024)).toFixed(1);
      $('updateProgressBytes').textContent = `${mbLoaded} MB`;
    }
  }
  if ($('updateModalSub') && msg) $('updateModalSub').textContent = msg;
};

window.onUpdateDownloadComplete = function(success, errMsg) {
  if (success) {
    if ($('updateModalSub')) $('updateModalSub').textContent = 'Download completato! Apertura installatore...';
    if ($('updateProgressBar')) $('updateProgressBar').style.width = '100%';
    if ($('updateProgressPct')) $('updateProgressPct').textContent = '100%';
    setTimeout(() => {
      if (updateModal) updateModal.classList.remove('open');
    }, 1500);
  } else {
    if ($('updateModalSub')) $('updateModalSub').textContent = 'Errore: ' + (errMsg || 'Download fallito');
    $('btnConfirmDownload').textContent = 'Riprova';
    $('btnConfirmDownload').style.display = 'inline-flex';
  }
};

// Wire About & Update Buttons
if (btnAbout) {
  btnAbout.onclick = () => {
    vibrate(20);
    aboutSheet.classList.add('open');
  };
}

if (btnCloseAbout) {
  btnCloseAbout.onclick = () => aboutSheet.classList.remove('open');
}

if (aboutSheet) {
  aboutSheet.onclick = (e) => {
    if (e.target === aboutSheet) aboutSheet.classList.remove('open');
  };
}

if (btnCheckUpdateManual) {
  btnCheckUpdateManual.onclick = () => {
    vibrate(20);
    checkForUpdates({ silent: false });
  };
}

if (checkBetaToggle) {
  checkBetaToggle.onchange = () => {
    const badge = $('aboutChannelBadge');
    if (badge) {
      if (checkBetaToggle.checked) {
        badge.textContent = 'Beta';
        badge.className = 'channel-badge beta';
      } else {
        badge.textContent = 'Stabile';
        badge.className = 'channel-badge';
      }
    }
    checkForUpdates({ silent: true });
  };
}

if (btnBannerUpdate) {
  btnBannerUpdate.onclick = () => {
    vibrate(20);
    openUpdateModal();
  };
}

if (btnConfirmDownload) {
  btnConfirmDownload.onclick = () => {
    vibrate(20);
    startUpdateDownload();
  };
}

if (btnCancelUpdate) {
  btnCancelUpdate.onclick = () => {
    updateModal.classList.remove('open');
  };
}

// --- Bootstrap ---
async function bootstrap() {
  await openDb();

  // Check if a book was shared with the app on startup
  if (window.androidBridge && typeof window.androidBridge.getPendingSharedBook === 'function') {
    const raw = window.androidBridge.getPendingSharedBook();
    if (raw) {
      try {
        const payload = JSON.parse(raw);
        if (payload && payload.data) {
          await handleBase64Book(payload.data, payload.name);
          return;
        }
      } catch (e) {
        console.error('Error handling startup shared book:', e);
      }
    }
  }

  renderBookshelf();

  // Background check for updates from GitHub (same method as PC version)
  setTimeout(() => {
    checkForUpdates({ silent: true });
  }, 1500);
}

function showLoadingShelf(msg) {
  contentArea.innerHTML = `
    <div style="text-align: center; padding: 40px 16px;">
      <i class="fa fa-spinner fa-spin" style="font-size: 2.2rem; color: var(--primary); margin-bottom: 16px;"></i>
      <p style="font-size: 1.05rem; font-weight: 600;">${msg}</p>
    </div>`;
}

// --- Import .sdbook Archive ---
async function importSdbookFromBytes(bytes, fallbackTitle = 'Libro') {
  const zip = await JSZip.loadAsync(bytes);
  let bookJson = null;
  if (zip.file('book.json')) {
    bookJson = JSON.parse(await zip.file('book.json').async('string'));
  }

  const bookId = (bookJson && bookJson.id) || 'book-' + Date.now();
  const bookTitle = (bookJson && bookJson.title) || fallbackTitle;

  let coverBlob = null;
  if (bookJson && bookJson.cover && zip.file(bookJson.cover)) {
    coverBlob = await zip.file(bookJson.cover).async('blob');
  } else if (zip.file('cover.jpg')) {
    coverBlob = await zip.file('cover.jpg').async('blob');
  } else if (zip.file('cover.svg')) {
    coverBlob = await zip.file('cover.svg').async('blob');
  }

  // Save book record
  const bookRecord = {
    id: bookId,
    title: bookTitle,
    subtitle: (bookJson && bookJson.subtitle) || '',
    level: (bookJson && bookJson.level) || 'A1',
    coverBlob: coverBlob,
    chapters: (bookJson && bookJson.chapters) || [],
    importedAt: new Date().toISOString()
  };
  await dbPut('books', bookRecord);

  // Unpack chapters and assets
  const chapterEntries = Object.keys(zip.files).filter(k => k.startsWith('chapters/') && k.endsWith('/module.json'));
  for (const path of chapterEntries) {
    const parts = path.split('/');
    const modId = parts[1];
    const modJson = JSON.parse(await zip.file(path).async('string'));
    await dbPut('modules', { id: modId, bookId: bookId, ...modJson });

    // Extract chapter assets
    const prefix = `chapters/${modId}/`;
    const assetFiles = Object.keys(zip.files).filter(k => k.startsWith(prefix) && !k.endsWith('/module.json') && !zip.files[k].dir);
    for (const aPath of assetFiles) {
      const relPath = aPath.substring(prefix.length);
      const blob = await zip.file(aPath).async('blob');
      await dbPut('assets', { key: `${modId}/${relPath}`, blob });
    }
  }

  return bookRecord;
}

async function handleBase64Book(base64Data, filename) {
  try {
    showLoadingShelf(`Importazione in corso: ${filename}...`);
    const binary = atob(base64Data);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

    const rec = await importSdbookFromBytes(bytes.buffer, filename);
    toast(`Libro «${rec.title}» importato con successo!`);
    await openBook(rec.id);
  } catch (e) {
    console.error('Error importing base64 book:', e);
    toast('Errore importazione file: ' + e.message);
    renderBookshelf();
  }
}

// Callback called from Android when a book is shared or tapped
window.onSharedBookReceived = function(payload) {
  if (payload && payload.data) {
    handleBase64Book(payload.data, payload.name || 'Libro Condiviso');
  }
};

// --- Book Context Menu & Actions ---
async function openBookContextMenu(bookId) {
  vibrate(40);
  const b = await dbGet('books', bookId);
  if (!b) return;
  selectedBookForContext = b;

  const titleEl = $('ctxBookTitle');
  if (titleEl) titleEl.textContent = b.title;

  const subEl = $('ctxBookSubtitle');
  if (subEl) subEl.textContent = b.subtitle || (b.level ? `Livello ${b.level}` : '');

  const coverBox = $('ctxBookCoverBox');
  if (coverBox) {
    if (b.coverBlob) {
      coverBox.innerHTML = `<img src="${URL.createObjectURL(b.coverBlob)}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
      coverBox.innerHTML = `<i class="fa fa-book" style="color:var(--primary); font-size:1.3rem;"></i>`;
    }
  }

  bookContextSheet.classList.add('open');
}

function closeBookContextMenu() {
  if (bookContextSheet) bookContextSheet.classList.remove('open');
}

if (btnCloseContext) btnCloseContext.onclick = closeBookContextMenu;
if (bookContextSheet) {
  bookContextSheet.onclick = (e) => {
    if (e.target === bookContextSheet) closeBookContextMenu();
  };
}

// 1. Open Book from context
if (ctxOpenBook) {
  ctxOpenBook.onclick = () => {
    const bId = selectedBookForContext ? selectedBookForContext.id : null;
    closeBookContextMenu();
    if (bId) openBook(bId);
  };
}

// 2. Share .sdbook file
if (ctxShareBook) {
  ctxShareBook.onclick = async () => {
    if (!selectedBookForContext) return;
    const b = selectedBookForContext;
    closeBookContextMenu();
    toast('Preparazione archivio libro...');

    try {
      const zip = new JSZip();
      const meta = {
        id: b.id,
        title: b.title,
        subtitle: b.subtitle || '',
        level: b.level || 'A1',
        chapters: b.chapters || []
      };

      if (b.coverBlob) {
        meta.cover = 'cover.jpg';
        zip.file('cover.jpg', b.coverBlob);
      }
      zip.file('book.json', JSON.stringify(meta, null, 2));

      const allMods = await dbAll('modules');
      const bMods = allMods.filter(m => m.bookId === b.id || (b.chapters && b.chapters.some(c => c.moduleId === m.id)));
      const allAssets = await dbAll('assets');

      for (const m of bMods) {
        const modCopy = { ...m };
        delete modCopy.bookId;
        zip.file(`chapters/${m.id}/module.json`, JSON.stringify(modCopy, null, 2));

        const prefix = `${m.id}/`;
        for (const a of allAssets) {
          if (a.key.startsWith(prefix)) {
            const rel = a.key.substring(prefix.length);
            zip.file(`chapters/${m.id}/${rel}`, a.blob);
          }
        }
      }

      const safeName = (b.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'libro') + '.sdbook';
      const base64 = await zip.generateAsync({ type: 'base64' });

      if (window.androidBridge && typeof window.androidBridge.shareBookFile === 'function') {
        window.androidBridge.shareBookFile(safeName, base64);
      } else {
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = safeName;
        a.click();
        toast('File libro scaricato');
      }
    } catch (e) {
      console.error('Error sharing book:', e);
      toast('Errore nella condivisione del libro: ' + e.message);
    }
  };
}

// 3. Delete Book
if (ctxDeleteBook) {
  ctxDeleteBook.onclick = async () => {
    if (!selectedBookForContext) return;
    const b = selectedBookForContext;
    closeBookContextMenu();

    if (!confirm(`Sei sicuro di voler eliminare il libro «${b.title}» e tutti i progressi svolti?`)) return;

    try {
      // 1. Gather all related records and keys asynchronously BEFORE opening the write transaction
      const allMods = await dbAll('modules');
      const bMods = allMods.filter(m => m.bookId === b.id || (b.chapters && b.chapters.some(c => c.moduleId === m.id)));
      const modIds = new Set(bMods.map(m => m.id));

      const allAssets = await dbAll('assets');
      const assetKeysToDelete = [];
      for (const a of allAssets) {
        const pIdx = a.key.indexOf('/');
        if (pIdx > 0 && modIds.has(a.key.substring(0, pIdx))) {
          assetKeysToDelete.push(a.key);
        }
      }

      const allProg = await dbAll('progress');
      const progKeysToDelete = [];
      for (const pr of allProg) {
        const pIdx = pr.key.indexOf('/');
        if (pIdx > 0 && modIds.has(pr.key.substring(0, pIdx))) {
          progKeysToDelete.push(pr.key);
        }
      }

      // 2. Perform all deletions synchronously inside a single write transaction (never await inside!)
      const dbObj = await openDb();
      await new Promise((resolve, reject) => {
        const t = dbObj.transaction(['books', 'modules', 'assets', 'progress'], 'readwrite');
        t.objectStore('books').delete(b.id);
        for (const mid of modIds) {
          t.objectStore('modules').delete(mid);
        }
        for (const k of assetKeysToDelete) {
          t.objectStore('assets').delete(k);
        }
        for (const k of progKeysToDelete) {
          t.objectStore('progress').delete(k);
        }
        t.oncomplete = () => resolve();
        t.onerror = (e) => reject(e.target ? e.target.error : e);
        t.onabort = (e) => reject(e.target ? e.target.error : e);
      });

      toast(`Libro «${b.title}» eliminato con successo`);
      await renderBookshelf();
    } catch (e) {
      console.error('Delete error:', e);
      toast('Errore eliminazione: ' + (e.message || e));
      await renderBookshelf();
    }
  };
}

// 4. Share Progress PDF with Chapter Breakdown & Progress Modal
if (ctxShareProgress) {
  ctxShareProgress.onclick = async () => {
    if (!selectedBookForContext) return;
    const b = selectedBookForContext;
    closeBookContextMenu();

    // Reset and open progress modal
    if (pdfProgressBar) pdfProgressBar.style.width = '0%';
    if (pdfProgressPct) pdfProgressPct.textContent = '0%';
    if (pdfProgressModal) pdfProgressModal.classList.add('open');

    try {
      const allMods = await dbAll('modules');
      const bMods = allMods.filter(m => m.bookId === b.id || (b.chapters && b.chapters.some(c => c.moduleId === m.id)));
      const allProg = await dbAll('progress');

      // Order chapters
      const orderedMods = [];
      if (b.chapters && b.chapters.length > 0) {
        for (const ch of b.chapters) {
          const found = bMods.find(m => m.id === ch.moduleId);
          if (found) orderedMods.push({ mod: found, meta: ch });
        }
      }
      for (const m of bMods) {
        if (!orderedMods.some(om => om.mod.id === m.id)) {
          orderedMods.push({ mod: m, meta: null });
        }
      }

      const chaptersData = [];
      let chapIndex = 1;

      for (const item of orderedMods) {
        const m = item.mod;
        const meta = item.meta;
        const chapTitle = meta?.title || m.title || `Capitolo ${chapIndex}`;
        const chapNum = meta?.number || m.number || String(chapIndex);

        const activitiesData = [];
        let actCounter = 1;
        const sections = m.sections || [];

        for (const s of sections) {
          for (const a of s.activities || []) {
            let actScore = 0;
            let actMaxScore = 0;
            let hasAnswers = false;

            for (const p of a.parts || []) {
              if (p.type !== 'info') {
                const pRec = allProg.find(pr => pr.key === `${m.id}/${p.id}`);
                const maxPartScore = (p.statements ? p.statements.length : 1);
                if (pRec) {
                  if (pRec.status || pRec.score !== undefined) hasAnswers = true;
                  actScore += (pRec.score || 0);
                  actMaxScore += (pRec.maxScore || maxPartScore);
                } else {
                  actMaxScore += maxPartScore;
                }
              }
            }

            let actStatus = '';
            if (hasAnswers) {
              if (actScore >= actMaxScore && actMaxScore > 0) actStatus = 'correct';
              else if (actScore > 0) actStatus = 'partial';
              else actStatus = 'incorrect';
            }

            activitiesData.push({
              number: a.number || String(actCounter),
              title: a.title || `Attività ${actCounter}`,
              page: a.page || m.page || 0,
              status: actStatus,
              score: actScore,
              maxScore: actMaxScore
            });
            actCounter++;
          }
        }

        chaptersData.push({
          number: chapNum,
          title: chapTitle,
          activities: activitiesData
        });
        chapIndex++;
      }

      if (window.androidBridge && typeof window.androidBridge.shareProgressPdf === 'function') {
        window.androidBridge.shareProgressPdf(
          b.title,
          b.subtitle || '',
          b.level || '',
          JSON.stringify(chaptersData)
        );
      } else {
        // Fallback for desktop/browser
        let p = 0;
        const timer = setInterval(() => {
          p += 20;
          if (window.onPdfProgress) window.onPdfProgress(p);
          if (p >= 100) {
            clearInterval(timer);
            if (window.onPdfGenerated) window.onPdfGenerated(true);
            toast('Avanzamento del libro calcolato con successo');
          }
        }, 150);
      }
    } catch (e) {
      console.error('Error generating PDF report:', e);
      toast('Errore: ' + e.message);
      if (pdfProgressModal) pdfProgressModal.classList.remove('open');
    }
  };
}

// PDF Progress Callbacks
window.onPdfProgress = function(pct) {
  if (pdfProgressBar) pdfProgressBar.style.width = pct + '%';
  if (pdfProgressPct) pdfProgressPct.textContent = pct + '%';
};

window.onPdfGenerated = function(success) {
  setTimeout(() => {
    if (pdfProgressModal) pdfProgressModal.classList.remove('open');
  }, 600);
};

// --- Bookshelf View ---
async function renderBookshelf() {
  currentBook = null;
  currentModule = null;

  topBar.style.display = 'flex';
  btnBack.style.display = 'none';
  brandIcon.style.display = 'block';
  btnIndex.style.display = 'none';
  partTabsBar.style.display = 'none';
  bottomBar.style.display = 'none';

  appTitle.textContent = 'StudyDesk';
  appSubtitle.textContent = 'Libri ed Esercizi';

  const books = await dbAll('books');
  const modules = await dbAll('modules');
  const progressList = await dbAll('progress');

  let html = `
    <div class="shelf-header">
      <div class="shelf-title">I tuoi libri</div>
      <button class="btn-pill primary" id="btnImportBook">
        <i class="fa fa-folder-open"></i> Importa .sdbook
      </button>
    </div>
    <div class="book-grid">`;

  if (books.length === 0) {
    html += `
      <div style="text-align: center; padding: 48px 20px; background: var(--bg-card); border-radius: var(--radius); border: 1px dashed var(--border); grid-column: 1 / -1;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--bg-card-subtle); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <i class="fa fa-book-open" style="font-size: 1.8rem; color: var(--primary);"></i>
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 8px;">Nessun libro nella libreria</h3>
        <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 24px; max-width: 320px; margin-left: auto; margin-right: auto;">
          Importa un file <code>.sdbook</code> dalla memoria del telefono oppure sincronizzati tramite Wi-Fi con il computer.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
          <button class="btn-pill primary" id="btnEmptyImport" style="padding: 10px 18px; font-size: 0.9rem;">
            <i class="fa fa-folder-open"></i> Importa .sdbook
          </button>
          <button class="btn-pill" id="btnEmptySync" style="padding: 10px 18px; font-size: 0.9rem;">
            <i class="fa fa-laptop"></i> Sincronizza
          </button>
        </div>
      </div>`;
  } else {
    for (const b of books) {
      let coverSrc = 'icons/icon.svg';
      if (b.coverBlob) {
        coverSrc = URL.createObjectURL(b.coverBlob);
      }

      // Count chapters & progress
      const bMods = modules.filter(m => m.bookId === b.id || (b.chapters && b.chapters.some(c => c.moduleId === m.id)));
      const chapCount = bMods.length || (b.chapters ? b.chapters.length : 1);

      // Compute progress
      let totalParts = 0;
      let doneParts = 0;
      for (const m of bMods) {
        if (m.sections) {
          for (const s of m.sections) {
            for (const a of s.activities || []) {
              for (const p of a.parts || []) {
                if (p.type !== 'info') {
                  totalParts++;
                  const res = progressList.find(pr => pr.key === `${m.id}/${p.id}`);
                  if (res && res.status) doneParts++;
                }
              }
            }
          }
        }
      }
      const pct = totalParts > 0 ? Math.round((doneParts / totalParts) * 100) : 0;

      html += `
        <div class="book-card" data-book-id="${b.id}">
          <button class="card-menu-btn" title="Opzioni libro" data-book-id="${b.id}">
            <i class="fa fa-ellipsis-vertical"></i>
          </button>
          <img class="book-cover" src="${coverSrc}" alt="Copertina">
          <div class="book-info">
            <div>
              <span class="book-badge">${b.level || 'A1'}</span>
              <div class="book-title">${escapeHtml(b.title)}</div>
              <div class="book-subtitle">${escapeHtml(b.subtitle || (chapCount + (chapCount === 1 ? ' capitolo' : ' capitoli')))}</div>
            </div>
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
                <span>${chapCount} ${chapCount === 1 ? 'capitolo' : 'capitoli'}</span>
                <span>${pct}%</span>
              </div>
              <div class="book-progress-bar">
                <div class="book-progress-bar-fill" style="width: ${pct}%"></div>
              </div>
            </div>
          </div>
        </div>`;
    }
  }

  html += `</div>`;
  contentArea.innerHTML = html;

  // Bind top import button
  const topImport = $('btnImportBook');
  if (topImport) topImport.onclick = () => filePicker.click();

  // Bind empty state buttons if present
  const emptyImport = $('btnEmptyImport');
  if (emptyImport) emptyImport.onclick = () => filePicker.click();
  const emptySync = $('btnEmptySync');
  if (emptySync) emptySync.onclick = () => btnSync.click();

  // Bind long-press and menu button on cards
  contentArea.querySelectorAll('.book-card').forEach(card => {
    const bookId = card.dataset.bookId;
    let timer = null;
    let startX = 0, startY = 0;
    let longPressed = false;

    card.addEventListener('touchstart', (e) => {
      longPressed = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      timer = setTimeout(() => {
        longPressed = true;
        openBookContextMenu(bookId);
      }, 500);
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
      if (!timer) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 10 || dy > 10) {
        clearTimeout(timer);
        timer = null;
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    card.addEventListener('touchcancel', () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    });

    card.addEventListener('click', (e) => {
      if (longPressed) {
        longPressed = false;
        return;
      }
      if (e.target.closest('.card-menu-btn')) return;
      openBook(bookId);
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openBookContextMenu(bookId);
    });
  });

  contentArea.querySelectorAll('.card-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openBookContextMenu(btn.dataset.bookId);
    });
  });
}

window.openBook = async function(bookId) {
  const b = await dbGet('books', bookId);
  if (!b) return;
  currentBook = b;

  // Find first module/chapter
  const allMods = await dbAll('modules');
  let firstMod = allMods.find(m => m.bookId === b.id);
  if (!firstMod && b.chapters && b.chapters.length > 0) {
    firstMod = await dbGet('modules', b.chapters[0].moduleId);
  }
  if (!firstMod) {
    toast('Nessun capitolo disponibile per questo libro.');
    return;
  }

  await openChapter(firstMod.id);
};

// --- Book Reader View ---
async function openChapter(moduleId) {
  const m = await dbGet('modules', moduleId);
  if (!m) return;
  currentModule = m;
  currentPart = 'main';
  currentActIndex = 0;

  await loadModuleAssets(moduleId);

  btnBack.style.display = 'flex';
  brandIcon.style.display = 'none';
  btnIndex.style.display = 'flex';
  partTabsBar.style.display = 'flex';
  bottomBar.style.display = 'flex';

  appTitle.textContent = currentBook ? currentBook.title : m.title;
  appSubtitle.textContent = m.title;

  setupPartTabs();
  renderCurrentActivity();
}

function setupPartTabs() {
  const tabs = partTabsBar.querySelectorAll('.part-tab');
  tabs.forEach(t => {
    const p = t.dataset.part;
    t.classList.toggle('active', p === currentPart);
    t.onclick = () => {
      currentPart = p;
      currentActIndex = 0;
      setupPartTabs();
      renderCurrentActivity();
    };
  });
}

function getActivitiesForCurrentPart() {
  if (!currentModule || !currentModule.sections) return [];
  const secs = currentModule.sections.filter(s => {
    const p = (s.part === 'exercises' || s.part === 'video') ? s.part : 'main';
    return p === currentPart;
  });
  return secs.flatMap(s => (s.activities || []).map(a => ({ section: s, activity: a })));
}

async function renderCurrentActivity() {
  stopAudio();
  contentArea.scrollTop = 0;

  const acts = getActivitiesForCurrentPart();
  if (acts.length === 0) {
    contentArea.innerHTML = `
      <div style="text-align: center; padding: 40px 16px;">
        <i class="fa fa-info-circle" style="font-size: 2rem; color: var(--text-faint); margin-bottom: 12px;"></i>
        <p style="font-size: 0.95rem; color: var(--text-muted);">Nessuna attività in questa sezione.</p>
      </div>`;
    stepIndicator.textContent = '0 / 0';
    btnPrev.disabled = true;
    btnNext.disabled = true;
    return;
  }

  if (currentActIndex >= acts.length) currentActIndex = acts.length - 1;
  if (currentActIndex < 0) currentActIndex = 0;

  const item = acts[currentActIndex];
  const a = item.activity;

  stepIndicator.textContent = `${currentActIndex + 1} / ${acts.length}`;
  btnPrev.disabled = currentActIndex === 0;
  btnNext.disabled = currentActIndex === acts.length - 1;

  // Load existing progress for parts
  const progressList = await dbAll('progress');

  let html = `
    <div class="activity-card">
      <div class="act-head">
        <div class="act-num">${a.number || (currentActIndex + 1)}</div>
        <div class="act-title-box">
          <h2>${a.title}</h2>
          <div class="act-meta">
            ${a.page ? `<span class="badge page"><i class="fa fa-book"></i> pag. ${a.page}</span>` : ''}
            ${(a.skills || []).map(s => `<span class="badge">${s}</span>`).join('')}
          </div>
        </div>
      </div>`;

  if (a.instructions) {
    html += `<div class="act-instructions">${escapeHtml(a.instructions)}</div>`;
  }

  // Media Blocks (Images, Audio)
  if (a.media && a.media.length > 0) {
    for (let i = 0; i < a.media.length; i++) {
      const m = a.media[i];
      if (m.type === 'image') {
        const imgSrc = getAssetUrl(m.src);
        html += `
          <div class="media-container">
            <img class="media-image" src="${imgSrc}" alt="${escapeHtml(m.alt || '')}">
          </div>`;
      } else if (m.type === 'audio') {
        const audioSrc = getAssetUrl(m.src);
        html += `
          <div class="audio-card" id="audioCard_${i}">
            <div class="audio-header">
              <span class="audio-title"><i class="fa fa-volume-up"></i> ${escapeHtml(m.label || 'Audio')}</span>
              <span style="font-size:0.75rem; color:var(--text-faint);">${m.transcript ? 'Trascrizione inclusa' : ''}</span>
            </div>
            <div class="audio-controls">
              <button class="audio-play-btn" onclick="toggleAudio('${audioSrc}', ${i})">
                <i class="fa fa-play" id="audioPlayIcon_${i}"></i>
              </button>
              <div class="audio-seek-box">
                <input type="range" class="audio-slider" id="audioSeek_${i}" min="0" max="100" value="0" oninput="seekAudio(this.value)">
                <div class="audio-times">
                  <span id="audioCurTime_${i}">0:00</span>
                  <span id="audioDurTime_${i}">0:00</span>
                </div>
              </div>
            </div>
            ${m.transcript ? `
              <button class="audio-transcript-btn" onclick="openSpotifyLyrics(${i})">
                <i class="fa fa-align-left" style="color:var(--primary);"></i> Mostra trascrizione in tempo reale
              </button>` : ''}
          </div>`;
      }
    }
  }

  // Exercise Parts
  for (let pIdx = 0; pIdx < (a.parts || []).length; pIdx++) {
    const part = a.parts[pIdx];
    const rec = progressList.find(pr => pr.key === `${currentModule.id}/${part.id}`);
    html += renderExercisePart(part, pIdx, rec);
  }

  html += `</div>`;
  contentArea.innerHTML = html;
}

// --- Exercise Renderers ---
function renderExercisePart(part, index, rec) {
  let html = `<div class="ex-box" data-part-id="${part.id}" data-part-type="${part.type}">`;

  if (part.instructions) {
    html += `<div style="font-size:0.9rem; font-weight:600; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(part.instructions)}</div>`;
  }

  // 1. Info / Dialogues / Reading
  if (part.type === 'info') {
    if (part.content) {
      html += `<div style="background:var(--bg-card-subtle); padding:12px; border-radius:8px; font-size:0.95rem; line-height:1.6;">${escapeHtml(part.content)}</div>`;
    }
    if (part.dialogue && Array.isArray(part.dialogue)) {
      html += `<div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">`;
      for (const line of part.dialogue) {
        html += `
          <div style="background:var(--bg-card-subtle); padding:10px 12px; border-radius:10px; border-left:3px solid var(--primary);">
            <strong style="color:var(--primary); font-size:0.85rem;">${escapeHtml(line.speaker || '')}:</strong>
            <span style="font-size:0.95rem; margin-left:4px;">${escapeHtml(line.text || '')}</span>
          </div>`;
      }
      html += `</div>`;
    }
  }

  // 2. Choice (Single / Multiple Choice)
  else if (part.type === 'choice') {
    const draft = rec ? rec.draft : null;
    html += `<div class="choice-list">`;
    for (let qIdx = 0; qIdx < (part.questions || []).length; qIdx++) {
      const q = part.questions[qIdx];
      html += `<div style="font-weight:700; font-size:0.95rem; margin-top:6px;">${escapeHtml(q.prompt || '')}</div>`;
      for (let oIdx = 0; oIdx < (q.options || []).length; oIdx++) {
        const optText = typeof q.options[oIdx] === 'object' ? q.options[oIdx].text : q.options[oIdx];
        const isSelected = draft && (Array.isArray(draft[qIdx]) ? draft[qIdx].includes(oIdx) : draft[qIdx] === oIdx);
        html += `
          <div class="choice-card ${isSelected ? 'selected' : ''}" data-q="${qIdx}" data-o="${oIdx}" onclick="selectChoice(this, '${part.id}', ${qIdx}, ${oIdx})">
            <i class="fa ${isSelected ? 'fa-check-circle' : 'fa-circle'}" style="color:${isSelected ? 'var(--primary)' : 'var(--text-faint)'};"></i>
            <span>${escapeHtml(optText)}</span>
          </div>`;
      }
    }
    html += `</div>`;
    html += renderActionRow(part.id, rec);
  }

  // 3. Gapfill
  else if (part.type === 'gapfill' || part.type === 'table') {
    const draft = rec ? rec.draft : {};
    html += `<div style="background:var(--bg-card-subtle); padding:12px; border-radius:10px; font-size:1rem; line-height:2.2;">`;
    for (let itIdx = 0; itIdx < (part.items || []).length; itIdx++) {
      const it = part.items[itIdx];
      // Replace [[gap]] with an input
      let text = escapeHtml(it.text || '');
      let gapCounter = 0;
      text = text.replace(/\[\[(.*?)\]\]/g, (match, answer) => {
        const gapId = `${itIdx}_${gapCounter++}`;
        const val = (draft && draft[gapId]) || '';
        return `<input type="text" class="gap-input" data-gap-id="${gapId}" data-part-id="${part.id}" value="${escapeHtml(val)}" oninput="onGapInput(this, '${part.id}')">`;
      });
      html += `<div>${text}</div>`;
    }
    html += `</div>`;
    html += renderActionRow(part.id, rec);
  }

  // 4. True / False
  else if (part.type === 'truefalse') {
    const draft = rec ? rec.draft : {};
    html += `<div style="display:flex; flex-direction:column; gap:8px;">`;
    for (let sIdx = 0; sIdx < (part.statements || []).length; sIdx++) {
      const s = part.statements[sIdx];
      const val = draft ? draft[sIdx] : null;
      html += `
        <div class="tf-row">
          <div class="tf-text">${escapeHtml(s.text)}</div>
          <div class="tf-btn-group">
            <button class="tf-btn ${val === true ? 'selected' : ''}" onclick="selectTf('${part.id}', ${sIdx}, true, this)">Vero</button>
            <button class="tf-btn ${val === false ? 'selected' : ''}" onclick="selectTf('${part.id}', ${sIdx}, false, this)">Falso</button>
          </div>
        </div>`;
    }
    html += `</div>`;
    html += renderActionRow(part.id, rec);
  }

  // 5. Open written response (with Live Word Counter)
  else if (part.type === 'open') {
    const draft = rec ? rec.draft : '';
    const wordCount = (draft || '').trim() ? (draft || '').trim().split(/\s+/).length : 0;
    html += `
      <div>
        <textarea style="width:100%; height:120px; padding:10px; border-radius:8px; border:1px solid var(--border); background:var(--bg-card-subtle); color:var(--text); font-size:0.95rem; resize:none;"
                  placeholder="Scrivi qui la tua risposta..."
                  oninput="onOpenInput(this, '${part.id}')">${escapeHtml(draft)}</textarea>
        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-faint); margin-top:4px;">
          <span id="wordCounter_${part.id}"><i class="fa fa-pen"></i> Parole: ${wordCount}</span>
          <span>Salvato automaticamente</span>
        </div>
      </div>`;
    html += renderActionRow(part.id, rec, false);
  }

  // 6. Speaking / Oral Recording (with timer)
  else if (part.type === 'speaking') {
    html += `
      <div style="text-align:center; padding:18px 12px; background:var(--bg-card-subtle); border-radius:10px;">
        <button class="btn-icon" style="width:56px; height:56px; margin:0 auto 10px; background:var(--primary); color:#fff; font-size:1.4rem;"
                onclick="toggleSpeakingRecord('${part.id}')">
          <i class="fa fa-microphone" id="micIcon_${part.id}"></i>
        </button>
        <div id="speakingTimer_${part.id}" style="font-size:1rem; font-weight:700; color:var(--primary);">00:00</div>
        <p style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Tocca per registrare la tua risposta vocale</p>
      </div>`;
    html += renderActionRow(part.id, rec, false);
  }

  html += `</div>`;
  return html;
}

function renderActionRow(partId, rec, showVerify = true) {
  const scoreText = rec && rec.score !== undefined ? `${rec.score}/${rec.maxScore || rec.score} pt` : '';
  return `
    <div class="actions-row">
      ${showVerify ? `<button class="btn-action primary" onclick="verifyPart('${partId}')"><i class="fa fa-check"></i> Verifica</button>` : ''}
      <button class="btn-action secondary" onclick="retryPart('${partId}')"><i class="fa fa-redo"></i> Riprova</button>
      <span class="score-badge" id="scoreBadge_${partId}">${scoreText}</span>
    </div>`;
}

// --- Interaction Handlers ---
window.selectChoice = function(el, partId, qIdx, oIdx) {
  const list = el.parentElement;
  list.querySelectorAll(`.choice-card[data-q="${qIdx}"]`).forEach(c => {
    c.classList.remove('selected', 'correct', 'wrong');
    c.querySelector('i').className = 'fa fa-circle';
    c.querySelector('i').style.color = 'var(--text-faint)';
  });

  el.classList.add('selected');
  el.querySelector('i').className = 'fa fa-check-circle';
  el.querySelector('i').style.color = 'var(--primary)';

  vibrate(20);
  saveDraft(partId, { [qIdx]: oIdx });
};

window.onGapInput = function(input, partId) {
  const box = document.querySelector(`.ex-box[data-part-id="${partId}"]`);
  const inputs = box.querySelectorAll('.gap-input');
  const draft = {};
  inputs.forEach(inp => {
    draft[inp.dataset.gapId] = inp.value;
  });
  saveDraft(partId, draft);
};

window.selectTf = function(partId, sIdx, val, btn) {
  const group = btn.parentElement;
  group.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  vibrate(20);

  dbGet('progress', `${currentModule.id}/${partId}`).then(rec => {
    const draft = (rec && rec.draft) || {};
    draft[sIdx] = val;
    saveDraft(partId, draft);
  });
};

window.onOpenInput = function(textarea, partId) {
  const text = textarea.value;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const counter = $(`wordCounter_${partId}`);
  if (counter) counter.innerHTML = `<i class="fa fa-pen"></i> Parole: ${words}`;
  saveDraft(partId, text);
};

let speakingInterval = null;
let speakingSeconds = 0;
let isRecording = false;

window.toggleSpeakingRecord = function(partId) {
  const icon = $(`micIcon_${partId}`);
  const timer = $(`speakingTimer_${partId}`);
  if (!isRecording) {
    isRecording = true;
    speakingSeconds = 0;
    if (icon) icon.className = 'fa fa-stop';
    vibrate(40);
    speakingInterval = setInterval(() => {
      speakingSeconds++;
      const m = String(Math.floor(speakingSeconds / 60)).padStart(2, '0');
      const s = String(speakingSeconds % 60).padStart(2, '0');
      if (timer) timer.textContent = `${m}:${s}`;
    }, 1000);
  } else {
    isRecording = false;
    clearInterval(speakingInterval);
    if (icon) icon.className = 'fa fa-microphone';
    vibrate(40);
    toast('Registrazione audio completata e salvata!');
    saveDraft(partId, { duration: speakingSeconds, recordedAt: new Date().toISOString() });
  }
};

async function saveDraft(partId, draft) {
  const key = `${currentModule.id}/${partId}`;
  const existing = (await dbGet('progress', key)) || { key, moduleId: currentModule.id, partId };
  existing.draft = draft;
  existing.updatedAt = new Date().toISOString();
  await dbPut('progress', existing);
}

// --- Check / Grade Part ---
window.verifyPart = async function(partId) {
  vibrate(30);
  const acts = getActivitiesForCurrentPart();
  const a = acts[currentActIndex]?.activity;
  if (!a) return;
  const part = a.parts.find(p => p.id === partId);
  if (!part) return;

  const key = `${currentModule.id}/${partId}`;
  const rec = (await dbGet('progress', key)) || { key, moduleId: currentModule.id, partId, draft: null };

  let score = 0;
  let maxScore = 0;

  // Grade Choice
  if (part.type === 'choice') {
    const box = document.querySelector(`.ex-box[data-part-id="${partId}"]`);
    for (let qIdx = 0; qIdx < (part.questions || []).length; qIdx++) {
      const q = part.questions[qIdx];
      maxScore++;
      const selected = rec.draft ? rec.draft[qIdx] : null;
      const isRight = selected === q.answer;
      if (isRight) score++;

      // Color cards
      const card = box.querySelector(`.choice-card[data-q="${qIdx}"][data-o="${selected}"]`);
      if (card) {
        card.classList.add(isRight ? 'correct' : 'wrong');
      }
    }
  }

  // Grade Gapfill
  else if (part.type === 'gapfill' || part.type === 'table') {
    const box = document.querySelector(`.ex-box[data-part-id="${partId}"]`);
    for (let itIdx = 0; itIdx < (part.items || []).length; itIdx++) {
      const it = part.items[itIdx];
      let gapCounter = 0;
      it.text.replace(/\[\[(.*?)\]\]/g, (m, expected) => {
        maxScore++;
        const gapId = `${itIdx}_${gapCounter++}`;
        const given = (rec.draft && rec.draft[gapId]) ? rec.draft[gapId].trim().toLowerCase() : '';
        const correctAnswers = expected.split('|').map(s => s.trim().toLowerCase());
        const isRight = correctAnswers.includes(given);
        if (isRight) score++;

        const inp = box.querySelector(`.gap-input[data-gap-id="${gapId}"]`);
        if (inp) {
          inp.classList.remove('correct', 'wrong');
          inp.classList.add(isRight ? 'correct' : 'wrong');
        }
      });
    }
  }

  // Grade True/False
  else if (part.type === 'truefalse') {
    for (let sIdx = 0; sIdx < (part.statements || []).length; sIdx++) {
      maxScore++;
      const s = part.statements[sIdx];
      const given = rec.draft ? rec.draft[sIdx] : null;
      if (given === s.answer) score++;
    }
  }

  rec.score = score;
  rec.maxScore = maxScore;
  rec.status = score === maxScore ? 'correct' : score > 0 ? 'partial' : 'incorrect';
  rec.updatedAt = new Date().toISOString();
  await dbPut('progress', rec);

  const badge = $(`scoreBadge_${partId}`);
  if (badge) {
    badge.textContent = `${score}/${maxScore} pt ${score === maxScore ? '– Ottimo!' : ''}`;
    badge.style.color = score === maxScore ? 'var(--success)' : score > 0 ? 'var(--warning)' : 'var(--danger)';
  }

  if (score === maxScore) vibrate(60);
};

window.retryPart = async function(partId) {
  vibrate(25);
  const key = `${currentModule.id}/${partId}`;
  await dbPut('progress', { key, moduleId: currentModule.id, partId, draft: null, status: null });
  renderCurrentActivity();
};

// --- Audio Player & Spotify-Style Fullscreen Lyrics ---
window.toggleAudio = function(src, idx) {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    $(`audioPlayIcon_${idx}`).className = 'fa fa-play';
    return;
  }

  if (!currentAudio || currentAudio.src !== src) {
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio(src);

    currentAudio.ontimeupdate = () => {
      if (!currentAudio) return;
      const cur = currentAudio.currentTime;
      const dur = currentAudio.duration || 1;
      const pct = (cur / dur) * 100;

      const slider = $(`audioSeek_${idx}`);
      if (slider) slider.value = pct;
      const curSpan = $(`audioCurTime_${idx}`);
      if (curSpan) curSpan.textContent = formatTime(cur);
    };

    currentAudio.onloadedmetadata = () => {
      const durSpan = $(`audioDurTime_${idx}`);
      if (durSpan) durSpan.textContent = formatTime(currentAudio.duration);
    };

    currentAudio.onended = () => {
      $(`audioPlayIcon_${idx}`).className = 'fa fa-play';
    };
  }

  currentAudio.play();
  $(`audioPlayIcon_${idx}`).className = 'fa fa-pause';
};

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

window.seekAudio = function(pct) {
  if (currentAudio && currentAudio.duration) {
    currentAudio.currentTime = (pct / 100) * currentAudio.duration;
  }
};

function formatTime(sec) {
  sec = Math.floor(sec || 0);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// --- Spotify-Style Fullscreen Lyrics & Real-time Alignment Engine ---
// Word timing engine ported from StudyDesk PC (GPL-3.0)
function parseTranscript(transcript) {
  const lines = [];
  let totalChars = 0;
  for (const raw of String(transcript || '').split('\n').map(l => l.trim()).filter(Boolean)) {
    let line = raw;
    let speaker = null;
    let isTurn = false;
    if (line.startsWith('- ') || line.startsWith('– ')) {
      isTurn = true;
      line = line.slice(2).trim();
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx <= 18) {
      speaker = line.slice(0, colonIdx).trim();
      line = line.slice(colonIdx + 1).trim();
    }
    const words = line.split(/\s+/).filter(w => w && w !== '-' && w !== '–');
    const count = Math.max(1, words.reduce((acc, w) => acc + w.length, 0));
    totalChars += count;
    lines.push({ speaker, isTurn, words, count });
  }
  return { lines, totalChars };
}

function hasAlignedTimes(parsed, wordTimes) {
  if (!Array.isArray(wordTimes)) return false;
  const n = parsed.lines.reduce((acc, l) => acc + l.words.length, 0);
  if (!n || wordTimes.length !== n) return false;
  let prev = -Infinity;
  for (const p of wordTimes) {
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || p[1] < p[0] || p[0] < prev) return false;
    prev = p[0];
  }
  return true;
}

function wordTimeline(parsed, { duration, wordTimes } = {}) {
  if (hasAlignedTimes(parsed, wordTimes)) {
    return wordTimes.map(([s, e]) => [s, Math.max(e, s + 0.05)]);
  }
  const dur = Math.max(1, Number.isFinite(duration) && duration > 0 ? duration : 30);
  const total = Math.max(1, parsed.totalChars);
  const at = (frac) => frac * dur;
  const out = [];
  let cur = 0;
  for (const line of parsed.lines) {
    for (const w of line.words) {
      const s = at(cur / total);
      cur += w.length;
      out.push([s, Math.max(s + 0.1, at(cur / total))]);
    }
  }
  return out;
}

function wordAt(times, t) {
  let lo = 0, hi = times.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid][0] <= t) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

window.openSpotifyLyrics = function(mediaIdx) {
  const acts = getActivitiesForCurrentPart();
  const a = acts[currentActIndex]?.activity;
  if (!a || !a.media || !a.media[mediaIdx]) return;
  const m = a.media[mediaIdx];
  if (!m.transcript) return;

  const audioSrc = getAssetUrl(m.url);
  // Ensure audio element exists
  if (!currentAudio || currentAudio.src !== audioSrc) {
    if (currentAudio) currentAudio.pause();
    currentAudio = new Audio(audioSrc);
    currentAudio.ontimeupdate = () => {
      if (!currentAudio) return;
      const cur = currentAudio.currentTime;
      const dur = currentAudio.duration || 1;
      const slider = $(`audioSeek_${mediaIdx}`);
      if (slider) slider.value = (cur / dur) * 100;
      const curSpan = $(`audioCurTime_${mediaIdx}`);
      if (curSpan) curSpan.textContent = formatTime(cur);
    };
    currentAudio.onloadedmetadata = () => {
      const durSpan = $(`audioDurTime_${mediaIdx}`);
      if (durSpan) durSpan.textContent = formatTime(currentAudio.duration);
    };
    currentAudio.onended = () => {
      const actIcon = $(`audioPlayIcon_${mediaIdx}`);
      if (actIcon) actIcon.className = 'fa fa-play';
      const spIcon = $('spotifyPlayIcon');
      if (spIcon) spIcon.className = 'fa fa-play';
    };
  }

  // Set track info
  const trackTitle = $('spotifyTrackTitle');
  if (trackTitle) trackTitle.textContent = m.label || a.title || 'Trascrizione Audio';
  const trackArtist = $('spotifyTrackArtist');
  if (trackArtist) trackArtist.textContent = (currentBook ? currentBook.title : 'StudyDesk') + (currentModule ? ' · ' + currentModule.title : '');

  // Thumbnail Artwork
  const thumb = $('spotifyThumb');
  if (thumb) {
    if (currentBook && currentBook.coverBlob) {
      thumb.src = URL.createObjectURL(currentBook.coverBlob);
    } else {
      thumb.src = 'icons/icon.svg';
    }
  }

  // Parse lines & words using StudyDesk engine
  const parsed = parseTranscript(m.transcript);
  const aligned = hasAlignedTimes(parsed, m.wordTimes);
  const dur = Math.max(1, currentAudio.duration && Number.isFinite(currentAudio.duration) ? currentAudio.duration : 30);
  const times = wordTimeline(parsed, { duration: dur, wordTimes: m.wordTimes });

  const wordNodes = [];
  let wi = 0;
  lyricsBody.innerHTML = '';

  parsed.lines.forEach((pLine, lineIdx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyrics-line';
    lineEl.id = `spotifyLine_${lineIdx}`;
    lineEl.dataset.lineIdx = lineIdx;

    if (pLine.speaker) {
      const spk = document.createElement('span');
      spk.className = 'lyrics-speaker';
      spk.textContent = pLine.speaker;
      lineEl.appendChild(spk);
    }

    const firstWordIdx = wi;
    pLine.words.forEach(text => {
      const [start, end] = times[wi] || [0, 0];
      const wordSpan = document.createElement('span');
      wordSpan.className = 'lyric-word future';
      wordSpan.dataset.wordIdx = wi;
      wordSpan.textContent = text + ' ';
      wordSpan.onclick = (e) => {
        e.stopPropagation();
        vibrate(20);
        if (currentAudio) {
          currentAudio.currentTime = start;
          if (currentAudio.paused) currentAudio.play();
        }
      };
      lineEl.appendChild(wordSpan);
      wordNodes.push({ el: wordSpan, start, end, lineIdx });
      wi++;
    });

    lineEl.onclick = () => {
      vibrate(20);
      if (times[firstWordIdx] && currentAudio) {
        currentAudio.currentTime = times[firstWordIdx][0];
        if (currentAudio.paused) currentAudio.play();
      }
    };

    lyricsBody.appendChild(lineEl);
  });

  // Open modal
  lyricsModal.classList.add('open');

  if (spotifyLyricsAnimId) {
    cancelAnimationFrame(spotifyLyricsAnimId);
    spotifyLyricsAnimId = null;
  }

  let currentWordIdx = -2;
  let activeLineIdx = -1;

  // 60fps high precision update loop
  function updateSpotifyLyrics() {
    if (!lyricsModal.classList.contains('open') || !currentAudio) return;
    const isPlaying = !currentAudio.paused && !currentAudio.ended;
    const started = isPlaying || (currentAudio.currentTime || 0) > 0.05;
    const cur = currentAudio.currentTime || 0;
    const aDur = currentAudio.duration && Number.isFinite(currentAudio.duration) ? currentAudio.duration : dur;
    const pos = cur + (aligned ? 0.05 : 0.18);

    // Update scrubber slider & times
    const slider = $('spotifyLyricsSlider');
    if (slider && !slider._isDragging) {
      slider.value = aDur > 0 ? (cur / aDur) * 100 : 0;
    }
    const curTimeSpan = $('spotifyCurTime');
    if (curTimeSpan) curTimeSpan.textContent = formatTime(cur);
    const remTimeSpan = $('spotifyRemTime');
    if (remTimeSpan) remTimeSpan.textContent = '-' + formatTime(Math.max(0, aDur - cur));

    // Update play button icons
    const spIcon = $('spotifyPlayIcon');
    if (spIcon) spIcon.className = isPlaying ? 'fa fa-pause' : 'fa fa-play';
    const actIcon = $(`audioPlayIcon_${mediaIdx}`);
    if (actIcon) actIcon.className = isPlaying ? 'fa fa-pause' : 'fa fa-play';

    // Word highlighting binary search
    const idx = started ? wordAt(times, pos) : -2;
    if (idx !== currentWordIdx) {
      wordNodes.forEach((w, i) => {
        w.el.className = 'lyric-word ' + (!started || i < idx ? 'spoken' : i === idx ? 'spoken active' : 'future');
      });

      let newLineIdx = -1;
      if (idx >= 0 && wordNodes[idx]) {
        newLineIdx = wordNodes[idx].lineIdx;
      }
      if (newLineIdx !== activeLineIdx) {
        activeLineIdx = newLineIdx;
        const lineEls = lyricsBody.querySelectorAll('.lyrics-line');
        lineEls.forEach((el, lIdx) => {
          el.classList.toggle('active', lIdx === activeLineIdx);
        });
        if (activeLineIdx >= 0) {
          const lineToScroll = $(`spotifyLine_${activeLineIdx}`);
          if (lineToScroll) {
            lineToScroll.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
      currentWordIdx = idx;
    }

    if (isPlaying) {
      spotifyLyricsAnimId = requestAnimationFrame(updateSpotifyLyrics);
    }
  }

  // Bind scrubber slider
  const slider = $('spotifyLyricsSlider');
  if (slider) {
    slider.oninput = (e) => {
      if (currentAudio && currentAudio.duration) {
        currentAudio.currentTime = (parseFloat(e.target.value) / 100) * currentAudio.duration;
      }
      updateSpotifyLyrics();
    };
    slider.onmousedown = slider.ontouchstart = () => { slider._isDragging = true; };
    slider.onmouseup = slider.ontouchend = () => { slider._isDragging = false; };
  }

  // Bind play/pause button
  const playBtn = $('spotifyPlayBtn');
  if (playBtn) {
    playBtn.onclick = () => {
      vibrate(25);
      if (currentAudio) {
        if (currentAudio.paused) {
          currentAudio.play();
        } else {
          currentAudio.pause();
        }
        updateSpotifyLyrics();
      }
    };
  }

  // Bind prev (-5s) & next (+5s)
  const prevBtn = $('spotifyPrevBtn');
  if (prevBtn) {
    prevBtn.onclick = () => {
      vibrate(20);
      if (currentAudio) {
        currentAudio.currentTime = Math.max(0, currentAudio.currentTime - 5);
        updateSpotifyLyrics();
      }
    };
  }

  const nextBtn = $('spotifyNextBtn');
  if (nextBtn) {
    nextBtn.onclick = () => {
      vibrate(20);
      if (currentAudio && currentAudio.duration) {
        currentAudio.currentTime = Math.min(currentAudio.duration, currentAudio.currentTime + 5);
        updateSpotifyLyrics();
      }
    };
  }

  // Bind heart button
  const heartBtn = $('spotifyHeartBtn');
  if (heartBtn) {
    heartBtn.onclick = () => {
      vibrate(25);
      const icon = $('spotifyHeartIcon');
      if (icon) {
        if (icon.classList.contains('fa-solid')) {
          icon.className = 'fa-regular fa-heart';
          icon.style.color = 'rgba(255, 255, 255, 0.8)';
        } else {
          icon.className = 'fa-solid fa-heart';
          icon.style.color = '#1db954';
        }
      }
    };
  }

  // Bind shuffle & repeat buttons (toggles visual state)
  const shuffleBtn = $('spotifyShuffleBtn');
  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      vibrate(20);
      shuffleBtn.classList.toggle('active');
      shuffleBtn.style.color = shuffleBtn.classList.contains('active') ? '#1db954' : '#ffffff';
    };
  }

  const repeatBtn = $('spotifyRepeatBtn');
  if (repeatBtn) {
    repeatBtn.onclick = () => {
      vibrate(20);
      repeatBtn.classList.toggle('active');
      repeatBtn.style.color = repeatBtn.classList.contains('active') ? '#1db954' : '#ffffff';
      if (currentAudio) currentAudio.loop = repeatBtn.classList.contains('active');
    };
  }

  // Event handlers on audio element
  currentAudio.onplay = () => {
    if (spotifyLyricsAnimId) cancelAnimationFrame(spotifyLyricsAnimId);
    spotifyLyricsAnimId = requestAnimationFrame(updateSpotifyLyrics);
  };
  currentAudio.onpause = () => {
    if (spotifyLyricsAnimId) cancelAnimationFrame(spotifyLyricsAnimId);
    updateSpotifyLyrics();
  };
  currentAudio.onseeked = updateSpotifyLyrics;

  // Auto-play when opened
  if (currentAudio.paused) {
    currentAudio.play().catch(() => {});
  }
  updateSpotifyLyrics();
};

function closeSpotifyLyrics() {
  if (spotifyLyricsAnimId) {
    cancelAnimationFrame(spotifyLyricsAnimId);
    spotifyLyricsAnimId = null;
  }
  lyricsModal.classList.remove('open');
}

if (btnCloseLyrics) btnCloseLyrics.onclick = closeSpotifyLyrics;

// --- Indice / Bottom Sheet ---
btnIndex.onclick = () => {
  const acts = getActivitiesForCurrentPart();
  let html = '';
  acts.forEach((item, idx) => {
    const a = item.activity;
    const isActive = idx === currentActIndex;
    html += `
      <div class="sheet-item ${isActive ? 'active' : ''}" onclick="jumpToActivity(${idx})">
        <div>
          <strong>${a.number || (idx + 1)}.</strong> ${escapeHtml(a.title)}
          ${a.page ? `<span style="font-size:0.75rem; color:var(--text-faint); margin-left:6px;">pag. ${a.page}</span>` : ''}
        </div>
        <i class="fa ${isActive ? 'fa-arrow-right' : 'fa-chevron-right'}" style="font-size:0.8rem; opacity:0.6;"></i>
      </div>`;
  });
  indexSheetList.innerHTML = html;
  indexSheet.classList.add('open');
};

window.jumpToActivity = function(idx) {
  indexSheet.classList.remove('open');
  currentActIndex = idx;
  renderCurrentActivity();
};

indexSheet.onclick = (e) => {
  if (e.target === indexSheet) indexSheet.classList.remove('open');
};

// Stepper Navigation
btnPrev.onclick = () => {
  if (currentActIndex > 0) {
    currentActIndex--;
    renderCurrentActivity();
  }
};

btnNext.onclick = () => {
  const acts = getActivitiesForCurrentPart();
  if (currentActIndex < acts.length - 1) {
    currentActIndex++;
    renderCurrentActivity();
  }
};

btnBack.onclick = () => renderBookshelf();

// --- Wi-Fi Computer Sync Modal ---
const peerLostTimers = new Map();

btnSync.onclick = () => {
  for (const timer of peerLostTimers.values()) clearTimeout(timer);
  peerLostTimers.clear();
  discoveredPeers.clear();
  peerList.innerHTML = `
    <div style="padding:10px; background:var(--bg-card-subtle); border-radius:8px; font-size:0.85rem; color:var(--text-muted);">
      <i class="fa fa-spinner fa-spin"></i> Ricerca computer sulla rete Wi-Fi...
    </div>`;
  syncSheet.classList.add('open');

  if (window.androidBridge && typeof window.androidBridge.discoverComputers === 'function') {
    window.androidBridge.discoverComputers();
  }
};

btnCloseSync.onclick = () => {
  syncSheet.classList.remove('open');
  for (const timer of peerLostTimers.values()) clearTimeout(timer);
  peerLostTimers.clear();
  if (window.androidBridge && typeof window.androidBridge.stopDiscovery === 'function') {
    window.androidBridge.stopDiscovery();
  }
};

syncSheet.onclick = (e) => {
  if (e.target === syncSheet) btnCloseSync.click();
};

// Peer callbacks from Android (with 15s debounce grace period to prevent mDNS packet flapping)
window.onPeerDiscovered = function(peer) {
  if (peerLostTimers.has(peer.name)) {
    clearTimeout(peerLostTimers.get(peer.name));
    peerLostTimers.delete(peer.name);
  }
  discoveredPeers.set(peer.name, peer);
  renderPeerList();
};

window.onPeerLost = function(name) {
  if (peerLostTimers.has(name)) {
    clearTimeout(peerLostTimers.get(name));
  }
  // Hold peer visible during mDNS renewals for 15s before actually removing
  const timer = setTimeout(() => {
    discoveredPeers.delete(name);
    peerLostTimers.delete(name);
    renderPeerList();
  }, 15000);
  peerLostTimers.set(name, timer);
};

function renderPeerList() {
  if (discoveredPeers.size === 0) {
    peerList.innerHTML = `
      <div style="padding:10px; background:var(--bg-card-subtle); border-radius:8px; font-size:0.85rem; color:var(--text-muted);">
        <i class="fa fa-search"></i> Nessun computer trovato sulla rete locale finora.
      </div>`;
    return;
  }

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

  let html = '';
  for (const peer of discoveredPeers.values()) {
    html += `
      <div style="background:var(--bg-card-subtle); padding:10px 12px; border-radius:8px; border:1px solid var(--border-light); margin-bottom:6px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <strong style="font-size:0.9rem;"><i class="fa fa-laptop" style="color:var(--primary);"></i> ${escapeHtml(peer.name)}</strong>
            <div style="font-size:0.75rem; color:var(--text-faint);">${peer.host}:${peer.port}</div>
          </div>
          <button class="btn-pill primary" style="font-size:0.8rem; padding:5px 12px;" onclick="connectToPeer('${peer.host}', ${peer.port})">Sincronizza</button>
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn-pill secondary" style="font-size:0.78rem; padding:4px 10px;" onclick="requestComputerBooks('${peer.host}', ${peer.port})">
            <i class="fa fa-book-bookmark"></i> Sfoglia libri (${peer.name})
          </button>
        </div>
      </div>`;
  }
  peerList.innerHTML = html;
}

window.connectToPeer = async function(host, port) {
  const code = (syncCodeInput.value || '').trim();
  syncLog.style.display = 'block';
  syncLog.innerHTML = `[Wi-Fi] Connessione a ${host}:${port}...<br>`;

  // Gather local progress records to send to computer
  const allProgress = await dbAll('progress');
  const progressMap = {};
  for (const p of allProgress) {
    progressMap[`studydesk/progress:${p.key}`] = p;
  }

  // Also query computer books automatically
  requestComputerBooks(host, port);

  if (window.androidBridge && typeof window.androidBridge.syncWithComputer === 'function') {
    window.androidBridge.syncWithComputer(host, port, code, 'android-mobile', JSON.stringify(progressMap));
  } else {
    syncLog.innerHTML += `[Simulazione] AndroidBridge non disponibile (test browser)<br>`;
  }
};

window.requestComputerBooks = function(host, port) {
  activeComputerHost = host;
  activeComputerPort = port;
  const code = (syncCodeInput.value || '').trim();

  if (computerBooksSection) computerBooksSection.style.display = 'block';
  if (computerBooksList) {
    computerBooksList.innerHTML = `
      <div style="padding:12px; background:var(--bg-card-subtle); border-radius:8px; font-size:0.82rem; color:var(--text-muted); text-align:center;">
        <i class="fa fa-spinner fa-spin"></i> Ricerca libri su ${host}:${port}...
      </div>`;
  }

  if (window.androidBridge && typeof window.androidBridge.fetchComputerBooks === 'function') {
    window.androidBridge.fetchComputerBooks(host, port, code);
  } else {
    // Browser preview simulation
    setTimeout(() => {
      window.onComputerBooksDiscovered([
        { id: 'quaderni-plida-a2', title: 'Quaderni del PLIDA – A2', size: 69084700, chunks: 66, tid: 'demo' },
        { id: 'nuovo-espresso-plus-1', title: 'Nuovo Espresso Plus 1', size: 126248300, chunks: 121, tid: 'demo' }
      ]);
    }, 600);
  }
};

if (btnRefreshComputerBooks) {
  btnRefreshComputerBooks.onclick = () => {
    if (activeComputerHost && activeComputerPort) {
      requestComputerBooks(activeComputerHost, activeComputerPort);
    } else {
      toast('Seleziona prima un computer dalla lista');
    }
  };
}

window.onComputerBooksDiscovered = async function(books) {
  lastDiscoveredBooks = books || [];
  if (!computerBooksSection || !computerBooksList) return;
  computerBooksSection.style.display = 'block';

  if (!lastDiscoveredBooks.length) {
    computerBooksList.innerHTML = `
      <div style="padding:10px; background:var(--bg-card-subtle); border-radius:8px; font-size:0.8rem; color:var(--text-muted); text-align:center;">
        Nessun libro trovato sul computer. Assicurati che StudyDesk/HubDesk sia in esecuzione.
      </div>`;
    return;
  }

  const existingBooks = await dbAll('books');
  const existingSet = new Set((existingBooks || []).map(b => b.id));

  let html = '';
  for (const b of lastDiscoveredBooks) {
    const isInstalled = existingSet.has(b.id);
    const sizeStr = formatBytes(b.size);

    html += `
      <div class="computer-book-card">
        <div class="computer-book-info">
          <div class="computer-book-title" title="${escapeHtml(b.title)}">
            <i class="fa fa-book" style="color:var(--primary); margin-right:4px;"></i> ${escapeHtml(b.title)}
          </div>
          <div class="computer-book-meta">
            <span class="badge-memory"><i class="fa fa-database"></i> ${sizeStr}</span>
            <span>${b.chunks || 0} parti</span>
            ${isInstalled ? '<span class="badge-installed"><i class="fa fa-check"></i> Già installato</span>' : ''}
          </div>
        </div>
        <button class="btn-pill ${isInstalled ? 'secondary' : 'primary'}" style="font-size:0.75rem; padding:5px 10px; flex-shrink:0;"
                onclick="startImportComputerBook('${b.id}', '${b.tid}', ${b.chunks}, '${escapeHtml(b.title)}', ${b.size})">
          <i class="fa ${isInstalled ? 'fa-rotate' : 'fa-cloud-arrow-down'}"></i> ${isInstalled ? 'Re-importa' : 'Importa Wi-Fi'}
        </button>
      </div>`;
  }
  computerBooksList.innerHTML = html;
};

window.onComputerBooksError = function(err) {
  if (computerBooksList) {
    computerBooksList.innerHTML = `
      <div style="padding:10px; background:rgba(239, 68, 68, 0.1); border-radius:8px; font-size:0.8rem; color:var(--danger);">
        <i class="fa fa-circle-exclamation"></i> Impossibile recuperare i libri: ${escapeHtml(err || 'Errore di rete')}
      </div>`;
  }
};

window.startImportComputerBook = function(bookId, tid, totalChunks, bookTitle, totalSize) {
  if (!activeComputerHost || !activeComputerPort) {
    toast('Connessione al computer non attiva');
    return;
  }
  const code = (syncCodeInput.value || '').trim();

  if (bookDownloadModal) {
    if (bookDownloadTitle) bookDownloadTitle.textContent = bookTitle;
    if (bookDownloadStatus) bookDownloadStatus.textContent = 'Inizializzazione download via Wi-Fi...';
    if (bookDownloadBar) bookDownloadBar.style.width = '0%';
    if (bookDownloadPct) bookDownloadPct.textContent = '0%';
    bookDownloadModal.classList.add('open');
  }

  if (window.androidBridge && typeof window.androidBridge.downloadBookFromComputer === 'function') {
    window.androidBridge.downloadBookFromComputer(activeComputerHost, activeComputerPort, code, bookId, tid, totalChunks, bookTitle, totalSize);
  } else {
    // Browser mock simulation
    let p = 0;
    const iv = setInterval(() => {
      p += 20;
      window.onBookDownloadProgress({ percent: p, downloaded: (totalSize * p) / 100, total: totalSize, status: `Scaricamento (${p}%)...` });
      if (p >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          window.onBookDownloadSuccess({ fileName: 'demo.sdbook', bookTitle });
        }, 500);
      }
    }, 400);
  }
};

window.onBookDownloadProgress = function(p) {
  if (!bookDownloadModal || !bookDownloadModal.classList.contains('open')) return;
  if (bookDownloadBar) bookDownloadBar.style.width = `${p.percent}%`;
  if (bookDownloadPct) bookDownloadPct.textContent = `${p.percent}%`;
  if (bookDownloadStatus) {
    bookDownloadStatus.textContent = `${formatBytes(p.downloaded)} di ${formatBytes(p.total)} (${p.percent}%)`;
  }
};

window.onBookDownloadSuccess = async function(res) {
  if (bookDownloadStatus) bookDownloadStatus.textContent = 'Importazione nella libreria...';
  try {
    const fileUrl = `https://studydesk.local/__book_download__/${encodeURIComponent(res.fileName)}`;
    const resp = await fetch(fileUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const buf = await resp.arrayBuffer();
    await importSdbookFromBytes(buf, res.bookTitle);

    if (window.androidBridge && typeof window.androidBridge.deleteTempFile === 'function') {
      window.androidBridge.deleteTempFile(res.fileName);
    }

    if (bookDownloadModal) bookDownloadModal.classList.remove('open');
    toast(`Libro «${res.bookTitle}» importato con successo!`);
    await renderBookshelf();

    // Re-render computer books list so status updates to "Già installato"
    if (lastDiscoveredBooks.length > 0) {
      window.onComputerBooksDiscovered(lastDiscoveredBooks);
    }
  } catch (err) {
    console.error('Error importing downloaded book:', err);
    if (bookDownloadModal) bookDownloadModal.classList.remove('open');
    toast('Errore salvataggio libro: ' + err.message);
  }
};

window.onBookDownloadError = function(res) {
  if (bookDownloadModal) bookDownloadModal.classList.remove('open');
  toast('Errore scaricamento libro: ' + (res.message || 'Errore di rete'));
};

btnManualConnect.onclick = () => {
  const ipPort = (manualIpInput.value || '').trim();
  if (!ipPort) return;
  const parts = ipPort.split(':');
  const host = parts[0];
  const port = parts[1] ? parseInt(parts[1], 10) : 51234;
  connectToPeer(host, port);
};

window.onSyncProgress = function(p) {
  syncLog.style.display = 'block';
  syncLog.innerHTML += `[${p.current}%] ${p.status}<br>`;
  syncLog.scrollTop = syncLog.scrollHeight;
};

window.onSyncComplete = async function(res) {
  syncLog.innerHTML += `<strong>${res.success ? '✔ ' + res.message : '✖ Errore: ' + res.message}</strong><br>`;
  if (res.success && res.data && res.data.records) {
    // Process any book chunks/files received from computer
    toast('Sincronizzazione con il computer completata!');
    renderBookshelf();
  }
};

// Hidden File Picker Handler
filePicker.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showLoadingShelf(`Importazione di ${file.name}...`);
  try {
    const buf = await file.arrayBuffer();
    const rec = await importSdbookFromBytes(buf, file.name);
    toast(`Libro «${rec.title}» importato con successo!`);
    await openBook(rec.id);
  } catch (err) {
    console.error('Error importing picked file:', err);
    toast('Errore: ' + err.message);
    renderBookshelf();
  } finally {
    filePicker.value = '';
  }
};

// --- Android Back Button Hook ---
window.handleAndroidBack = function() {
  if (bookDownloadModal && bookDownloadModal.classList.contains('open')) {
    bookDownloadModal.classList.remove('open');
    return true;
  }
  if (updateModal && updateModal.classList.contains('open')) {
    updateModal.classList.remove('open');
    return true;
  }
  if (aboutSheet && aboutSheet.classList.contains('open')) {
    aboutSheet.classList.remove('open');
    return true;
  }
  if (bookContextSheet && bookContextSheet.classList.contains('open')) {
    closeBookContextMenu();
    return true;
  }
  if (pdfProgressModal && pdfProgressModal.classList.contains('open')) {
    pdfProgressModal.classList.remove('open');
    return true;
  }
  if (lyricsModal && lyricsModal.classList.contains('open')) {
    closeSpotifyLyrics();
    return true;
  }
  if (indexSheet && indexSheet.classList.contains('open')) {
    indexSheet.classList.remove('open');
    return true;
  }
  if (syncSheet && syncSheet.classList.contains('open')) {
    btnCloseSync.click();
    return true;
  }
  if (currentModule) {
    renderBookshelf();
    return true;
  }
  return false; // Exit app
};

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Start app
bootstrap();
