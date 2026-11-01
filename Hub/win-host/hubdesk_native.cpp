// =====================================================================================
// HubDesk for Windows, native (C++ + WebView2, like ClassDesk and StudyDesk): no Electron.
// Conceived and created by Guaira Jaramillo Nitoglia (guaira.jaramillo.nitoglia@gmail.com) – GPL-3.0
// =====================================================================================
//
// Status (StudyDesk/docs/WINDOWS_NATIVE_PLAN.md §3): window, tray, autostart, single instance, install of itself and app
// management (catalog + manager run in the page, page/hubdesk-native.js). The network engine (devices, records exchange,
// conflicts, shared board, local channel for the apps: Hub/electron/net/hub-net.js) is NOT native yet.
//
// One self-installing exe: HubDesk-<v>-win-x64.exe = this program + the page files appended (same payload format as StudyDesk:
// records [u32 len][path][u64 size][bytes], then [u64 start][u32 N]["SDAPP001"]).
//   (no arguments, not installed) installs into %LOCALAPPDATA%\Programs\hubdesk and opens it
//   --silent | /S                 installs without windows (suite installer, self-update)
//   --background                  starts in the tray only (login)
//   --uninstall [--silent]        removes program, shortcuts, autostart and registry keys (the data stay)
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#define WIN32_LEAN_AND_MEAN
#define WEBVIEW_USER_DATA_FOLDER L"HubDesk_Native_Data"

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <commctrl.h>
#include <shellapi.h>
#include <shlobj.h>
#include <shlwapi.h>
#include <tlhelp32.h>
#include <winhttp.h>
#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
#include <thread>
#include <functional>
#include <cstdint>

#include "webview.h"

#ifndef BUNDLED_APP_VERSION
#define BUNDLED_APP_VERSION L"0.0.0-000"
#endif
static const wchar_t *APP_VERSION = BUNDLED_APP_VERSION;
static const wchar_t *UNINSTALL_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\HubDesk";
static const wchar_t *RUN_KEY = L"Software\\Microsoft\\Windows\\CurrentVersion\\Run";
static const UINT WM_TRAY = WM_APP + 41;

