/**
 * Cron route для планировщика постов TALLER poster bot.
 * Вызывается Vercel Cron (backup) + webhook проверяет очередь каждые 60 сек.
 */

import { NextResponse } from "next/server";
import { processScheduledPosts } from "@/lib/poster/scheduler";
import { isPosterStorageConfigured } from "@/lib/poster/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!isPosterStorageConfigured()) {
      return NextResponse.json(
        { ok: false, message: "Supabase not configured for poster scheduler" },
        { status: 200 },
      );
    }

    await processScheduledPosts();
    return NextResponse.json({ ok: true, message: "Scheduler processed" });
  } catch (error) {
    console.error("[SCHEDULER] Error in scheduler route:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 200 });
  }
}
