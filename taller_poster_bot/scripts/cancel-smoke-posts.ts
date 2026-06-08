import { getPostsByStatus, markPostAsCanceled } from "../lib/poster/storage";
import { pgMarkCanceled, isPosterPgConfigured } from "../lib/poster/storage-pg";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

const SMOKE_PATTERN = /Smoke schedule from TALLER RPC test/i;

async function cancelPost(id: string): Promise<void> {
  try {
    await markPostAsCanceled(id);
  } catch {
    if (isPosterPgConfigured()) {
      await pgMarkCanceled(id);
    } else {
      throw new Error(`Failed to cancel ${id}`);
    }
  }
}

async function main() {
  const scheduled = await getPostsByStatus("scheduled", 200);
  const smoke = scheduled.filter((p) => SMOKE_PATTERN.test(p.text));

  if (smoke.length === 0) {
    console.log("No smoke posts found.");
    return;
  }

  for (const p of smoke) {
    await cancelPost(p.id);
    console.log("canceled:", p.id.slice(0, 8), p.publish_at, p.text);
  }

  const after = await getPostsByStatus("scheduled", 200);
  console.log("scheduled remaining:", after.length);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