// ---------------------------------------------------------------- helpers (same as StudyDesk/windows/native)
static std::wstring W(const std::string &s) { if (s.empty()) return L""; int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), NULL, 0); std::wstring w(n, 0); MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], n); return w; }
static std::string U(const std::wstring &w) { if (w.empty()) return ""; int n = WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), NULL, 0, NULL, NULL); std::string s(n, 0); WideCharToMultiByte(CP_UTF8, 0, w.c_str(), (int)w.size(), &s[0], n, NULL, NULL); return s; }
static std::string Esc(const std::string &s) {
    std::ostringstream o;
    for (char c : s) { if (c == '"') o << "\\\""; else if (c == '\\') o << "\\\\"; else if (c == '\n') o << "\\n"; else if (c == '\r') o << "\\r"; else if (c == '\t') o << "\\t"; else if ((unsigned char)c < 0x20) { char b[8]; snprintf(b, sizeof(b), "\\u%04x", (unsigned char)c); o << b; } else o << c; }
    return o.str();
}
static std::string Q(const std::string &s) { return "\"" + Esc(s) + "\""; }
static std::string Arg(const std::string &a, size_t index) { // string argument of the bridge's JSON array
    size_t pos = 0, cur = 0;
    while (pos < a.size()) {
        size_t q = a.find('"', pos); if (q == std::string::npos) break;
        std::string out; size_t i = q + 1;
        while (i < a.size()) {
            if (a[i] == '\\' && i + 1 < a.size()) {
                char n = a[i + 1];
                if (n == 'n') out += '\n'; else if (n == 'r') out += '\r'; else if (n == 't') out += '\t';
                else if (n == 'u' && i + 5 < a.size()) { out += U(std::wstring(1, (wchar_t)strtoul(a.substr(i + 2, 4).c_str(), nullptr, 16))); i += 6; continue; }
                else out += n;
                i += 2;
            } else if (a[i] == '"') break; else out += a[i++];
        }
        if (cur == index) return out;
        cur++; pos = i + 1;
    }
    return "";
}
static bool Exists(const std::wstring &p) { return GetFileAttributesW(p.c_str()) != INVALID_FILE_ATTRIBUTES; }
static std::wstring KnownDir(int csidl) { wchar_t p[MAX_PATH] = L"C:\\"; SHGetFolderPathW(NULL, csidl, NULL, 0, p); return p; }
static std::wstring InstallDir() { return KnownDir(CSIDL_LOCAL_APPDATA) + L"\\Programs\\hubdesk"; }
static std::wstring InstalledExe() { return InstallDir() + L"\\HubDesk.exe"; }
static std::wstring AppDir() { return InstallDir() + L"\\app"; }
static std::wstring StateFile() { return KnownDir(CSIDL_APPDATA) + L"\\HubDesk\\hubdesk-state.json"; }   // same file as the Electron HubDesk
static std::wstring HubSettings() { return KnownDir(CSIDL_APPDATA) + L"\\DeskHub\\settings.json"; }
static void MakeDirs(const std::wstring &d) { SHCreateDirectoryExW(NULL, d.c_str(), NULL); }
static void DeleteTree(const std::wstring &path) {
    if (path.size() < 8 || !Exists(path)) return;
    WIN32_FIND_DATAW fd; HANDLE h = FindFirstFileW((path + L"\\*").c_str(), &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do { if (!wcscmp(fd.cFileName, L".") || !wcscmp(fd.cFileName, L"..")) continue; std::wstring p = path + L"\\" + fd.cFileName;
             if (fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) DeleteTree(p); else { SetFileAttributesW(p.c_str(), FILE_ATTRIBUTE_NORMAL); DeleteFileW(p.c_str()); } } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    RemoveDirectoryW(path.c_str());
}
static bool ReadWhole(const std::wstring &p, std::string &out) {
    HANDLE h = CreateFileW(p.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, NULL, OPEN_EXISTING, 0, NULL);
    if (h == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz; GetFileSizeEx(h, &sz); out.assign((size_t)sz.QuadPart, 0); DWORD rd = 0;
    bool ok = sz.QuadPart == 0 || (ReadFile(h, &out[0], (DWORD)sz.QuadPart, &rd, NULL) && rd == (DWORD)sz.QuadPart);
    CloseHandle(h); return ok;
}
static bool WriteAtomic(const std::wstring &target, const std::string &content) {
    MakeDirs(target.substr(0, target.find_last_of(L'\\')));
    std::wstring tmp = target + L"." + std::to_wstring(GetCurrentProcessId()) + L".tmp";
    HANDLE h = CreateFileW(tmp.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL);
    if (h == INVALID_HANDLE_VALUE) return false;
    DWORD wr = 0; bool ok = WriteFile(h, content.data(), (DWORD)content.size(), &wr, NULL) && wr == content.size(); CloseHandle(h);
    if (!ok || !MoveFileExW(tmp.c_str(), target.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH)) { DeleteFileW(tmp.c_str()); return false; }
    return true;
}
static std::vector<DWORD> PidsOf(const std::wstring &exe) {
    std::vector<DWORD> out; DWORD me = GetCurrentProcessId();
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0); if (snap == INVALID_HANDLE_VALUE) return out;
    PROCESSENTRY32W pe; pe.dwSize = sizeof(pe);
    for (BOOL ok = Process32FirstW(snap, &pe); ok; ok = Process32NextW(snap, &pe)) if (!_wcsicmp(pe.szExeFile, exe.c_str()) && pe.th32ProcessID != me) out.push_back(pe.th32ProcessID);
    CloseHandle(snap); return out;
}
static BOOL CALLBACK CloseWindowsOf(HWND w, LPARAM pid) { DWORD p = 0; GetWindowThreadProcessId(w, &p); if (p == (DWORD)pid) PostMessageW(w, WM_CLOSE, 0, 0); return TRUE; }
static void CloseApp(const std::wstring &exe) { // windows first (the app saves), then forced after 8 s
    auto pids = PidsOf(exe); if (pids.empty()) return;
    for (DWORD p : pids) EnumWindows(CloseWindowsOf, (LPARAM)p);
    for (int i = 0; i < 80 && !PidsOf(exe).empty(); i++) Sleep(100);
    for (DWORD p : PidsOf(exe)) { HANDLE h = OpenProcess(PROCESS_TERMINATE | SYNCHRONIZE, FALSE, p); if (h) { TerminateProcess(h, 0); WaitForSingleObject(h, 2000); CloseHandle(h); } }
}
static std::wstring CmdLine(const std::wstring &file, const std::vector<std::string> &args) {
    std::wstring c = L"\"" + file + L"\""; for (auto &a : args) c += L" \"" + W(a) + L"\""; return c;
}
static DWORD RunWait(const std::wstring &file, const std::vector<std::string> &args) {
    std::wstring cmd = CmdLine(file, args); STARTUPINFOW si = {sizeof(si)}; PROCESS_INFORMATION pi = {};
    if (!CreateProcessW(NULL, &cmd[0], NULL, NULL, FALSE, CREATE_NO_WINDOW, NULL, NULL, &si, &pi)) return 9999;
    WaitForSingleObject(pi.hProcess, 15 * 60 * 1000); DWORD code = 1; GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess); return code;
}
static bool RunDetached(const std::wstring &file, const std::vector<std::string> &args) {
    std::wstring cmd = CmdLine(file, args); STARTUPINFOW si = {sizeof(si)}; PROCESS_INFORMATION pi = {};
    if (!CreateProcessW(NULL, &cmd[0], NULL, NULL, FALSE, CREATE_NO_WINDOW | DETACHED_PROCESS, NULL, NULL, &si, &pi)) return false;
    CloseHandle(pi.hThread); CloseHandle(pi.hProcess); return true;
}
static std::wstring RegString(HKEY root, const std::wstring &key, const wchar_t *name) {
    wchar_t buf[512]; DWORD sz = sizeof(buf);
    return RegGetValueW(root, key.c_str(), name, RRF_RT_REG_SZ, NULL, buf, &sz) == ERROR_SUCCESS ? std::wstring(buf) : L"";
}
/** DisplayVersion of an app: key `keyName` if given, otherwise the Uninstall key whose DisplayName is name or "name <version>". */
static std::wstring AppVersion(const std::wstring &keyName, const std::wstring &name) {
    const std::wstring base = L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall";
    if (!keyName.empty()) return RegString(HKEY_CURRENT_USER, base + L"\\" + keyName, L"DisplayVersion");
    HKEY k; if (RegOpenKeyExW(HKEY_CURRENT_USER, base.c_str(), 0, KEY_READ, &k) != ERROR_SUCCESS) return L"";
    std::wstring found; wchar_t sub[256];
    for (DWORD i = 0;; i++) {
        DWORD len = 256; if (RegEnumKeyExW(k, i, sub, &len, NULL, NULL, NULL, NULL) != ERROR_SUCCESS) break;
        std::wstring dn = RegString(HKEY_CURRENT_USER, base + L"\\" + sub, L"DisplayName");
        if (!_wcsicmp(dn.c_str(), name.c_str()) || (dn.size() > name.size() && !_wcsnicmp(dn.c_str(), (name + L" ").c_str(), name.size() + 1))) {
            found = RegString(HKEY_CURRENT_USER, base + L"\\" + sub, L"DisplayVersion"); if (!found.empty()) break;
        }
    }
    RegCloseKey(k); return found;
}

