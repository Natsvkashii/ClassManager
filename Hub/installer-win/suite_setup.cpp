// =====================================================================================
// ClassDesk Suite – single Windows installer.
// Conceived and created by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com) – GPL-3.0
// =====================================================================================
//
// ClassDesk-Suite-<v>-Setup.exe = this program + the installers of HubDesk, ClassDesk and StudyDesk appended at the end
// (packed by suite.py, see PAYLOAD FORMAT). It shows a window where the user picks the apps (HubDesk is always installed)
// and runs each installer silently, one after the other.
//
// Command line
//   (none)                               window with the choice of apps
//   --silent | /S [--components=a,b]     no window: installs HubDesk + the listed apps; without --components, HubDesk and
//                                        the apps that are already installed (= "update the suite")
//   --extract=<id> --out=<file>          writes the installer of one app (hubdesk | classdesk | studydesk) and exits:
//                                        HubDesk uses it to install or update a single app without reinstalling itself
//   --list                               prints "id size" for every app inside (tests)
//
// PAYLOAD FORMAT (little endian, at the end of the file)
//   [installer bytes...] [entry x N] [u32 N] [8 bytes "CDSUITE1"]
//   entry = char id[16] (zero padded) + u64 offset + u64 size
#define WIN32_LEAN_AND_MEAN
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <shlobj.h>
#include <stdint.h>
#include <string>
#include <vector>
#include <cstdio>

#ifndef SUITE_VERSION
#define SUITE_VERSION L"0.0.0-000"
#endif

#define IDR_PAYLOAD_HUBDESK   101
#define IDR_PAYLOAD_CLASSDESK 102
#define IDR_PAYLOAD_STUDYDESK 103
#define IDR_PAYLOAD_NOTEDESK  104

struct Entry { std::string id; uint64_t off = 0, size = 0; };
struct AppSpec {
    const wchar_t *id;
    const wchar_t *name;
    const wchar_t *desc;
    int payloadResId;
    const wchar_t *installSubdir;
    const wchar_t *exeName;
    bool required;
};
typedef AppSpec App;

static const AppSpec APPS[] = {
    { L"hubdesk",   L"HubDesk",   L"Centro di controllo, catalogo e sincronizzazione in aula", IDR_PAYLOAD_HUBDESK,   L"HubDesk",   L"HubDesk.exe",   true  },
    { L"classdesk", L"ClassDesk", L"Registro elettronico, corsi, presenze e fatturazione",     IDR_PAYLOAD_CLASSDESK, L"ClassDesk", L"ClassDesk.exe", false },
    { L"studydesk", L"StudyDesk", L"Libri interattivi, esercizi multimediali e lettore",       IDR_PAYLOAD_STUDYDESK, L"StudyDesk", L"StudyDesk.exe", false },
    { L"notedesk",  L"NoteDesk",  L"Quaderni digitali, PDF annotabili e lavagna didattica",    IDR_PAYLOAD_NOTEDESK,  L"NoteDesk",  L"NoteDesk.exe",  false },
};
static const int NAPPS = 4;

static std::wstring g_self;
static std::vector<Entry> g_entries;

