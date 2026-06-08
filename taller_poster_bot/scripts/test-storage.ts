import {
  getPosterStorageBackend,
  getUpcomingPosts,
  isPosterStorageConfigured,
} from "../lib/poster/storage";
import { loadPosterEnv } from "./load-env";

loadPosterEnv();

async function main() {
  console.log("isPosterStorageConfigured:", isPosterStorageConfigured());
  console.log("storage backend:", getPosterStorageBackend());
  const posts = await getUpcomingPosts(3);
  console.log("upcoming posts:", posts.length);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