// ---------------------------------------------------------------- HTTP (WinHTTP: GitHub API, release assets; redirects followed)
static bool Http(const std::string &url, std::string *body, const std::wstring *file, const std::function<void(double)> &progress) {
    std::wstring wurl = W(url); URL_COMPONENTS uc = {sizeof(uc)}; wchar_t host[256], path[2048];
    uc.lpszHostName = host; uc.dwHostNameLength = 256; uc.lpszUrlPath = path; uc.dwUrlPathLength = 2048;
    if (!WinHttpCrackUrl(wurl.c_str(), 0, 0, &uc)) return false;
    HINTERNET s = WinHttpOpen(L"HubDesk", WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0);
    if (!s) return false;
    HINTERNET c = WinHttpConnect(s, host, uc.nPort, 0);
    HINTERNET r = c ? WinHttpOpenRequest(c, L"GET", path, NULL, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, uc.nScheme == INTERNET_SCHEME_HTTPS ? WINHTTP_FLAG_SECURE : 0) : NULL;
    bool ok = false; HANDLE out = INVALID_HANDLE_VALUE;
    if (r && WinHttpSendRequest(r, L"Accept: application/vnd.github+json\r\n", (DWORD)-1L, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) && WinHttpReceiveResponse(r, NULL)) {
        DWORD status = 0, sz = sizeof(status);
        WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, NULL, &status, &sz, NULL);
        DWORD64 total = 0; wchar_t lenBuf[32]; DWORD lb = sizeof(lenBuf);
        if (WinHttpQueryHeaders(r, WINHTTP_QUERY_CONTENT_LENGTH, NULL, lenBuf, &lb, NULL)) total = _wcstoui64(lenBuf, NULL, 10);
        if (status == 200) {
            if (file) { MakeDirs(file->substr(0, file->find_last_of(L'\\'))); out = CreateFileW(file->c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL); }
            ok = !file || out != INVALID_HANDLE_VALUE;
            std::vector<char> buf(1 << 16); DWORD64 got = 0; DWORD n = 0;
            while (ok && WinHttpReadData(r, buf.data(), (DWORD)buf.size(), &n) && n > 0) {
                if (file) { DWORD wr; if (!WriteFile(out, buf.data(), n, &wr, NULL)) ok = false; } else body->append(buf.data(), n);
                got += n; if (total && progress) progress((double)got / (double)total);
            }
        }
    }
    if (out != INVALID_HANDLE_VALUE) { CloseHandle(out); if (!ok) DeleteFileW(file->c_str()); }
    if (r) WinHttpCloseHandle(r); if (c) WinHttpCloseHandle(c); WinHttpCloseHandle(s);
    return ok;
}

