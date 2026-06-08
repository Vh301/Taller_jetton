import { loadTestnetJettonMaster } from "../lib/phase-b-guard";

async function main() {
  const master = loadTestnetJettonMaster();
  console.log("Phase B: read-only jetton stats for", master);
  throw new Error("Phase B: check-jetton-stats.ts is not implemented yet.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
