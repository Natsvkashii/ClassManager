package com.guairajaramillo.studydesk;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * StudyDeskFileProvider — simple, self-contained ContentProvider for sharing
 * PDF progress reports and exported .sdbook archives to other apps (WhatsApp, Gmail, Telegram).
 * Zero AndroidX dependencies needed.
 *
 * Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0).
 */
public class StudyDeskFileProvider extends ContentProvider {
    public static final String AUTHORITY = "com.guairajaramillo.studydesk.fileprovider";

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        String path = uri.getPath();
        if (path == null) return null;
        if (path.startsWith("/")) path = path.substring(1);

        File file = new File(getContext().getCacheDir(), path);
        if (!file.exists()) {
            file = new File(getContext().getFilesDir(), path);
        }

        String[] cols = projection != null ? projection : new String[]{
                OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE
        };
        MatrixCursor cursor = new MatrixCursor(cols);
        Object[] row = new Object[cols.length];
        for (int i = 0; i < cols.length; i++) {
            if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) {
                row[i] = file.getName();
            } else if (OpenableColumns.SIZE.equals(cols[i])) {
                row[i] = file.length();
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        String path = uri.getPath();
        if (path == null) return "application/octet-stream";
        String lower = path.toLowerCase();
        if (lower.endsWith(".pdf")) return "application/pdf";
        if (lower.endsWith(".sdbook") || lower.endsWith(".sdmod") || lower.endsWith(".zip")) return "application/zip";
        if (lower.endsWith(".apk")) return "application/vnd.android.package-archive";
        return "application/octet-stream";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        String path = uri.getPath();
        if (path == null) throw new FileNotFoundException("Null path");
        if (path.startsWith("/")) path = path.substring(1);

        File file = new File(getContext().getCacheDir(), path);
        if (!file.exists()) {
            file = new File(getContext().getFilesDir(), path);
        }
        if (!file.exists()) {
            throw new FileNotFoundException("File not found: " + path);
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        return null;
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