// ---------------------------------------------------------------- payload
static bool readPayload() {
    HANDLE f = CreateFileW(g_self.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
    if (f == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz; GetFileSizeEx(f, &sz);
    bool ok = false;
    if (sz.QuadPart > 12) {
        char tail[12]; DWORD rd = 0; LARGE_INTEGER p; p.QuadPart = sz.QuadPart - 12;
        SetFilePointerEx(f, p, nullptr, FILE_BEGIN);
        if (ReadFile(f, tail, 12, &rd, nullptr) && rd == 12 && memcmp(tail + 4, "CDSUITE1", 8) == 0) {
            uint32_t n; memcpy(&n, tail, 4);
            if (n > 0 && n < 16) {
                std::vector<char> idx(n * 32);
                p.QuadPart = sz.QuadPart - 12 - (LONGLONG)idx.size();
                SetFilePointerEx(f, p, nullptr, FILE_BEGIN);
                if (ReadFile(f, idx.data(), (DWORD)idx.size(), &rd, nullptr) && rd == idx.size()) {
                    for (uint32_t i = 0; i < n; i++) {
                        Entry e; char id[17] = {0}; memcpy(id, &idx[i * 32], 16); e.id = id;
                        memcpy(&e.off, &idx[i * 32 + 16], 8); memcpy(&e.size, &idx[i * 32 + 24], 8);
                        g_entries.push_back(e);
                    }
                    ok = true;
                }
            }
        }
    }
    CloseHandle(f);
    return ok;
}
static const Entry *entryOf(const char *id) { for (auto &e : g_entries) if (e.id == id) return &e; return nullptr; }

static bool extractResourceTo(int resId, const std::wstring &out) {
    HRSRC hr = FindResourceW(nullptr, MAKEINTRESOURCEW(resId), RT_RCDATA);
    if (!hr) hr = FindResourceW(nullptr, MAKEINTRESOURCEW(resId), L"PAYLOAD");
    if (!hr) return false;
    HGLOBAL hg = LoadResource(nullptr, hr);
    if (!hg) return false;
    DWORD sz = SizeofResource(nullptr, hr);
    void *ptr = LockResource(hg);
    if (!ptr || sz == 0) return false;
    HANDLE o = CreateFileW(out.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (o == INVALID_HANDLE_VALUE) return false;
    DWORD wr = 0;
    bool ok = WriteFile(o, ptr, sz, &wr, nullptr) && (wr == sz);
    CloseHandle(o);
    if (!ok) DeleteFileW(out.c_str());
    return ok;
}

static bool extractTo(const std::wstring &id, int resId, const std::wstring &out) {
    if (resId > 0 && extractResourceTo(resId, out)) return true;
    std::string narrowId(id.begin(), id.end());
    const Entry *e = entryOf(narrowId.c_str());
    if (!e && narrowId == "notedesk") e = entryOf("notesdesk");
    if (!e) return false;
    HANDLE in = CreateFileW(g_self.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
    if (in == INVALID_HANDLE_VALUE) return false;
    HANDLE o = CreateFileW(out.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr);
    if (o == INVALID_HANDLE_VALUE) { CloseHandle(in); return false; }
    LARGE_INTEGER p; p.QuadPart = (LONGLONG)e->off; SetFilePointerEx(in, p, nullptr, FILE_BEGIN);
    std::vector<char> buf(1 << 20);
    uint64_t left = e->size; bool ok = true;
    while (left > 0) {
        DWORD want = (DWORD)(left < buf.size() ? left : buf.size()), rd = 0, wr = 0;
        if (!ReadFile(in, buf.data(), want, &rd, nullptr) || rd != want || !WriteFile(o, buf.data(), rd, &wr, nullptr) || wr != rd) { ok = false; break; }
        left -= rd;
    }
    CloseHandle(in); CloseHandle(o);
    if (!ok) DeleteFileW(out.c_str());
    return ok;
}

// ---------------------------------------------------------------- helpers
static std::wstring programsDir() {
    wchar_t p[MAX_PATH]; SHGetFolderPathW(nullptr, CSIDL_LOCAL_APPDATA, nullptr, 0, p);
    return std::wstring(p) + L"\\Programs\\";
}
static bool isInstalled(const AppSpec &a) {
    std::wstring p = programsDir() + a.installSubdir + L"\\" + a.exeName;
    if (GetFileAttributesW(p.c_str()) != INVALID_FILE_ATTRIBUTES) return true;
    if (!_wcsicmp(a.id, L"notedesk")) {
        std::wstring leg = programsDir() + L"NotesDesk\\NotesDesk.exe";
        if (GetFileAttributesW(leg.c_str()) != INVALID_FILE_ATTRIBUTES) return true;
    }
    return false;
}
static std::wstring widen(const std::string &s) {
    if (s.empty()) return L"";
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(n, 0); MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], n);
    return w;
}

static std::vector<DWORD> pidsOf(const wchar_t *exe) {
    std::vector<DWORD> out;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return out;
    PROCESSENTRY32W pe; pe.dwSize = sizeof(pe);
    for (BOOL ok = Process32FirstW(snap, &pe); ok; ok = Process32NextW(snap, &pe))
        if (_wcsicmp(pe.szExeFile, exe) == 0) out.push_back(pe.th32ProcessID);
    CloseHandle(snap);
    return out;
}
static BOOL CALLBACK closeWindowsOf(HWND w, LPARAM pid) {
    DWORD p = 0; GetWindowThreadProcessId(w, &p);
    if (p == (DWORD)pid) PostMessageW(w, WM_CLOSE, 0, 0);
    return TRUE;
}
/** Closes the app (its windows first, so it saves its data; then ends what is left after 8 s). */
static void closeApp(const AppSpec &a) {
    auto pids = pidsOf(a.exeName);
    if (!_wcsicmp(a.id, L"notedesk")) {
        for (DWORD p : pidsOf(L"NotesDesk.exe")) pids.push_back(p);
    }
    if (pids.empty()) return;
    for (DWORD p : pids) EnumWindows(closeWindowsOf, (LPARAM)p);
    for (int i = 0; i < 80 && (!pidsOf(a.exeName).empty() || (!_wcsicmp(a.id, L"notedesk") && !pidsOf(L"NotesDesk.exe").empty())); i++) Sleep(100);
    for (DWORD p : pids) { HANDLE h = OpenProcess(PROCESS_TERMINATE, FALSE, p); if (h) { TerminateProcess(h, 0); CloseHandle(h); } }
    Sleep(500);
}

/** Extracts and runs the installer of one app silently. Returns an empty string or the error. */
static std::wstring installOne(const AppSpec &a, const std::wstring &work) {
    std::wstring file = work + L"\\" + a.id + L"-setup.exe";
    if (!extractTo(a.id, a.payloadResId, file)) return L"il pacchetto di " + std::wstring(a.name) + L" manca nell'installer";
    bool wasRunning = !pidsOf(a.exeName).empty() || (!_wcsicmp(a.id, L"notedesk") && !pidsOf(L"NotesDesk.exe").empty());
    closeApp(a);
    std::wstring args = (!_wcsicmp(a.id, L"classdesk") || !_wcsicmp(a.id, L"notedesk")) ? L"--silent" : L"/S";
    std::wstring cmd = L"\"" + file + L"\" " + args;
    STARTUPINFOW si = {sizeof(si)}; PROCESS_INFORMATION pi = {};
    DWORD code = 0;
    if (!CreateProcessW(nullptr, &cmd[0], nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, work.c_str(), &si, &pi)) {
        DWORD err = GetLastError();
        if (err == ERROR_ELEVATION_REQUIRED) {
            SHELLEXECUTEINFOW sei = {sizeof(sei)};
            sei.cbSize = sizeof(sei);
            sei.fMask = SEE_MASK_NOCLOSEPROCESS;
            sei.lpVerb = L"runas";
            sei.lpFile = file.c_str();
            sei.lpParameters = args.c_str();
            sei.nShow = SW_HIDE;
            if (ShellExecuteExW(&sei) && sei.hProcess) {
                WaitForSingleObject(sei.hProcess, 10 * 60 * 1000);
                GetExitCodeProcess(sei.hProcess, &code);
                CloseHandle(sei.hProcess);
                goto install_done;
            }
        }
        return L"impossibile avviare l'installazione (errore " + std::to_wstring(err) + L")";
    }
    WaitForSingleObject(pi.hProcess, 10 * 60 * 1000);
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess);
install_done:
    DeleteFileW(file.c_str());
    if (!_wcsicmp(a.id, L"notedesk")) {
        std::wstring legDir = programsDir() + L"NotesDesk";
        wchar_t legBuf[MAX_PATH + 2] = {};
        wcsncpy(legBuf, legDir.c_str(), MAX_PATH);
        SHFILEOPSTRUCTW fos = {};
        fos.wFunc = FO_DELETE;
        fos.pFrom = legBuf;
        fos.fFlags = FOF_NO_UI | FOF_NOCONFIRMATION | FOF_SILENT;
        SHFileOperationW(&fos);
    }
    if (code != 0) return L"l'installazione è terminata con codice " + std::to_wstring(code);
    for (int i = 0; i < 100 && !isInstalled(a); i++) Sleep(100); // the NSIS uninstaller copy finishes after the exit
    if (wasRunning && isInstalled(a)) {
        std::wstring exe = programsDir() + a.installSubdir + L"\\" + a.exeName;
        STARTUPINFOW rsi = {sizeof(rsi)}; PROCESS_INFORMATION rpi = {};
        std::wstring rcmd = L"\"" + exe + L"\"";
        if (CreateProcessW(nullptr, &rcmd[0], nullptr, nullptr, FALSE, 0, nullptr, nullptr, &rsi, &rpi)) {
            CloseHandle(rpi.hThread); CloseHandle(rpi.hProcess);
        }
    }
    return isInstalled(a) ? L"" : L"il programma non risulta installato";
}

static std::wstring makeWorkDir() {
    wchar_t t[MAX_PATH]; GetTempPathW(MAX_PATH, t);
    std::wstring w = std::wstring(t) + L"ClassDeskSuite-" + std::to_wstring(GetCurrentProcessId());
    CreateDirectoryW(w.c_str(), nullptr);
    return w;
}

// ---------------------------------------------------------------- window
enum { ID_CHECK = 100, ID_INSTALL = 200, ID_CANCEL = 201, WM_DONE = WM_APP + 1, WM_STATUS = WM_APP + 2 };
static HWND g_wnd, g_check[NAPPS], g_status, g_install, g_cancel, g_progress;
static HFONT g_font, g_bold, g_title;
static bool g_busy = false, g_finished = false;
static ULONGLONG g_shownAt = 0;
static std::wstring g_statusText;
static int g_dpi = 96;
static int S(int v) { return MulDiv(v, g_dpi, 96); } // layout in 96-dpi pixels, scaled for the screen

static void setStatus(const std::wstring &s) { g_statusText = s; PostMessageW(g_wnd, WM_STATUS, 0, 0); }

static DWORD WINAPI worker(LPVOID) {
    bool sel[NAPPS];
    for (int i = 0; i < NAPPS; i++) sel[i] = APPS[i].required || SendMessageW(g_check[i], BM_GETCHECK, 0, 0) == BST_CHECKED;
    std::wstring work = makeWorkDir(), errors;
    int total = 0, done = 0;
    for (int i = 0; i < NAPPS; i++) total += sel[i];
    for (int i = 0; i < NAPPS; i++) {
        if (!sel[i]) continue;
        setStatus(std::wstring(L"Installazione di ") + APPS[i].name + L"…");
        std::wstring err = installOne(APPS[i], work);
        if (!err.empty()) errors += std::wstring(APPS[i].name) + L": " + err + L"\n";
        done++;
        PostMessageW(g_progress, PBM_SETPOS, (WPARAM)(done * 100 / (total ? total : 1)), 0);
    }
    RemoveDirectoryW(work.c_str());
    g_statusText = errors.empty() ? L"Installazione completata." : L"Alcune app non sono state installate:\n" + errors;
    PostMessageW(g_wnd, WM_DONE, errors.empty() ? 1 : 0, 0);
    return 0;
}

static HWND label(const wchar_t *t, int x, int y, int w, int h, HFONT f) {
    HWND c = CreateWindowW(L"STATIC", t, WS_CHILD | WS_VISIBLE, S(x), S(y), S(w), S(h), g_wnd, nullptr, nullptr, nullptr);
    SendMessageW(c, WM_SETFONT, (WPARAM)f, TRUE);
    return c;
}

static LRESULT CALLBACK wndProc(HWND w, UINT m, WPARAM wp, LPARAM lp) {
    switch (m) {
    case WM_CREATE: {
        g_wnd = w;
        label(L"ClassDesk Suite", 28, 20, 440, 32, g_title);
        label((std::wstring(L"Versione ") + SUITE_VERSION + L" · scegli le app da installare o aggiornare.").c_str(), 28, 54, 440, 20, g_font);
        for (int i = 0; i < NAPPS; i++) {
            const App &a = APPS[i];
            std::wstring t = std::wstring(a.name) + (isInstalled(a) ? L"  (installata: verrà aggiornata)" : L"");
            g_check[i] = CreateWindowW(L"BUTTON", t.c_str(), WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_AUTOCHECKBOX, S(28), S(82 + i * 68), S(440), S(22), w, (HMENU)(INT_PTR)(ID_CHECK + i), nullptr, nullptr);
            SendMessageW(g_check[i], WM_SETFONT, (WPARAM)g_bold, TRUE);
            SendMessageW(g_check[i], BM_SETCHECK, BST_CHECKED, 0);
            if (a.required) EnableWindow(g_check[i], FALSE);
            label(a.desc, 48, 106 + i * 68, 420, 38, g_font);
        }
        g_progress = CreateWindowW(PROGRESS_CLASSW, nullptr, WS_CHILD | WS_VISIBLE, S(28), S(360), S(440), S(10), w, nullptr, nullptr, nullptr);
        g_status = label(L"HubDesk resta sempre installato: dopo potrai aggiungere o togliere le altre app da HubDesk.", 28, 378, 440, 44, g_font);
        g_cancel = CreateWindowW(L"BUTTON", L"Annulla", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON, S(248), S(430), S(100), S(30), w, (HMENU)ID_CANCEL, nullptr, nullptr);
        g_install = CreateWindowW(L"BUTTON", L"Installa", WS_CHILD | WS_VISIBLE | WS_TABSTOP | BS_PUSHBUTTON, S(358), S(430), S(110), S(30), w, (HMENU)ID_INSTALL, nullptr, nullptr);
        SendMessageW(g_cancel, WM_SETFONT, (WPARAM)g_font, TRUE);
        SendMessageW(g_install, WM_SETFONT, (WPARAM)g_bold, TRUE);
        if (g_check[1]) SetFocus(g_check[1]);
        return 0;
    }
    case WM_CTLCOLORSTATIC: { HDC dc = (HDC)wp; SetBkMode(dc, TRANSPARENT); return (LRESULT)GetStockObject(WHITE_BRUSH); }
    case WM_COMMAND:
        if (LOWORD(wp) == ID_INSTALL && HIWORD(wp) == BN_CLICKED && (HWND)lp == g_install && !g_busy && g_shownAt > 0 && GetTickCount64() - g_shownAt >= 400) {
            if (g_finished) {
                ShellExecuteW(nullptr, L"open", (programsDir() + APPS[0].exeName).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
                DestroyWindow(w);
                return 0;
            }
            g_busy = true;
            for (int i = 0; i < NAPPS; i++) EnableWindow(g_check[i], FALSE);
            EnableWindow(g_install, FALSE); EnableWindow(g_cancel, FALSE);
            CloseHandle(CreateThread(nullptr, 0, worker, nullptr, 0, nullptr));
        } else if (LOWORD(wp) == ID_CANCEL && HIWORD(wp) == BN_CLICKED && (HWND)lp == g_cancel && !g_busy) DestroyWindow(w);
        return 0;
    case WM_STATUS: SetWindowTextW(g_status, g_statusText.c_str()); return 0;
    case WM_DONE:
        g_busy = false; g_finished = true;
        SetWindowTextW(g_status, g_statusText.c_str());
        SetWindowTextW(g_install, L"Apri HubDesk"); EnableWindow(g_install, TRUE);
        SetWindowTextW(g_cancel, L"Chiudi"); EnableWindow(g_cancel, TRUE);
        return 0;
    case WM_CLOSE: if (g_busy) return 0; DestroyWindow(w); return 0;
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(w, m, wp, lp);
}

// ---------------------------------------------------------------- main
static bool hasArg(int argc, wchar_t **argv, const wchar_t *a) { for (int i = 1; i < argc; i++) if (_wcsicmp(argv[i], a) == 0) return true; return false; }
static std::wstring argValue(int argc, wchar_t **argv, const wchar_t *prefix) {
    size_t n = wcslen(prefix);
    for (int i = 1; i < argc; i++) if (_wcsnicmp(argv[i], prefix, n) == 0) return argv[i] + n;
    return L"";
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int) {
    int argc = 0; wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    wchar_t self[MAX_PATH]; GetModuleFileNameW(nullptr, self, MAX_PATH); g_self = self;
    bool payload = readPayload();

    if (hasArg(argc, argv, L"--list")) {
        std::string s;
        for (auto &e : g_entries) s += e.id + " " + std::to_string(e.size) + "\n";
        HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
        DWORD wr = 0;
        if (out && out != INVALID_HANDLE_VALUE && WriteFile(out, s.data(), (DWORD)s.size(), &wr, nullptr) && wr > 0)
            return payload ? 0 : 2;
        AttachConsole(ATTACH_PARENT_PROCESS);
        FILE *o = _wfopen(L"CONOUT$", L"w");
        for (auto &e : g_entries) if (o) fprintf(o, "%s %llu\n", e.id.c_str(), (unsigned long long)e.size);
        if (o) fclose(o);
        if (!o) { std::wstring t; for (auto &e : g_entries) t += widen(e.id) + L"  " + std::to_wstring(e.size / 1048576) + L" MB\n"; MessageBoxW(nullptr, t.c_str(), L"ClassDesk Suite", MB_OK); }
        return payload ? 0 : 2;
    }
    std::wstring ex = argValue(argc, argv, L"--extract=");
    if (!ex.empty()) {
        std::wstring out = argValue(argc, argv, L"--out=");
        int resId = 0;
        for (int i = 0; i < NAPPS; i++) {
            if (!_wcsicmp(APPS[i].id, ex.c_str())) { resId = APPS[i].payloadResId; break; }
        }
        return (payload || resId > 0) && !out.empty() && extractTo(ex, resId, out) ? 0 : 3;
    }
    bool hasRes = false;
    for (int i = 0; i < NAPPS; i++) {
        if (FindResourceW(nullptr, MAKEINTRESOURCEW(APPS[i].payloadResId), RT_RCDATA) ||
            FindResourceW(nullptr, MAKEINTRESOURCEW(APPS[i].payloadResId), L"PAYLOAD")) {
            hasRes = true; break;
        }
    }
    if (!payload && !hasRes) {
        MessageBoxW(nullptr, L"Il file di installazione è incompleto o danneggiato. Scaricalo di nuovo da GitHub.", L"ClassDesk Suite", MB_ICONERROR);
        return 2;
    }
    payload = payload || hasRes;
    if (hasArg(argc, argv, L"--silent") || hasArg(argc, argv, L"/S")) {
        std::wstring comps = argValue(argc, argv, L"--components=");
        std::wstring work = makeWorkDir();
        int failed = 0;
        for (int i = 0; i < NAPPS; i++) {
            const App &a = APPS[i];
            std::wstring id = a.id;
            bool want = a.required || (comps.empty() ? isInstalled(a) : (L"," + comps + L",").find(L"," + id + L",") != std::wstring::npos);
            if (!want) continue;
            if (!installOne(a, work).empty()) failed++;
        }
        RemoveDirectoryW(work.c_str());
        return failed ? 1 : 0;
    }

    HDC sdc = GetDC(nullptr); g_dpi = GetDeviceCaps(sdc, LOGPIXELSY); ReleaseDC(nullptr, sdc);
    INITCOMMONCONTROLSEX icc = {sizeof(icc), ICC_PROGRESS_CLASS | ICC_STANDARD_CLASSES};
    InitCommonControlsEx(&icc);
    NONCLIENTMETRICSW ncm = {sizeof(ncm)}; SystemParametersInfoW(SPI_GETNONCLIENTMETRICS, sizeof(ncm), &ncm, 0);
    ncm.lfMessageFont.lfHeight = -S(14); g_font = CreateFontIndirectW(&ncm.lfMessageFont);
    ncm.lfMessageFont.lfWeight = FW_SEMIBOLD; g_bold = CreateFontIndirectW(&ncm.lfMessageFont);
    ncm.lfMessageFont.lfHeight = -S(26); ncm.lfMessageFont.lfWeight = FW_BOLD; g_title = CreateFontIndirectW(&ncm.lfMessageFont);
    WNDCLASSW wc = {}; wc.lpfnWndProc = wndProc; wc.hInstance = inst; wc.lpszClassName = L"ClassDeskSuiteSetup";
    wc.hbrBackground = (HBRUSH)GetStockObject(WHITE_BRUSH); wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.hIcon = LoadIconW(inst, MAKEINTRESOURCEW(1));
    RegisterClassW(&wc);
    RECT r = {0, 0, S(496), S(476)}; AdjustWindowRect(&r, WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX, FALSE);
    HWND w = CreateWindowW(wc.lpszClassName, L"Installazione ClassDesk Suite", WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX,
                           CW_USEDEFAULT, CW_USEDEFAULT, r.right - r.left, r.bottom - r.top, nullptr, nullptr, inst, nullptr);
    ShowWindow(w, SW_SHOW);
    UpdateWindow(w);
    g_shownAt = GetTickCount64();
    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        if ((msg.message == WM_KEYDOWN || msg.message == WM_KEYUP || msg.message == WM_CHAR) && msg.wParam == VK_RETURN) continue;
        if (!IsDialogMessageW(w, &msg)) { TranslateMessage(&msg); DispatchMessageW(&msg); }
    }
    return 0;
}
