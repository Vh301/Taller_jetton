import { getPostsByStatus } from "../lib/poster/storage";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const posts = await getPostsByStatus("scheduled", 200);
  posts.sort((a, b) => a.publish_at.localeCompare(b.publish_at));
  console.log("scheduled count:", posts.length);
  for (const p of posts) {
    console.log(p.publish_at, p.id.slice(0, 8), "len", p.text.length, p.text.slice(0, 50));
  }
}

main();
