import { getPostsByStatus, markPostAsCanceled } from "../lib/poster/storage";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  const posts = await getPostsByStatus("scheduled", 200);
  for (const p of posts) {
    if (p.text.length > 2000) {
      console.log("cancel mega-post", p.id.slice(0, 8), "len", p.text.length);
      await markPostAsCanceled(p.id);
    } else {
      console.log("keep", p.id.slice(0, 8), p.publish_at, "len", p.text.length);
    }
  }
}

main();