// ---------------------------------------------------------------- TCP for the network engine in the page (engine port: plan §3)
// __hd_tcp_listen(port, loopbackOnly) -> {"id","port"}; __hd_tcp_connect(host, port) -> id (-1 on error);
// __hd_tcp_send(id, text); __hd_tcp_close(id). Events: window.__hd_tcp_on({ev:'conn'|'data'|'close', id, server?, text?, addr?}).
#include <map>
#include <mutex>
static std::mutex g_tcpLock;
static std::map<int, SOCKET> g_socks;
static int g_tcpSeq = 0;
static void TcpEvent(const std::string &json);
static int TcpAdd(SOCKET s) { std::lock_guard<std::mutex> l(g_tcpLock); int id = ++g_tcpSeq; g_socks[id] = s; return id; }
static SOCKET TcpGet(int id) { std::lock_guard<std::mutex> l(g_tcpLock); auto it = g_socks.find(id); return it == g_socks.end() ? INVALID_SOCKET : it->second; }
static void TcpDrop(int id) { std::lock_guard<std::mutex> l(g_tcpLock); auto it = g_socks.find(id); if (it != g_socks.end()) { closesocket(it->second); g_socks.erase(it); } }
static void TcpReader(int id) {
    std::thread([id]() {
        char buf[16384];
        for (;;) {
            SOCKET s = TcpGet(id); if (s == INVALID_SOCKET) break;
            int n = recv(s, buf, sizeof(buf), 0); if (n <= 0) break;
            TcpEvent("{\"ev\":\"data\",\"id\":" + std::to_string(id) + ",\"text\":" + Q(std::string(buf, n)) + "}");
        }
        TcpDrop(id);
        TcpEvent("{\"ev\":\"close\",\"id\":" + std::to_string(id) + "}");
    }).detach();
}
static std::string TcpListen(int port, bool loopback) {
    SOCKET s = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP); if (s == INVALID_SOCKET) return "null";
    sockaddr_in a = {}; a.sin_family = AF_INET; a.sin_port = htons((u_short)port); a.sin_addr.s_addr = htonl(loopback ? INADDR_LOOPBACK : INADDR_ANY);
    if (bind(s, (sockaddr *)&a, sizeof(a)) != 0 || listen(s, 16) != 0) { closesocket(s); return "null"; }
    int len = sizeof(a); getsockname(s, (sockaddr *)&a, &len);
    int sid = TcpAdd(s), real = ntohs(a.sin_port);
    std::thread([sid]() {
        for (;;) {
            SOCKET srv = TcpGet(sid); if (srv == INVALID_SOCKET) break;
            sockaddr_in peer = {}; int pl = sizeof(peer);
            SOCKET c = accept(srv, (sockaddr *)&peer, &pl); if (c == INVALID_SOCKET) break;
            char ip[64] = {0}; inet_ntop(AF_INET, &peer.sin_addr, ip, sizeof(ip));
            int cid = TcpAdd(c);
            TcpEvent("{\"ev\":\"conn\",\"id\":" + std::to_string(cid) + ",\"server\":" + std::to_string(sid) + ",\"addr\":" + Q(ip) + "}");
            TcpReader(cid);
        }
    }).detach();
    return "{\"id\":" + std::to_string(sid) + ",\"port\":" + std::to_string(real) + "}";
}
static int TcpConnect(const std::string &host, int port) {
    addrinfo hints = {}, *res = nullptr; hints.ai_family = AF_INET; hints.ai_socktype = SOCK_STREAM;
    if (getaddrinfo(host.c_str(), std::to_string(port).c_str(), &hints, &res) != 0 || !res) return -1;
    SOCKET s = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    bool ok = s != INVALID_SOCKET && connect(s, res->ai_addr, (int)res->ai_addrlen) == 0;
    freeaddrinfo(res);
    if (!ok) { if (s != INVALID_SOCKET) closesocket(s); return -1; }
    int id = TcpAdd(s); TcpReader(id); return id;
}
static bool TcpSend(int id, const std::string &text) {
    SOCKET s = TcpGet(id); if (s == INVALID_SOCKET) return false;
    size_t sent = 0; while (sent < text.size()) { int n = send(s, text.data() + sent, (int)(text.size() - sent), 0); if (n <= 0) return false; sent += n; }
    return true;
}

