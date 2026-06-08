import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getPostsByStatus } from "../lib/poster/storage";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const raw = readFileSync(
    resolve(process.cwd(), "scripts/data/taller-bc-schedule-batch.txt"),
    "utf8",
  );
  const batchTexts = new Set(
    raw
      .trim()
      .split(/\r?\n\r?\n+/)
      .map((b) => b.split("\n").slice(1).join("\n").trim()),
  );

  const scheduled = await getPostsByStatus("scheduled", 200);
  const batchPosts = scheduled.filter((p) => batchTexts.has(p.text.trim()));
  batchPosts.sort((a, b) => a.publish_at.localeCompare(b.publish_at));

  const publishAts = batchPosts.map((p) => p.publish_at);
  const dupAts = publishAts.filter((t, i) => publishAts.indexOf(t) !== i);
  const empty = batchPosts.filter((p) => !p.text.trim());
  const nonEnglish = batchPosts.filter((p) => /[\u0400-\u04FF]/.test(p.text));
  const smoke = scheduled.filter((p) => !batchTexts.has(p.text.trim()));

  console.log("batch posts in DB:", batchPosts.length);
  console.log("first publish_at:", batchPosts[0]?.publish_at);
  console.log("last publish_at:", batchPosts[batchPosts.length - 1]?.publish_at);
  console.log("duplicate publish_at:", dupAts.length ? dupAts : "none");
  console.log("empty posts:", empty.length);
  console.log("non-English:", nonEnglish.length);
  console.log("other scheduled (smoke etc):", smoke.length);
  for (const s of smoke) {
    console.log("  other:", s.publish_at, s.text.slice(0, 50));
  }
}

main();
