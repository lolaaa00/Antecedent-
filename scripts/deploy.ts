/**
 * Deploys AntecedentNotary and AntecedentGate to GenLayer Studionet (61999)
 * using a funded signer, and records real, verifiable deployment evidence.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx scripts/deploy.ts
 *
 * PRIVATE_KEY must never be committed. This script reads it only from the
 * environment and never writes it to disk or logs.
 *
 * Requires: an account funded with GEN on Studionet. Without one, this
 * script fails fast rather than fabricating a deployment record.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { createClient, createAccount } from "genlayer-js";
import { NETWORK, CANONICAL_CHAIN_ID, assertCanonicalNetworkOrThrow } from "../lib/genlayer/network";

async function deployOne(client: ReturnType<typeof createClient>, path: string, label: string, args: unknown[] = []) {
  const code = readFileSync(path);
  const sha256 = createHash("sha256").update(code).digest("hex");

  console.log(`\n[${label}] deploying ${path} (${code.length} bytes, sha256 ${sha256})`);

  const txHash = await client.deployContract({ code, args: args as never[] });
  console.log(`[${label}] deploy tx: ${txHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as never,
    status: "FINALIZED" as never,
    retries: 60,
    interval: 3000,
  });

  const decoded = (receipt as { txDataDecoded?: { contractAddress?: string } }).txDataDecoded;
  const address = decoded?.contractAddress;
  const statusName = (receipt as { statusName?: string }).statusName;
  const executionResultName = (receipt as { txExecutionResultName?: string }).txExecutionResultName;

  if (!address) {
    throw new Error(`[${label}] deployment did not return a contract address — receipt: ${JSON.stringify(receipt)}`);
  }

  return { label, path, sha256, bytes: code.length, txHash, address, statusName, executionResultName };
}

async function main() {
  assertCanonicalNetworkOrThrow(NETWORK);

  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    console.error("PRIVATE_KEY env var is required (funded Studionet signer). Refusing to fabricate a deployment.");
    process.exit(1);
  }

  const account = createAccount(privateKey);
  const client = createClient({ chain: NETWORK, account });

  console.log(`Signer: ${account.address}`);
  console.log(`Chain : ${NETWORK.id} (expected ${CANONICAL_CHAIN_ID})`);

  const gitSha = execSync("git rev-parse HEAD").toString().trim();

  const notary = await deployOne(client, "contracts/antecedent_notary.py", "AntecedentNotary");
  const gate = await deployOne(client, "contracts/antecedent_gate.py", "AntecedentGate");
  const consumer = await deployOne(
    client,
    "contracts/antecedent_consumer.py",
    "MigrationExecutionConsumer",
    [gate.address],
  );

  const record = {
    network: { chainId: NETWORK.id, rpc: NETWORK.rpcUrls?.default?.http?.[0] },
    gitSha,
    signer: account.address,
    deployedAt: new Date().toISOString(),
    contracts: [notary, gate, consumer],
  };

  writeFileSync("docs/DEPLOYMENT_RECORD.json", JSON.stringify(record, null, 2));
  console.log("\nWrote docs/DEPLOYMENT_RECORD.json");
  console.log(
    `\nSet these in .env.local:\nNEXT_PUBLIC_NOTARY_ADDRESS=${notary.address}\nNEXT_PUBLIC_GATE_ADDRESS=${gate.address}\nNEXT_PUBLIC_CONSUMER_ADDRESS=${consumer.address}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
