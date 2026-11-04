package com.guairajaramillo.studydesk;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * HubDeskSyncClient — implements the Classroom Tools / HubDesk synchronization protocol
 * over local Wi-Fi (_deskhub._tcp). Allows Android smartphones to discover computers,
 * download books (.sdbook / bookchunk), and synchronize student progress.
 *
 * Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0).
 */
public class HubDeskSyncClient {
    private static final String TAG = "HubDeskSyncClient";
    private static final String SERVICE_TYPE = "_deskhub._tcp.";
    private static final int PROTO_VERSION = 2;

    private final Context context;
    private final NsdManager nsdManager;
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private NsdManager.DiscoveryListener discoveryListener;
    private WifiManager.MulticastLock multicastLock;
    private boolean isDiscovering = false;

    // Queue for serializing NsdManager resolves (avoids FAILURE_ALREADY_ACTIVE error code 3)
    private final Queue<NsdServiceInfo> resolveQueue = new ArrayDeque<>();
    private boolean isResolving = false;

    // Persistent Socket connection & Request Multiplexing
    private Socket activeSocket = null;
    private String activeHost = null;
    private int activePort = 0;
    private BufferedReader activeReader = null;
    private PrintWriter activeWriter = null;
    private Thread readerThread = null;
    private volatile boolean isConnected = false;

    private final AtomicInteger nextReqId = new AtomicInteger(10);
    private final ConcurrentHashMap<Integer, CompletableFuture<JSONObject>> pendingRequests = new ConcurrentHashMap<>();

    public interface DiscoveryCallback {
        void onPeerFound(String name, String host, int port);
        void onPeerLost(String name);
    }

    public interface SyncProgressCallback {
        void onProgress(String status, int current, int total);
        void onComplete(boolean success, String message, String resultJson);
    }

    public interface ComputerBooksCallback {
        void onBooksReceived(List<JSONObject> books);
        void onError(String message);
    }

    public interface BookDownloadCallback {
        void onProgress(int percent, long downloadedBytes, long totalBytes, String status);
        void onSuccess(String fileName, String bookTitle);
        void onError(String message);
    }

    public HubDeskSyncClient(Context context) {
        this.context = context.getApplicationContext();
        this.nsdManager = (NsdManager) this.context.getSystemService(Context.NSD_SERVICE);
    }

    /** Discovers HubDesk instances on local Wi-Fi via mDNS */
    public void startDiscovery(final DiscoveryCallback callback) {
        if (isDiscovering || nsdManager == null) return;

        // Acquire Wi-Fi Multicast Lock so Android doesn't filter/drop mDNS announcements
        try {
            WifiManager wifi = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                multicastLock = wifi.createMulticastLock("StudyDeskNsdLock");
                multicastLock.setReferenceCounted(false);
                multicastLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire MulticastLock", e);
        }

        discoveryListener = new NsdManager.DiscoveryListener() {
            @Override
            public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                Log.e(TAG, "Discovery failed to start: " + errorCode);
                isDiscovering = false;
            }

            @Override
            public void onStopDiscoveryFailed(String serviceType, int errorCode) {
                isDiscovering = false;
            }

            @Override
            public void onDiscoveryStarted(String serviceType) {
                isDiscovering = true;
                Log.d(TAG, "Discovery started for " + serviceType);
            }

            @Override
            public void onDiscoveryStopped(String serviceType) {
                isDiscovering = false;
            }

            @Override
            public void onServiceFound(NsdServiceInfo serviceInfo) {
                Log.d(TAG, "Service found: " + serviceInfo.getServiceName());
                synchronized (resolveQueue) {
                    resolveQueue.add(serviceInfo);
                    processNextResolve(callback);
                }
            }

            @Override
            public void onServiceLost(NsdServiceInfo serviceInfo) {
                final String name = serviceInfo.getServiceName();
                mainHandler.post(() -> callback.onPeerLost(name));
            }
        };