// ---------------------------------------------------------------- payload (page files)
static bool ExtractApp(const std::wstring &exe, const std::wstring &dir) {
    HANDLE f = CreateFileW(exe.c_str(), GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (f == INVALID_HANDLE_VALUE) return false;
    LARGE_INTEGER sz; GetFileSizeEx(f, &sz); char tail[20]; DWORD rd = 0; LARGE_INTEGER p; p.QuadPart = sz.QuadPart - 20;
    bool ok = sz.QuadPart > 20 && SetFilePointerEx(f, p, NULL, FILE_BEGIN) && ReadFile(f, tail, 20, &rd, NULL) && rd == 20 && !memcmp(tail + 12, "SDAPP001", 8);
    std::wstring tmp = dir + L".new";
    if (ok) {
        uint64_t start; uint32_t n; memcpy(&start, tail, 8); memcpy(&n, tail + 8, 4);
        DeleteTree(tmp); MakeDirs(tmp);
        p.QuadPart = (LONGLONG)start; SetFilePointerEx(f, p, NULL, FILE_BEGIN);
        std::vector<char> buf(1 << 20);
        for (uint32_t i = 0; ok && i < n; i++) {
            uint32_t len = 0; ReadFile(f, &len, 4, &rd, NULL); if (len == 0 || len > 4096) { ok = false; break; }
            std::string rel(len, 0); ReadFile(f, &rel[0], len, &rd, NULL); uint64_t size = 0; ReadFile(f, &size, 8, &rd, NULL);
            if (rel.find("..") != std::string::npos) { ok = false; break; }
            std::wstring t = tmp + L"\\" + W(rel); std::replace(t.begin(), t.end(), L'/', L'\\'); MakeDirs(t.substr(0, t.find_last_of(L'\\')));
            HANDLE o = CreateFileW(t.c_str(), GENERIC_WRITE, 0, NULL, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, NULL); if (o == INVALID_HANDLE_VALUE) { ok = false; break; }
            while (size > 0) { DWORD want = (DWORD)std::min<uint64_t>(size, buf.size()), wr; if (!ReadFile(f, buf.data(), want, &rd, NULL) || rd != want) { ok = false; break; } WriteFile(o, buf.data(), rd, &wr, NULL); size -= rd; }
            CloseHandle(o);
        }
    }
    CloseHandle(f);
    if (!ok) { DeleteTree(tmp); return false; }
    DeleteTree(dir); return MoveFileW(tmp.c_str(), dir.c_str()) != 0;
}

// ---------------------------------------------------------------- install / uninstall
static void SetAutostart(bool on) {
    HKEY k; if (RegOpenKeyExW(HKEY_CURRENT_USER, RUN_KEY, 0, KEY_WRITE, &k) != ERROR_SUCCESS) return;
    if (on) { std::wstring v = L"\"" + InstalledExe() + L"\" --background"; RegSetValueExW(k, L"HubDesk", 0, REG_SZ, (const BYTE *)v.c_str(), (DWORD)((v.size() + 1) * 2)); }
    else RegDeleteValueW(k, L"HubDesk");
    RegCloseKey(k);
}
static void Shortcut(const std::wstring &target, const std::wstring &link) {
    IShellLinkW *psl = NULL;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, NULL, CLSCTX_INPROC_SERVER, IID_IShellLinkW, (LPVOID *)&psl))) {
        psl->SetPath(target.c_str()); psl->SetIconLocation(target.c_str(), 0);
        IPersistFile *ppf = NULL; if (SUCCEEDED(psl->QueryInterface(IID_IPersistFile, (LPVOID *)&ppf))) { ppf->Save(link.c_str(), TRUE); ppf->Release(); }
        psl->Release();
    }
}
static int Install(const std::wstring &self, bool silent) {
    CloseApp(L"HubDesk.exe");
    std::wstring nsis = InstallDir() + L"\\Uninstall HubDesk.exe"; // Electron HubDesk in the same folder: its data stay
    if (Exists(nsis)) { RunWait(nsis, {"/S", "--updated"}); for (int i = 0; i < 100 && Exists(InstallDir() + L"\\resources\\app.asar"); i++) Sleep(200); }
    MakeDirs(InstallDir());
    if (_wcsicmp(self.c_str(), InstalledExe().c_str()) != 0) {
        std::wstring tmp = InstalledExe() + L".new";
        if (!CopyFileW(self.c_str(), tmp.c_str(), FALSE)) return 2;
        DeleteFileW(InstalledExe().c_str()); MoveFileW(tmp.c_str(), InstalledExe().c_str());
    }
    if (!ExtractApp(InstalledExe(), AppDir())) return 3;
    HKEY k;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, UNINSTALL_KEY, 0, NULL, 0, KEY_WRITE, NULL, &k, NULL) == ERROR_SUCCESS) {
        auto S = [&](const wchar_t *n, const std::wstring &v) { RegSetValueExW(k, n, 0, REG_SZ, (const BYTE *)v.c_str(), (DWORD)((v.size() + 1) * 2)); };
        S(L"DisplayName", L"HubDesk"); S(L"DisplayVersion", APP_VERSION); S(L"Publisher", L"Guaira Jaramillo Nitoglia"); S(L"DisplayIcon", InstalledExe());
        S(L"InstallLocation", InstallDir()); S(L"UninstallString", L"\"" + InstalledExe() + L"\" --uninstall");
        DWORD one = 1; RegSetValueExW(k, L"NoModify", 0, REG_DWORD, (const BYTE *)&one, 4); RegSetValueExW(k, L"NoRepair", 0, REG_DWORD, (const BYTE *)&one, 4);
        RegCloseKey(k);
    }
    SetAutostart(true);
    CoInitializeEx(NULL, COINIT_APARTMENTTHREADED);
    Shortcut(InstalledExe(), KnownDir(CSIDL_PROGRAMS) + L"\\HubDesk.lnk");
    RunDetached(InstalledExe(), silent ? std::vector<std::string>{"--background"} : std::vector<std::string>{});
    return 0;
}
static int Uninstall(bool silent) {
    CloseApp(L"HubDesk.exe"); SetAutostart(false);
    DeleteFileW((KnownDir(CSIDL_PROGRAMS) + L"\\HubDesk.lnk").c_str());
    RegDeleteTreeW(HKEY_CURRENT_USER, UNINSTALL_KEY);
    DeleteTree(AppDir());
    wchar_t sys[MAX_PATH]; GetSystemDirectoryW(sys, MAX_PATH); SetCurrentDirectoryW(sys);
    RunDetached(std::wstring(sys) + L"\\cmd.exe", {"/c", "ping -n 4 127.0.0.1 >nul & rmdir /s /q \"" + U(InstallDir()) + "\""});
    if (!silent) MessageBoxW(NULL, L"HubDesk è stato disinstallato. I dati sono stati conservati.", L"HubDesk", MB_OK | MB_ICONINFORMATION);
    return 0;
}

