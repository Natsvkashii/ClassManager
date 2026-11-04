package com.guairajaramillo.studydesk;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.pdf.PdfDocument;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * PdfReportGenerator — creates a high-quality multi-page A4 PDF report
 * of a book's study progress and scores divided by chapters.
 *
 * Conceived & created for Classroom Tools by Guaira Jaramillo Nitoglia (GPL-3.0).
 */
public class PdfReportGenerator {
    private static final String TAG = "PdfReportGenerator";
    private static final int PAGE_WIDTH = 595;   // A4 width in points
    private static final int PAGE_HEIGHT = 842;  // A4 height in points
    private static final int MARGIN_X = 40;
    private static final int CONTENT_WIDTH = PAGE_WIDTH - (MARGIN_X * 2);
    private static final int BOTTOM_LIMIT = 780;

    public interface ProgressListener {
        void onProgress(int percent);
    }

    public static File generateReport(Context context, String bookTitle, String bookSubtitle,
                                      String level, String chaptersJsonStr, ProgressListener listener) throws Exception {
        JSONArray chapters = new JSONArray(chaptersJsonStr);
        PdfDocument document = new PdfDocument();

        // Calculate totals
        int totalActs = 0;
        int completedActs = 0;
        int totalScore = 0;
        int totalMaxScore = 0;

        for (int c = 0; c < chapters.length(); c++) {
            JSONObject chap = chapters.getJSONObject(c);
            JSONArray acts = chap.optJSONArray("activities");
            if (acts != null) {
                for (int a = 0; a < acts.length(); a++) {
                    totalActs++;
                    JSONObject act = acts.getJSONObject(a);
                    if ("correct".equals(act.optString("status"))) {
                        completedActs++;
                    }
                    totalScore += act.optInt("score", 0);
                    totalMaxScore += act.optInt("maxScore", 0);
                }
            }
        }

        int globalPct = totalActs > 0 ? Math.round(((float) completedActs / totalActs) * 100) : 0;
        String dateStr = new SimpleDateFormat("d MMMM yyyy, HH:mm", Locale.ITALIAN).format(new Date());

        // Paints
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        int pageNumber = 1;
        List<PdfDocument.Page> pages = new ArrayList<>();

        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
        PdfDocument.Page page = document.startPage(pageInfo);
        Canvas canvas = page.getCanvas();
        int curY = 40;

        // --- Page 1 Header Banner ---
        RectF headerRect = new RectF(MARGIN_X, curY, MARGIN_X + CONTENT_WIDTH, curY + 70);
        paint.setColor(0xFF0F172A); // Dark navy
        canvas.drawRoundRect(headerRect, 10, 10, paint);

        paint.setColor(0xFF0EA5E9); // Primary cyan
        paint.setTextSize(9);
        paint.setFakeBoldText(true);
        canvas.drawText("STUDYDESK · REPORT AVANZAMENTO", MARGIN_X + 16, curY + 22, paint);

        paint.setColor(0xFFFFFFFF);
        paint.setTextSize(17);
        paint.setFakeBoldText(true);
        canvas.drawText(bookTitle != null ? bookTitle : "Libro di studio", MARGIN_X + 16, curY + 44, paint);

        paint.setColor(0xFF94A3B8);
        paint.setTextSize(10);
        paint.setFakeBoldText(false);
        String sub = (bookSubtitle != null ? bookSubtitle : "") + (level != null && !level.isEmpty() ? " · Livello " + level : "") + " · Generato il " + dateStr;
        canvas.drawText(sub, MARGIN_X + 16, curY + 60, paint);

        curY += 82;

        // --- Overall Summary Box ---
        RectF summaryRect = new RectF(MARGIN_X, curY, MARGIN_X + CONTENT_WIDTH, curY + 52);
        paint.setColor(0xFFF1F5F9);
        canvas.drawRoundRect(summaryRect, 8, 8, paint);

        paint.setColor(0xFF0F172A);
        paint.setTextSize(11);
        paint.setFakeBoldText(true);
        canvas.drawText("Riepilogo Totale:", MARGIN_X + 14, curY + 20, paint);

        paint.setTextSize(10);
        paint.setFakeBoldText(false);
        paint.setColor(0xFF475569);
        canvas.drawText("Attività completate: " + completedActs + " su " + totalActs + " (" + globalPct + "%)", MARGIN_X + 14, curY + 36, paint);

        String scoreStr = "Punteggio: " + totalScore + " / " + totalMaxScore + " pt";
        paint.setColor(0xFF0284C7);
        paint.setFakeBoldText(true);
        canvas.drawText(scoreStr, MARGIN_X + 280, curY + 36, paint);

        curY += 66;

        // --- Chapters and Activities ---
        int totalChapters = chapters.length();
        for (int c = 0; c < totalChapters; c++) {
            if (listener != null) {
                int p = (int) (((float) (c + 1) / totalChapters) * 100);
                listener.onProgress(p);
            }

            JSONObject chap = chapters.getJSONObject(c);
            String chapTitle = chap.optString("title", "Capitolo " + (c + 1));
            String chapNum = chap.optString("number", String.valueOf(c + 1));
            JSONArray acts = chap.optJSONArray("activities");
            int actCount = acts != null ? acts.length() : 0;

            // Check page overflow for chapter header
            if (curY + 60 > BOTTOM_LIMIT) {
                drawFooter(canvas, pageNumber);
                document.finishPage(page);
                pageNumber++;
                pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
                page = document.startPage(pageInfo);
                canvas = page.getCanvas();
                curY = 40;
            }

            // Chapter Header Box
            RectF chapHeader = new RectF(MARGIN_X, curY, MARGIN_X + CONTENT_WIDTH, curY + 26);
            paint.setColor(0xFFE2E8F0);
            canvas.drawRoundRect(chapHeader, 6, 6, paint);

            paint.setColor(0xFF0369A1);
            paint.setTextSize(11);
            paint.setFakeBoldText(true);
            canvas.drawText("Capitolo " + chapNum + ": " + chapTitle, MARGIN_X + 10, curY + 17, paint);

            paint.setColor(0xFF64748B);
            paint.setTextSize(9);
            paint.setFakeBoldText(false);
            canvas.drawText(actCount + " attività", MARGIN_X + CONTENT_WIDTH - 60, curY + 17, paint);

            curY += 32;

            if (acts != null) {
                for (int a = 0; a < acts.length(); a++) {
                    // Check page overflow for activity row
                    if (curY + 24 > BOTTOM_LIMIT) {
                        drawFooter(canvas, pageNumber);
                        document.finishPage(page);
                        pageNumber++;
                        pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
                        page = document.startPage(pageInfo);
                        canvas = page.getCanvas();
                        curY = 40;
                    }

                    JSONObject act = acts.getJSONObject(a);
                    String aNum = act.optString("number", String.valueOf(a + 1));
                    String aTitle = act.optString("title", "Attività");
                    int aPage = act.optInt("page", 0);
                    String status = act.optString("status", "");
                    int score = act.optInt("score", 0);
                    int maxScore = act.optInt("maxScore", 0);

                    // Row background alternating
                    if (a % 2 == 1) {
                        paint.setColor(0xFFF8FAFC);
                        canvas.drawRect(MARGIN_X, curY - 2, MARGIN_X + CONTENT_WIDTH, curY + 18, paint);
                    }

                    // Activity Number & Title
                    paint.setColor(0xFF1E293B);
                    paint.setTextSize(9);
                    paint.setFakeBoldText(true);
                    canvas.drawText(aNum + ".", MARGIN_X + 6, curY + 11, paint);

                    paint.setFakeBoldText(false);
                    String titleCut = aTitle.length() > 38 ? aTitle.substring(0, 35) + "..." : aTitle;
                    canvas.drawText(titleCut, MARGIN_X + 24, curY + 11, paint);

                    if (aPage > 0) {
                        paint.setColor(0xFF94A3B8);
                        paint.setTextSize(8);
                        canvas.drawText("pag. " + aPage, MARGIN_X + 230, curY + 11, paint);
                    }

                    // Status Pill
                    if ("correct".equals(status)) {
                        paint.setColor(0xFF10B981); // Green
                        paint.setTextSize(8);
                        paint.setFakeBoldText(true);
                        canvas.drawText("✔ Completato", MARGIN_X + 310, curY + 11, paint);
                    } else if ("partial".equals(status)) {
                        paint.setColor(0xFFF59E0B); // Amber
                        paint.setTextSize(8);
                        paint.setFakeBoldText(true);
                        canvas.drawText("▲ Parziale", MARGIN_X + 310, curY + 11, paint);
                    } else {
                        paint.setColor(0xFF94A3B8); // Gray
                        paint.setTextSize(8);
                        paint.setFakeBoldText(false);
                        canvas.drawText("○ Non svolto", MARGIN_X + 310, curY + 11, paint);
                    }

                    // Score
                    if (maxScore > 0) {
                        paint.setColor(0xFF0F172A);
                        paint.setTextSize(9);
                        paint.setFakeBoldText(true);
                        String scStr = score + "/" + maxScore + " pt";
                        canvas.drawText(scStr, MARGIN_X + CONTENT_WIDTH - 55, curY + 11, paint);
                    }

                    curY += 20;
                }
            }
            curY += 12; // Gap after chapter
        }

        drawFooter(canvas, pageNumber);
        document.finishPage(page);

        // Save to cache dir
        String cleanSlug = (bookTitle != null ? bookTitle.replaceAll("[^a-zA-Z0-9_-]", "_") : "Libro");
        File outFile = new File(context.getCacheDir(), "Avanzamento_" + cleanSlug + ".pdf");
        FileOutputStream fos = new FileOutputStream(outFile);
        document.writeTo(fos);
        fos.close();
        document.close();

        Log.d(TAG, "Report PDF generated successfully: " + outFile.getAbsolutePath() + " (" + outFile.length() + " bytes)");
        return outFile;
    }

    private static void drawFooter(Canvas canvas, int pageNum) {
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(0xFFCBD5E1);
        canvas.drawLine(MARGIN_X, PAGE_HEIGHT - 35, MARGIN_X + CONTENT_WIDTH, PAGE_HEIGHT - 35, p);

        p.setColor(0xFF94A3B8);
        p.setTextSize(8);
        canvas.drawText("StudyDesk per Android · Guaira Jaramillo Nitoglia (GPL-3.0)", MARGIN_X, PAGE_HEIGHT - 22, p);
        canvas.drawText("Pagina " + pageNum, MARGIN_X + CONTENT_WIDTH - 40, PAGE_HEIGHT - 22, p);
    }
}
