package com.guairajaramillo.studydesk;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * MainActivity — Modern Android reader shell for StudyDesk.
 * Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0).
 */
public class MainActivity extends Activity {
    private static final String TAG = "StudyDeskMainActivity";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int REQUEST_INSTALL_PERM = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private HubDeskSyncClient syncClient;
    private String pendingSharedBookJson = null;
    private String pendingApkInstallPath = null;
    private boolean webViewReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive dark status bar matching theme
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(0xFF090E1A);
        window.setNavigationBarColor(0xFF090E1A);

        syncClient = new HubDeskSyncClient(this);

        // Check if app was opened via file share (ACTION_SEND) or file tap (ACTION_VIEW)
        handleIncomingIntent(getIntent());

        setupWebView();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingIntent(intent);
    }

    /**
     * Handles book files shared from WhatsApp, Telegram, Files, Chrome, etc.
     */
    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Uri targetUri = null;

        if (Intent.ACTION_SEND.equals(action)) {
            // Shared from another app
            targetUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else if (Intent.ACTION_VIEW.equals(action)) {
            // Tapped in file manager or download notification
            targetUri = intent.getData();
        }

        if (targetUri != null) {
            processIncomingBookUri(targetUri);
        }
    }

    private void processIncomingBookUri(final Uri uri) {
        new Thread(() -> {
            try {
                String filename = getFileName(uri);
                if (filename == null || filename.isEmpty()) filename = "libro-importato.sdbook";

                InputStream is = getContentResolver().openInputStream(uri);
                if (is == null) return;

                ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int n;
                while ((n = is.read(chunk, 0, chunk.length)) != -1) {
                    buffer.write(chunk, 0, n);
                }
                is.close();

                byte[] bytes = buffer.toByteArray();
                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

                JSONObject payload = new JSONObject();
                payload.put("name", filename);
                payload.put("data", base64);
                final String payloadStr = payload.toString();

                runOnUiThread(() -> {
                    if (webViewReady && webView != null) {
                        webView.evaluateJavascript("window.onSharedBookReceived && window.onSharedBookReceived(" + payloadStr + ");", null);
                    } else {
                        pendingSharedBookJson = payloadStr;
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Error importing incoming book file", e);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Errore durante l'apertura del file", Toast.LENGTH_SHORT).show());
            }
        }).start();
    }

    private String getFileName(Uri uri) {
        String result = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor cursor = getContentResolver().query(uri, null, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    if (nameIdx >= 0) result = cursor.getString(nameIdx);
                }
            } catch (Exception ignored) {}
        }
        if (result == null) {
            result = uri.getPath();
            if (result != null) {
                int cut = result.lastIndexOf('/');
                if (cut != -1) result = result.substring(cut + 1);
            }
        }
        return result;
    }

    private void setupWebView() {
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.addJavascriptInterface(new AndroidBridge(), "androidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView wv, ValueCallback<Uri[]> filePathCb, FileChooserParams params) {
                fileChooserCallback = filePathCb;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[] {
                    "application/zip", "application/octet-stream", "application/x-zip-compressed"
                });
                try {
                    startActivityForResult(Intent.createChooser(intent, "Seleziona libro StudyDesk (.sdbook)"), FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Auto grant microphone for oral recording exercises
                request.grant(request.getResources());
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("studydesk.local".equals(uri.getHost())) {
                    String path = uri.getPath();
                    if (path != null && path.startsWith("/")) path = path.substring(1);
                    if (path == null || path.isEmpty()) path = "index.html";

                    if (path.startsWith("__book_download__/")) {
                        String filename = path.substring("__book_download__/".length());
                        File tempBookFile = new File(getCacheDir(), filename);
                        if (tempBookFile.exists()) {
                            try {
                                FileInputStream fis = new FileInputStream(tempBookFile);
                                Map<String, String> headers = new HashMap<>();
                                headers.put("Access-Control-Allow-Origin", "*");
                                return new WebResourceResponse("application/octet-stream", "binary", 200, "OK", headers, fis);
                            } catch (Exception e) {
                                return new WebResourceResponse("text/plain", "UTF-8", 500, "Error reading file", null, null);
                            }
                        } else {
                            return new WebResourceResponse("text/plain", "UTF-8", 404, "File not found", null, null);
                        }
                    }

                    try {
                        InputStream is = getAssets().open("web/" + path);
                        String mime = getMimeType(path);
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, is);
                    } catch (Exception e) {
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                webViewReady = true;
                if (pendingSharedBookJson != null) {
                    final String json = pendingSharedBookJson;
                    pendingSharedBookJson = null;
                    webView.evaluateJavascript("window.onSharedBookReceived && window.onSharedBookReceived(" + json + ");", null);
                }
            }
        });

        // Load the mobile reader via https://studydesk.local/index.html (zero CORS, full HTML5 support)
        webView.loadUrl("https://studydesk.local/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK && data != null) {
                    if (data.getData() != null) {
                        results = new Uri[] { data.getData() };
                    } else if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                        }
                    }
                }
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
        } else if (requestCode == REQUEST_INSTALL_PERM) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && getPackageManager().canRequestPackageInstalls()) {
                if (pendingApkInstallPath != null) {
                    installApk(new File(pendingApkInstallPath));
                    pendingApkInstallPath = null;
                }
            } else {
                Toast.makeText(this, "Permesso di installazione non concesso", Toast.LENGTH_SHORT).show();
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    private void installApk(File apkFile) {
        if (apkFile == null || !apkFile.exists()) {
            Toast.makeText(this, "File APK di aggiornamento non trovato", Toast.LENGTH_SHORT).show();
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (!getPackageManager().canRequestPackageInstalls()) {
                pendingApkInstallPath = apkFile.getAbsolutePath();
                Intent permIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()));
                startActivityForResult(permIntent, REQUEST_INSTALL_PERM);
                return;
            }
        }

        try {
            Uri apkUri = Uri.parse("content://" + StudyDeskFileProvider.AUTHORITY + "/" + apkFile.getName());
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error launching package installer", e);
            Toast.makeText(this, "Errore durante l'installazione: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            // Ask JS if it handled the back action (e.g. closing drawer, returning from chapter to bookshelf)
            webView.evaluateJavascript("typeof window.handleAndroidBack === 'function' ? window.handleAndroidBack() : false;", value -> {
                if (!"true".equals(value)) {
                    finish();
                }
            });
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (syncClient != null) syncClient.stopDiscovery();
        super.onDestroy();
    }

    private String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "text/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".sdbook") || lower.endsWith(".sdmod") || lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    /**
     * Bridge exposed to JavaScript in WebView via window.androidBridge
     */
    public class AndroidBridge {
        @JavascriptInterface
        public String getPendingSharedBook() {
            String p = pendingSharedBookJson;
            pendingSharedBookJson = null;
            return p != null ? p : "";
        }

        @JavascriptInterface
        public void discoverComputers() {
            syncClient.startDiscovery(new HubDeskSyncClient.DiscoveryCallback() {
                @Override
                public void onPeerFound(String name, String host, int port) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("name", name);
                        obj.put("host", host);
                        obj.put("port", port);
                        final String js = "window.onPeerDiscovered && window.onPeerDiscovered(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }

                @Override
                public void onPeerLost(String name) {
                    final String js = "window.onPeerLost && window.onPeerLost('" + name.replace("'", "\\'") + "');";
                    runOnUiThread(() -> webView.evaluateJavascript(js, null));
                }
            });
        }

        @JavascriptInterface
        public void stopDiscovery() {
            syncClient.stopDiscovery();
        }

        @JavascriptInterface
        public void syncWithComputer(String host, int port, String code, String deviceId, String localRecordsJson) {
            syncClient.sync(host, port, code, deviceId, localRecordsJson, new HubDeskSyncClient.SyncProgressCallback() {
                @Override
                public void onProgress(String status, int current, int total) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("status", status);
                        obj.put("current", current);
                        obj.put("total", total);
                        final String js = "window.onSyncProgress && window.onSyncProgress(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }

                @Override
                public void onComplete(boolean success, String message, String resultJson) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("success", success);
                        obj.put("message", message);
                        obj.put("data", resultJson != null ? new JSONObject(resultJson) : new JSONObject());
                        final String js = "window.onSyncComplete && window.onSyncComplete(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void fetchComputerBooks(String host, int port, String code) {
            syncClient.fetchAvailableBooks(host, port, code, new HubDeskSyncClient.ComputerBooksCallback() {
                @Override
                public void onBooksReceived(List<JSONObject> books) {
                    try {
                        JSONArray arr = new JSONArray();
                        for (JSONObject b : books) arr.put(b);
                        final String js = "window.onComputerBooksDiscovered && window.onComputerBooksDiscovered(" + arr.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }

                @Override
                public void onError(String message) {
                    final String js = "window.onComputerBooksError && window.onComputerBooksError('" + message.replace("'", "\\'") + "');";
                    runOnUiThread(() -> webView.evaluateJavascript(js, null));
                }
            });
        }

        @JavascriptInterface
        public void downloadBookFromComputer(String host, int port, String code, String bookId, String tid, int totalChunks, String bookTitle, long totalSize) {
            syncClient.downloadBookFromComputer(host, port, code, bookId, tid, totalChunks, bookTitle, totalSize, new HubDeskSyncClient.BookDownloadCallback() {
                @Override
                public void onProgress(int percent, long downloadedBytes, long totalBytes, String status) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("percent", percent);
                        obj.put("downloaded", downloadedBytes);
                        obj.put("total", totalBytes);
                        obj.put("status", status);
                        final String js = "window.onBookDownloadProgress && window.onBookDownloadProgress(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }

                @Override
                public void onSuccess(String fileName, String title) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("fileName", fileName);
                        obj.put("bookTitle", title);
                        final String js = "window.onBookDownloadSuccess && window.onBookDownloadSuccess(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }

                @Override
                public void onError(String message) {
                    try {
                        JSONObject obj = new JSONObject();
                        obj.put("message", message);
                        final String js = "window.onBookDownloadError && window.onBookDownloadError(" + obj.toString() + ");";
                        runOnUiThread(() -> webView.evaluateJavascript(js, null));
                    } catch (Exception ignored) {}
                }
            });
        }

        @JavascriptInterface
        public void deleteTempFile(String fileName) {
            try {
                File f = new File(getCacheDir(), fileName);
                if (f.exists()) f.delete();
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void showToast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }

        @JavascriptInterface
        public void vibrate(int ms) {
            try {
                Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(ms);
                    }
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void shareProgressPdf(final String bookTitle, final String bookSubtitle, final String level, final String chaptersJson) {
            new Thread(() -> {
                try {
                    File pdfFile = PdfReportGenerator.generateReport(
                            MainActivity.this, bookTitle, bookSubtitle, level, chaptersJson,
                            pct -> runOnUiThread(() -> webView.evaluateJavascript("window.onPdfProgress && window.onPdfProgress(" + pct + ");", null))
                    );

                    runOnUiThread(() -> {
                        try {
                            Uri uri = Uri.parse("content://" + StudyDeskFileProvider.AUTHORITY + "/" + pdfFile.getName());
                            Intent intent = new Intent(Intent.ACTION_SEND);
                            intent.setType("application/pdf");
                            intent.putExtra(Intent.EXTRA_STREAM, uri);
                            intent.putExtra(Intent.EXTRA_SUBJECT, "Avanzamento " + bookTitle);
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(Intent.createChooser(intent, "Condividi avanzamento del libro"));
                            webView.evaluateJavascript("window.onPdfGenerated && window.onPdfGenerated(true);", null);
                        } catch (Exception e) {
                            Log.e(TAG, "Error opening share chooser for PDF", e);
                            Toast.makeText(MainActivity.this, "Errore nella condivisione del PDF", Toast.LENGTH_SHORT).show();
                            webView.evaluateJavascript("window.onPdfGenerated && window.onPdfGenerated(false);", null);
                        }
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error generating progress PDF", e);
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Errore generazione PDF: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        webView.evaluateJavascript("window.onPdfGenerated && window.onPdfGenerated(false);", null);
                    });
                }
            }).start();
        }

        @JavascriptInterface
        public void shareBookFile(final String filename, final String base64Data) {
            new Thread(() -> {
                try {
                    byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                    File outFile = new File(getCacheDir(), filename);
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(outFile);
                    fos.write(bytes);
                    fos.close();

                    runOnUiThread(() -> {
                        Uri uri = Uri.parse("content://" + StudyDeskFileProvider.AUTHORITY + "/" + outFile.getName());
                        Intent intent = new Intent(Intent.ACTION_SEND);
                        intent.setType("application/zip");
                        intent.putExtra(Intent.EXTRA_STREAM, uri);
                        intent.putExtra(Intent.EXTRA_SUBJECT, filename);
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(intent, "Condividi libro (.sdbook)"));
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error sharing book file", e);
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Errore nella condivisione del libro", Toast.LENGTH_SHORT).show());
                }
            }).start();
        }

        @JavascriptInterface
        public String getAppVersion() {
            return "26.11.1-014";
        }

        @JavascriptInterface
        public String getAppChannel() {
            return "stable";
        }

        @JavascriptInterface
        public void downloadAndInstallUpdate(final String apkUrl, final String versionName) {
            new Thread(() -> {
                HttpURLConnection conn = null;
                InputStream in = null;
                FileOutputStream out = null;
                try {
                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript("window.onUpdateDownloadProgress && window.onUpdateDownloadProgress(0, 0, 0, 'Avvio connessione...');", null);
                        }
                    });

                    URL url = new URL(apkUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setRequestProperty("User-Agent", "StudyDesk-Android/26.11.1-014");
                    conn.connect();

                    int status = conn.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                        String newUrl = conn.getHeaderField("Location");
                        conn.disconnect();
                        url = new URL(newUrl);
                        conn = (HttpURLConnection) url.openConnection();
                        conn.setRequestProperty("User-Agent", "StudyDesk-Android/26.11.1-014");
                        conn.connect();
                    }

                    int totalBytes = conn.getContentLength();
                    in = conn.getInputStream();
                    File cacheFile = new File(getCacheDir(), "StudyDesk-Update.apk");
                    out = new FileOutputStream(cacheFile);

                    byte[] buffer = new byte[16384];
                    int bytesRead;
                    int totalDownloaded = 0;
                    long lastEmit = 0;

                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                        totalDownloaded += bytesRead;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 180) {
                            lastEmit = now;
                            final int current = totalDownloaded;
                            final int total = totalBytes > 0 ? totalBytes : current;
                            final int pct = totalBytes > 0 ? (int) (((float) current / totalBytes) * 100) : 50;
                            runOnUiThread(() -> {
                                if (webView != null) {
                                    webView.evaluateJavascript("window.onUpdateDownloadProgress && window.onUpdateDownloadProgress(" + pct + ", " + current + ", " + total + ", 'Download in corso...');", null);
                                }
                            });
                        }
                    }
                    out.flush();

                    runOnUiThread(() -> {
                        if (webView != null) {
                            webView.evaluateJavascript("window.onUpdateDownloadComplete && window.onUpdateDownloadComplete(true, '');", null);
                        }
                        installApk(cacheFile);
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Error downloading update APK", e);
                    final String errMsg = e.getMessage() != null ? e.getMessage() : "Errore download";
                    runOnUiThread(() -> {
                        Toast.makeText(MainActivity.this, "Errore download aggiornamento: " + errMsg, Toast.LENGTH_LONG).show();
                        if (webView != null) {
                            webView.evaluateJavascript("window.onUpdateDownloadComplete && window.onUpdateDownloadComplete(false, '" + errMsg.replace("'", "\\'") + "');", null);
                        }
                    });
                } finally {
                    try { if (in != null) in.close(); } catch (Exception ignored) {}
                    try { if (out != null) out.close(); } catch (Exception ignored) {}
                    if (conn != null) conn.disconnect();
                }
            }).start();
        }
    }
}