// ---------------------------------------------------------------- window + tray
static HWND g_hwnd = NULL;
static webview::webview *g_view = nullptr;
static NOTIFYICONDATAW g_tray = {};
static bool g_quitting = false;
static void TcpEvent(const std::string &json) {
    if (!g_view) return;
    std::string js = "window.__hd_tcp_on && window.__hd_tcp_on(" + json + ")";
    g_view->dispatch([js]() { if (g_view) g_view->eval(js); });
}
static void ShowMain(const char *page) {
    if (!g_hwnd) return;
    ShowWindow(g_hwnd, SW_SHOW); ShowWindow(g_hwnd, SW_RESTORE); SetForegroundWindow(g_hwnd);
    if (page && g_view) { std::string js = std::string("window.__hd_nav && window.__hd_nav('") + page + "')"; g_view->eval(js); }
}
static void Quit() { g_quitting = true; Shell_NotifyIconW(NIM_DELETE, &g_tray); if (g_view) g_view->terminate(); }
static LRESULT CALLBACK WndSub(HWND h, UINT m, WPARAM wp, LPARAM lp, UINT_PTR, DWORD_PTR) {
    if (m == WM_CLOSE && !g_quitting) { ShowWindow(h, SW_HIDE); return 0; }          // closing the window keeps HubDesk in the tray
    if (m == WM_TRAY && (LOWORD(lp) == WM_LBUTTONUP)) { ShowMain("apps"); return 0; }
    if (m == WM_TRAY && (LOWORD(lp) == WM_RBUTTONUP || LOWORD(lp) == WM_CONTEXTMENU)) {
        HMENU menu = CreatePopupMenu();
        AppendMenuW(menu, MF_STRING, 1, L"Apri HubDesk"); AppendMenuW(menu, MF_STRING, 2, L"ClassDesk"); AppendMenuW(menu, MF_STRING, 3, L"StudyDesk");
        AppendMenuW(menu, MF_SEPARATOR, 0, NULL); AppendMenuW(menu, MF_STRING, 9, L"Esci da HubDesk");
        POINT pt; GetCursorPos(&pt); SetForegroundWindow(h);
        int cmd = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_RIGHTBUTTON, pt.x, pt.y, 0, h, NULL); DestroyMenu(menu);
        std::wstring progs = KnownDir(CSIDL_LOCAL_APPDATA) + L"\\Programs\\";
        if (cmd == 1) ShowMain("apps");
        else if (cmd == 2) ShellExecuteW(NULL, L"open", (progs + L"ClassDesk\\ClassDesk.exe").c_str(), NULL, NULL, SW_SHOWNORMAL);
        else if (cmd == 3) ShellExecuteW(NULL, L"open", (progs + L"studydesk\\StudyDesk.exe").c_str(), NULL, NULL, SW_SHOWNORMAL);
        else if (cmd == 9) Quit();
        return 0;
    }
    if (m == WM_COPYDATA) { ShowMain("apps"); return TRUE; }                          // another HubDesk started: show this one
    return DefSubclassProc(h, m, wp, lp);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int) {
    int argc = 0; wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    auto has = [&](const wchar_t *a) { for (int i = 1; i < argc; i++) if (!_wcsicmp(argv[i], a)) return true; return false; };
    bool silent = has(L"--silent") || has(L"/S"), background = has(L"--background");
    wchar_t selfBuf[MAX_PATH]; GetModuleFileNameW(NULL, selfBuf, MAX_PATH); std::wstring self = selfBuf;
    if (has(L"--uninstall")) return Uninstall(silent);
    if (_wcsicmp(self.c_str(), InstalledExe().c_str()) != 0 || silent || has(L"--install")) return Install(self, silent);

    HANDLE mutex = CreateMutexW(NULL, TRUE, L"Local\\ClassDeskSuite.HubDesk");
    if (GetLastError() == ERROR_ALREADY_EXISTS) { // one HubDesk only: bring the running one forward
        HWND other = FindWindowW(NULL, L"HubDesk");
        if (other && !background) { COPYDATASTRUCT cd = {1, 0, NULL}; SendMessageW(other, WM_COPYDATA, 0, (LPARAM)&cd); }
        return 0;
    }
    OleInitialize(NULL);
    if (!Exists(AppDir() + L"\\renderer\\index.html") && !ExtractApp(self, AppDir())) { MessageBoxW(NULL, L"I file di HubDesk mancano: reinstalla HubDesk.", L"HubDesk", MB_ICONERROR); return 3; }

    webview::webview w(false, nullptr);
    g_view = &w; g_hwnd = (HWND)w.window();
    w.set_title("HubDesk"); w.set_size(1080, 720, WEBVIEW_HINT_NONE); w.set_size(820, 560, WEBVIEW_HINT_MIN);
    HICON ic = LoadIconW(inst, MAKEINTRESOURCEW(1));
    if (g_hwnd) {
        RECT rc; GetWindowRect(g_hwnd, &rc);
        SetWindowPos(g_hwnd, NULL, (GetSystemMetrics(SM_CXSCREEN) - (rc.right - rc.left)) / 2, (GetSystemMetrics(SM_CYSCREEN) - (rc.bottom - rc.top)) / 2, 0, 0, SWP_NOSIZE | SWP_NOZORDER);
        if (ic) { SendMessageW(g_hwnd, WM_SETICON, ICON_BIG, (LPARAM)ic); SendMessageW(g_hwnd, WM_SETICON, ICON_SMALL, (LPARAM)ic); }
        SetWindowSubclass(g_hwnd, WndSub, 1, 0);
        g_tray.cbSize = sizeof(g_tray); g_tray.hWnd = g_hwnd; g_tray.uID = 1; g_tray.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
        g_tray.uCallbackMessage = WM_TRAY; g_tray.hIcon = ic; wcscpy(g_tray.szTip, L"HubDesk");
        Shell_NotifyIconW(NIM_ADD, &g_tray);
        if (background) ShowWindow(g_hwnd, SW_HIDE);
    }
    if (ICoreWebView2 *core = w.core_webview()) {
        ICoreWebView2_3 *c3 = nullptr;
        if (SUCCEEDED(core->QueryInterface(IID_ICoreWebView2_3, (void **)&c3)) && c3) { c3->SetVirtualHostNameToFolderMapping(L"hubdesk.app", AppDir().c_str(), COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW); c3->Release(); }
    }

    // ---- bridges for page/hubdesk-native.js
    w.bind("__hd_programs", [](std::string) -> std::string { return Q(U(KnownDir(CSIDL_LOCAL_APPDATA) + L"\\Programs")); });
    w.bind("__hd_temp", [](std::string) -> std::string { wchar_t t[MAX_PATH]; GetTempPathW(MAX_PATH, t); std::wstring s = t; if (!s.empty() && s.back() == L'\\') s.pop_back(); return Q(U(s)); });
    w.bind("__hd_exists", [](std::string r) -> std::string { return Exists(W(Arg(r, 0))) ? "true" : "false"; });
    w.bind("__hd_app_version", [](std::string r) -> std::string { return Q(U(AppVersion(W(Arg(r, 0)), W(Arg(r, 1))))); });
    w.bind("__hd_running", [](std::string r) -> std::string { return PidsOf(W(Arg(r, 0))).empty() ? "false" : "true"; });
    w.bind("__hd_close_app", [&w](const std::string &seq, const std::string &r, void *) { std::wstring exe = W(Arg(r, 0)); std::thread([&w, seq, exe]() { CloseApp(exe); w.resolve(seq, 0, "true"); }).detach(); }, nullptr);
    w.bind("__hd_run", [&w](const std::string &seq, const std::string &r, void *) {
        std::wstring file = W(Arg(r, 0)); std::string argsJson = Arg(r, 1);
        std::thread([&w, seq, file, argsJson]() {
            std::vector<std::string> args; for (size_t i = 0;; i++) { size_t n = 0; std::string a = Arg(argsJson, i); for (char c : argsJson) n += c == '"'; if (i * 2 >= n) break; args.push_back(a); }
            w.resolve(seq, 0, std::to_string(RunWait(file, args)));
        }).detach();
    }, nullptr);
    w.bind("__hd_run_detached", [](std::string r) -> std::string {
        std::string argsJson = Arg(r, 1); std::vector<std::string> args; size_t n = 0; for (char c : argsJson) n += c == '"';
        for (size_t i = 0; i * 2 < n; i++) args.push_back(Arg(argsJson, i));
        return RunDetached(W(Arg(r, 0)), args) ? "true" : "false";
    });
    w.bind("__hd_open", [](std::string r) -> std::string { ShellExecuteW(NULL, L"open", W(Arg(r, 0)).c_str(), NULL, NULL, SW_SHOWNORMAL); return "true"; });
    w.bind("__hd_open_external", [](std::string r) -> std::string { std::string u = Arg(r, 0); if (u.rfind("https://", 0) == 0 || u.rfind("mailto:", 0) == 0) ShellExecuteW(NULL, L"open", W(u).c_str(), NULL, NULL, SW_SHOWNORMAL); return "true"; });
    w.bind("__hd_http_get", [&w](const std::string &seq, const std::string &r, void *) {
        std::string url = Arg(r, 0);
        std::thread([&w, seq, url]() { std::string body; bool ok = url.rfind("https://", 0) == 0 && Http(url, &body, nullptr, nullptr); w.resolve(seq, 0, ok ? Q(body) : "null"); }).detach();
    }, nullptr);
    w.bind("__hd_download", [&w](const std::string &seq, const std::string &r, void *) {
        std::string url = Arg(r, 0), id = Arg(r, 2); std::wstring file = W(Arg(r, 1));
        std::thread([&w, seq, url, file, id]() {
            int last = -1;
            bool ok = url.rfind("https://github.com/", 0) == 0 && Http(url, nullptr, &file, [&](double p) {
                int pc = (int)(p * 100); if (pc == last) return; last = pc;
                std::string js = "window.__hd_progress && window.__hd_progress(" + Q(id) + "," + std::to_string(p) + ")";
                w.dispatch([&w, js]() { w.eval(js); });
            });
            w.resolve(seq, 0, ok ? "true" : "false");
        }).detach();
    }, nullptr);
    w.bind("__hd_rm", [](std::string r) -> std::string { std::wstring p = W(Arg(r, 0)); wchar_t t[MAX_PATH]; GetTempPathW(MAX_PATH, t); if (p.rfind(t, 0) == 0) DeleteTree(p); return "true"; });
    w.bind("__hd_quit", [](std::string) -> std::string { Quit(); return "true"; });
    w.bind("__hd_state_read", [](std::string) -> std::string { std::string t; return ReadWhole(StateFile(), t) ? Q(t) : "null"; });
    w.bind("__hd_state_write", [](std::string r) -> std::string { return WriteAtomic(StateFile(), Arg(r, 0)) ? "true" : "false"; });
    w.bind("__hd_settings_read", [](std::string) -> std::string { std::string t; return ReadWhole(HubSettings(), t) ? Q(t) : "null"; });
    w.bind("__hd_settings_write", [](std::string r) -> std::string { return WriteAtomic(HubSettings(), Arg(r, 0)) ? "true" : "false"; });
    WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa);
    w.bind("__hd_tcp_listen", [](std::string r) -> std::string { return TcpListen(atoi(Arg(r, 0).c_str()), Arg(r, 1) == "1"); });
    w.bind("__hd_tcp_connect", [&w](const std::string &seq, const std::string &r, void *) {
        std::string host = Arg(r, 0); int port = atoi(Arg(r, 1).c_str());
        std::thread([&w, seq, host, port]() { w.resolve(seq, 0, std::to_string(TcpConnect(host, port))); }).detach();
    }, nullptr);
    w.bind("__hd_tcp_send", [](std::string r) -> std::string { return TcpSend(atoi(Arg(r, 0).c_str()), Arg(r, 1)) ? "true" : "false"; });
    w.bind("__hd_tcp_close", [](std::string r) -> std::string { TcpDrop(atoi(Arg(r, 0).c_str())); return "true"; });
    w.bind("__hd_autostart", [](std::string r) -> std::string { SetAutostart(Arg(r, 0) == "1"); return "true"; });

    std::string page; ReadWhole(AppDir() + L"\\page\\hubdesk-native.js", page);
    w.init("window.__hd_info = { version: " + Q(U(APP_VERSION)) + " };\n" + page);
    w.navigate("https://hubdesk.app/renderer/index.html");
    w.run();
    Shell_NotifyIconW(NIM_DELETE, &g_tray);
    if (mutex) CloseHandle(mutex);
    return 0;
}