        try {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoveryListener);
        } catch (Exception e) {
            Log.e(TAG, "Error starting discovery", e);
        }
    }

    private void processNextResolve(final DiscoveryCallback callback) {
        synchronized (resolveQueue) {
            if (isResolving || resolveQueue.isEmpty() || !isDiscovering) return;
            isResolving = true;
            final NsdServiceInfo nextService = resolveQueue.poll();
            if (nextService == null) {
                isResolving = false;
                return;
            }

            try {
                nsdManager.resolveService(nextService, new NsdManager.ResolveListener() {
                    @Override
                    public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                        Log.w(TAG, "Resolve failed for " + serviceInfo.getServiceName() + ": " + errorCode);
                        finishResolve(callback);
                    }

                    @Override
                    public void onServiceResolved(NsdServiceInfo resolved) {
                        InetAddress host = resolved.getHost();
                        final String ip = host != null ? host.getHostAddress() : "";
                        final int port = resolved.getPort();
                        final String name = resolved.getServiceName();
                        mainHandler.post(() -> callback.onPeerFound(name, ip, port));
                        finishResolve(callback);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "Error initiating resolve", e);
                finishResolve(callback);
            }
        }
    }

    private void finishResolve(final DiscoveryCallback callback) {
        synchronized (resolveQueue) {
            isResolving = false;
        }
        mainHandler.postDelayed(() -> {
            synchronized (resolveQueue) {
                processNextResolve(callback);
            }
        }, 120);
    }

    public void stopDiscovery() {
        if (discoveryListener != null && nsdManager != null && isDiscovering) {
            try {
                nsdManager.stopServiceDiscovery(discoveryListener);
            } catch (Exception e) {
                Log.w(TAG, "Error stopping discovery", e);
            }
        }
        isDiscovering = false;
        synchronized (resolveQueue) {
            resolveQueue.clear();
            isResolving = false;
        }

        if (multicastLock != null && multicastLock.isHeld()) {
            try {
                multicastLock.release();
            } catch (Exception ignored) {}
        }
    }

    /** Computes sha256 hex string */
    public static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    /** Ensures a persistent, authenticated TCP connection to HubDesk */
    private synchronized void ensureConnection(String host, int port, String syncCode, String deviceId) throws Exception {
        if (isConnected && activeSocket != null && !activeSocket.isClosed()
                && host.equals(activeHost) && port == activePort) {
            return;
        }

        disconnect();

        Log.d(TAG, "Connecting to " + host + ":" + port + "...");
        Socket s = new Socket(host, port);
        s.setTcpNoDelay(true);
        s.setSoTimeout(0); // non-blocking / indefinite for background reader loop

        BufferedReader r = new BufferedReader(new InputStreamReader(s.getInputStream(), StandardCharsets.UTF_8));
        PrintWriter w = new PrintWriter(new OutputStreamWriter(s.getOutputStream(), StandardCharsets.UTF_8), true);

        // Perform initial HELLO handshake synchronously
        String secret = sha256("deskhub-sync:" + (syncCode != null ? syncCode.trim() : ""));
        JSONObject hello = new JSONObject();
        hello.put("t", "hello");
        hello.put("id", 1);
        hello.put("device", deviceId != null && !deviceId.isEmpty() ? deviceId : "android-mobile");
        hello.put("name", "Smartphone Android");
        hello.put("platform", "android");
        hello.put("secret", secret);
        hello.put("proto", PROTO_VERSION);
        hello.put("version", "26.11.1-014");

        w.println(hello.toString());
        String respLine = r.readLine();
        if (respLine == null) throw new Exception("Connessione chiusa dal computer");
        JSONObject helloResp = new JSONObject(respLine);
        if ("error".equals(helloResp.optString("t"))) {
            s.close();
            throw new Exception("Computer: " + helloResp.optString("message", "Codice sincronizzazione errato"));
        }

        activeSocket = s;
        activeHost = host;
        activePort = port;
        activeReader = r;
        activeWriter = w;
        isConnected = true;

        startReaderLoop();
    }

    /** Multiplexed line reader thread: handles pings and server requests automatically and routes replies to request waiters */
    private void startReaderLoop() {
        if (readerThread != null && readerThread.isAlive()) return;

        readerThread = new Thread(() -> {
            try {
                String line;
                while (isConnected && activeReader != null && (line = activeReader.readLine()) != null) {
                    if (line.trim().isEmpty()) continue;
                    JSONObject msg = new JSONObject(line);
                    String t = msg.optString("t");
                    int id = msg.optInt("id", 0);
                    int re = msg.optInt("re", 0);

                    // Check if this is a response to an Android-initiated request (HubDesk sets "re": reqId)
                    int correlationId = re != 0 ? re : id;
                    CompletableFuture<JSONObject> waiter = pendingRequests.remove(correlationId);
                    if (waiter != null) {
                        waiter.complete(msg);
                        continue;
                    }

                    // Handle incoming server requests from HubDesk
                    if ("ping".equals(t)) {
                        JSONObject pong = new JSONObject();
                        pong.put("t", "pong");
                        if (id != 0) pong.put("re", id);
                        sendDirect(pong);
                    } else if ("manifest".equals(t)) {
                        // HubDesk requests Android's manifest upon connection
                        JSONObject manifestResp = new JSONObject();
                        manifestResp.put("t", "manifest");
                        if (id != 0) manifestResp.put("re", id);
                        manifestResp.put("records", new JSONObject());
                        sendDirect(manifestResp);
                    } else if ("get".equals(t)) {
                        JSONObject getResp = new JSONObject();
                        getResp.put("t", "records");
                        if (id != 0) getResp.put("re", id);
                        getResp.put("records", new JSONObject());
                        sendDirect(getResp);
                    } else if ("put".equals(t) || "base".equals(t)) {
                        JSONObject okResp = new JSONObject();
                        okResp.put("t", "ok");
                        if (id != 0) okResp.put("re", id);
                        sendDirect(okResp);
                    } else if ("changed".equals(t)) {
                        Log.d(TAG, "HubDesk notified records changed");
                    }
                }
            } catch (Exception e) {
                Log.d(TAG, "Reader loop ended: " + e.getMessage());
            } finally {
                disconnect();
            }
        });
        readerThread.start();
    }

    private void sendDirect(JSONObject msg) {
        synchronized (this) {
            if (activeWriter != null) {
                activeWriter.println(msg.toString());
            }
        }
    }

    /** Sends a JSON request and waits asynchronously for the reply with matching id */
    public JSONObject sendRequest(JSONObject req, int timeoutSeconds) throws Exception {
        if (!isConnected || activeWriter == null) {
            throw new Exception("Dispositivo non connesso");
        }
        int id = nextReqId.incrementAndGet();
        req.put("id", id);

        CompletableFuture<JSONObject> future = new CompletableFuture<>();
        pendingRequests.put(id, future);

        synchronized (this) {
            activeWriter.println(req.toString());
        }

        try {
            return future.get(timeoutSeconds, TimeUnit.SECONDS);
        } catch (Exception e) {
            pendingRequests.remove(id);
            throw new Exception("Timeout risposta dal computer (" + timeoutSeconds + "s)");
        }
    }

    /**
     * Fetches all available books from the connected computer via HubDesk records.
     * Returns list of book objects { id, title, size, chunks, chunkSize, tid, chapters, from }
     */
    public void fetchAvailableBooks(final String host, final int port, final String syncCode, final ComputerBooksCallback callback) {
        executor.execute(() -> {
            try {
                ensureConnection(host, port, syncCode, "android-mobile");

                // 1. Request MANIFEST
                JSONObject manifestReq = new JSONObject();
                manifestReq.put("t", "manifest");
                JSONObject manifestResp = sendRequest(manifestReq, 15);

                JSONObject remoteRecords = manifestResp.optJSONObject("records");
                if (remoteRecords == null) remoteRecords = new JSONObject();

                // 2. Filter keys that represent book manifests (bookfile:*)
                List<String> bookKeys = new ArrayList<>();
                JSONArray remoteKeyNames = remoteRecords.names();
                if (remoteKeyNames != null) {
                    for (int i = 0; i < remoteKeyNames.length(); i++) {
                        String k = remoteKeyNames.getString(i);
                        if (k.contains("bookfile:")) {
                            bookKeys.add(k);
                        }
                    }
                }

                if (bookKeys.isEmpty()) {
                    mainHandler.post(() -> callback.onBooksReceived(new ArrayList<>()));
                    return;
                }

                // 3. Request bookfile records to read title, size, and chunk info
                JSONObject getReq = new JSONObject();
                getReq.put("t", "get");
                JSONArray keysArr = new JSONArray();
                for (String k : bookKeys) keysArr.put(k);
                getReq.put("keys", keysArr);

                JSONObject getResp = sendRequest(getReq, 20);
                JSONObject recs = getResp.optJSONObject("records");

                List<JSONObject> result = new ArrayList<>();
                if (recs != null) {
                    JSONArray recNames = recs.names();
                    if (recNames != null) {
                        for (int r = 0; r < recNames.length(); r++) {
                            String rk = recNames.getString(r);
                            JSONObject rec = recs.optJSONObject(rk);
                            if (rec == null) continue;
                            JSONObject val = rec.optJSONObject("value");
                            if (val == null) continue;

                            JSONObject book = new JSONObject();
                            book.put("id", val.optString("id", rk.replace("studydesk/bookfile:", "").replace("bookfile:", "")));
                            book.put("title", val.optString("title", "Libro"));
                            book.put("size", val.optLong("size", 0));
                            book.put("chunks", val.optInt("chunks", 0));
                            book.put("chunkSize", val.optInt("chunkSize", 1048576));
                            book.put("tid", val.optString("tid", ""));
                            book.put("chapters", val.optJSONArray("chapters"));
                            book.put("from", val.optString("from", "Computer"));
                            result.add(book);
                        }
                    }
                }

                mainHandler.post(() -> callback.onBooksReceived(result));
            } catch (Exception e) {
                Log.e(TAG, "Error fetching computer books", e);
                mainHandler.post(() -> callback.onError(e.getMessage()));
            }
        });
    }

    /**
     * Downloads a book from the computer via Wi-Fi chunk by chunk, assembling it directly
     * into a temporary .sdbook zip file in app cache. Minimizes RAM usage to only 1MB per chunk.
     */
    public void downloadBookFromComputer(final String host, final int port, final String syncCode,
                                         final String bookId, final String tid, final int totalChunks,
                                         final String bookTitle, final long totalSize,
                                         final BookDownloadCallback callback) {
        executor.execute(() -> {
            File tempFile = null;
            FileOutputStream fos = null;
            try {
                ensureConnection(host, port, syncCode, "android-mobile");

                tempFile = new File(context.getCacheDir(), "import_book_" + bookId + ".sdbook");
                if (tempFile.exists()) tempFile.delete();
                fos = new FileOutputStream(tempFile);

                long downloadedBytes = 0;
                for (int n = 0; n < totalChunks; n++) {
                    // Try with studydesk/ prefix first (HubDesk format) and without as fallback
                    JSONObject getReq = new JSONObject();
                    getReq.put("t", "get");
                    JSONArray keys = new JSONArray();
                    keys.put("studydesk/bookchunk:" + bookId + ":" + tid + ":" + n);
                    keys.put("bookchunk:" + bookId + ":" + tid + ":" + n);
                    getReq.put("keys", keys);

                    JSONObject getResp = sendRequest(getReq, 30);
                    JSONObject recs = getResp.optJSONObject("records");
                    if (recs == null) throw new Exception("Risposta vuota per la parte " + (n + 1));

                    JSONObject chunkRec = recs.optJSONObject("studydesk/bookchunk:" + bookId + ":" + tid + ":" + n);
                    if (chunkRec == null) {
                        chunkRec = recs.optJSONObject("bookchunk:" + bookId + ":" + tid + ":" + n);
                    }
                    if (chunkRec == null) throw new Exception("Parte " + (n + 1) + " non trovata sul computer");

                    JSONObject val = chunkRec.optJSONObject("value");
                    String b64Data = val != null ? val.optString("data", "") : "";
                    if (b64Data.isEmpty()) throw new Exception("Dati non validi nella parte " + (n + 1));

                    byte[] chunkBytes = Base64.decode(b64Data, Base64.DEFAULT);
                    fos.write(chunkBytes);
                    downloadedBytes += chunkBytes.length;

                    final int currentChunk = n + 1;
                    final int pct = (int) (((float) currentChunk / totalChunks) * 100);
                    final long dl = downloadedBytes;
                    mainHandler.post(() -> callback.onProgress(pct, dl, totalSize,
                            "Scaricamento di «" + bookTitle + "» (" + currentChunk + " di " + totalChunks + " parti)..."));
                }

                fos.flush();
                fos.close();
                fos = null;

                final String savedFileName = tempFile.getName();
                mainHandler.post(() -> callback.onSuccess(savedFileName, bookTitle));

            } catch (Exception e) {
                Log.e(TAG, "Error downloading book " + bookId, e);
                if (fos != null) {
                    try { fos.close(); } catch (Exception ignored) {}
                }
                if (tempFile != null && tempFile.exists()) {
                    tempFile.delete();
                }
                mainHandler.post(() -> callback.onError(e.getMessage()));
            }
        });
    }

    /**
     * Executes synchronization of student progress and scores with the computer.
     */
    public synchronized void sync(final String host, final int port, final String syncCode, final String deviceId,
                                  final String localRecordsJson, final SyncProgressCallback callback) {
        executor.execute(() -> {
            try {
                postProgress(callback, "Connessione al computer in corso...", 10, 100);
                ensureConnection(host, port, syncCode, deviceId);

                postProgress(callback, "Verifica stato sincronizzazione...", 30, 100);

                // Send local student progress to computer
                if (localRecordsJson != null && !localRecordsJson.isEmpty()) {
                    postProgress(callback, "Invio progressi ed esercizi al computer...", 60, 100);
                    JSONObject localRecs = new JSONObject(localRecordsJson);
                    if (localRecs.length() > 0) {
                        JSONObject putReq = new JSONObject();
                        putReq.put("t", "put");
                        putReq.put("records", localRecs);
                        sendRequest(putReq, 20);
                    }
                }

                postProgress(callback, "Sincronizzazione completata con successo!", 100, 100);
                JSONObject result = new JSONObject();
                result.put("computerName", "Computer");
                mainHandler.post(() -> callback.onComplete(true, "Sincronizzazione completata", result.toString()));

            } catch (Exception e) {
                Log.e(TAG, "Sync error", e);
                mainHandler.post(() -> callback.onComplete(false, e.getMessage(), null));
            }
        });
    }

    public synchronized void disconnect() {
        isConnected = false;
        try {
            if (activeSocket != null) activeSocket.close();
        } catch (Exception ignored) {}
        activeSocket = null;
        activeReader = null;
        activeWriter = null;
        activeHost = null;
        activePort = 0;
        pendingRequests.clear();
        if (readerThread != null) {
            readerThread.interrupt();
            readerThread = null;
        }
    }

    private void postProgress(final SyncProgressCallback callback, final String status, final int cur, final int tot) {
        mainHandler.post(() -> callback.onProgress(status, cur, tot));
    }
}
