/**
 * Import scheduled posts from batch file.
 * Format per post:
 *   YYYY-MM-DD HH:mm
 *   <text>
 *
 * Posts separated by blank line.
 * Usage: npx tsx scripts/import-schedule-batch.ts scripts/data/taller-bc-schedule-batch.txt
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPost, getPostsByStatus } from "../lib/poster/storage";
import { parseScheduleDateTime } from "../lib/poster/utils";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

type ParsedPost = { dateTime: string; publishAt: string; text: string };

function parseBatchFile(content: string): { posts: ParsedPost[]; errors: string[] } {
  const errors: string[] = [];
  const posts: ParsedPost[] = [];
  const blocks = content.trim().split(/\r?\n\r?\n+/);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) {
      continue;
    }
    const lines = block.split("\n");
    const dateTime = lines[0]?.trim() ?? "";
    const text = lines.slice(1).join("\n").trim();

    if (!text) {
      errors.push(`Block ${i + 1}: empty text (${dateTime})`);
      continue;
    }

    const publishAt = parseScheduleDateTime(dateTime);
    if (!publishAt) {
      errors.push(`Block ${i + 1}: invalid datetime "${dateTime}"`);
      continue;
    }

    posts.push({ dateTime, publishAt, text });
  }

  return { posts, errors };
}

function hasCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

async function main() {
  const filePath = resolve(process.cwd(), process.argv[2] ?? "scripts/data/taller-bc-schedule-batch.txt");
  const raw = readFileSync(filePath, "utf8");
  const { posts, errors } = parseBatchFile(raw);

  if (errors.length > 0) {
    console.error("Parse errors:");
    for (const e of errors) {
      console.error(" ", e);
    }
    process.exit(1);
  }

  const dateTimes = posts.map((p) => p.dateTime);
  const dupDates = dateTimes.filter((d, i) => dateTimes.indexOf(d) !== i);
  if (dupDates.length > 0) {
    console.error("Duplicate datetimes in batch:", [...new Set(dupDates)].join(", "));
    process.exit(1);
  }

  const nonEnglish = posts.filter((p) => hasCyrillic(p.text));
  if (nonEnglish.length > 0) {
    console.error("Non-English (Cyrillic) detected in", nonEnglish.length, "post(s)");
    process.exit(1);
  }

  const existing = await getPostsByStatus("scheduled", 200);
  const existingKeys = new Set(
    existing.map((p) => `${p.publish_at}|${p.text.trim()}`),
  );
  const conflicts = posts.filter((p) =>
    existing.some(
      (e) =>
        e.publish_at === p.publishAt ||
        e.text.trim() === p.text ||
        existingKeys.has(`${p.publishAt}|${p.text}`),
    ),
  );

  if (conflicts.length > 0) {
    console.log("WARNING: potential conflicts with existing scheduled posts:", conflicts.length);
    for (const c of conflicts.slice(0, 5)) {
      console.log(" ", c.dateTime, c.text.slice(0, 50));
    }
  }

  let added = 0;
  for (const post of posts) {
    const dup = existing.find(
      (e) => e.publish_at === post.publishAt && e.text.trim() === post.text,
    );
    if (dup) {
      console.log("SKIP duplicate:", post.dateTime);
      continue;
    }
    await createPost(post.publishAt, post.text);
    added += 1;
  }

  const after = await getPostsByStatus("scheduled", 200);
  const scheduled = after
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => a.publish_at.localeCompare(b.publish_at));

  const batchScheduled = scheduled.filter((p) =>
    posts.some((bp) => bp.text === p.text.trim()),
  );

  console.log("--- Import summary ---");
  console.log("parsed:", posts.length);
  console.log("added:", added);
  console.log("skipped (exact dup):", posts.length - added);
  console.log("batch in DB (by text match):", batchScheduled.length);
  if (batchScheduled.length > 0) {
    console.log("first:", batchScheduled[0].publish_at);
    console.log("last:", batchScheduled[batchScheduled.length - 1].publish_at);
  }
  console.log("total scheduled in DB:", scheduled.length);
  console.log("existing before import:", existing.length);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
