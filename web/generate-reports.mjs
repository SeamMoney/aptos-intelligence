import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const commits = JSON.parse(readFileSync(join(__dirname, "public/data/commits.json"), "utf-8"));
const existingReports = JSON.parse(readFileSync(join(__dirname, "public/data/reports.json"), "utf-8"));

// Build a set of existing report titles (lowered, first 25 chars) for matching
const existingTitlePrefixes = new Set(
  existingReports.map(r => r.title.toLowerCase().slice(0, 25))
);

// Also build a set of existing githubIds
const existingGithubIds = new Set(existingReports.map(r => r.githubId));

// Tag -> subsystem mapping
const TAG_SUBSYSTEM = {
  consensus: { name: "Consensus (Raptr / Quorum Store)", desc: "The consensus subsystem is responsible for ordering transactions across validators using the Raptr protocol and Quorum Store for batch dissemination.", color: "#00c853", stage: "Consensus" },
  storage: { name: "Storage (Jellyfish Merkle Tree)", desc: "The storage subsystem maintains the authenticated state database using Jellyfish Merkle Trees and RocksDB.", color: "#6b7280", stage: "Storage" },
  vm: { name: "Move VM", desc: "The Move Virtual Machine executes smart contracts written in the Move language, providing resource-oriented programming safety guarantees.", color: "#f59e0b", stage: "Execution" },
  "mono-move": { name: "MonoMove Runtime", desc: "MonoMove is a next-generation Move VM runtime with global arena allocation, identifier interning, and garbage collection for improved performance.", color: "#f59e0b", stage: "Execution" },
  "compiler-v2": { name: "Move Compiler v2", desc: "The Move Compiler v2 introduces pattern matching, improved type inference, and advanced language features for the Move programming language.", color: "#f59e0b", stage: "Execution" },
  forge: { name: "Forge Test Framework", desc: "Forge is Aptos's end-to-end testing framework for running network tests, benchmarks, and deployments on Kubernetes.", color: "#6b7280", stage: "Testing / CI" },
  ci: { name: "CI / Build Infrastructure", desc: "The CI pipeline ensures code quality through automated testing, building, and deployment workflows.", color: "#6b7280", stage: "Testing / CI" },
  prover: { name: "Move Prover", desc: "The Move Prover provides formal verification for Move smart contracts, ensuring correctness through mathematical proofs.", color: "#7c3aed", stage: "Verification" },
  localnet: { name: "Local Development (Localnet)", desc: "Localnet provides a local development environment for testing Aptos applications without connecting to a live network.", color: "#6b7280", stage: "Development" },
  types: { name: "Core Types", desc: "Core type definitions shared across the Aptos codebase, including transaction types, cryptographic primitives, and protocol messages.", color: "#6b7280", stage: "Core" },
  api: { name: "REST API / gRPC", desc: "The API layer exposes blockchain data and transaction submission endpoints for clients, indexers, and tooling.", color: "#14b8a6", stage: "Client Interface" },
  gas: { name: "Gas Metering", desc: "The gas metering system measures computational and storage costs of transactions to ensure fair resource pricing.", color: "#ff4d00", stage: "Execution" },
  execution: { name: "Execution (Block-STM)", desc: "The Block-STM execution engine processes transactions in parallel using optimistic concurrency control (MVCC).", color: "#ff4d00", stage: "Execution" },
  "aptos cli": { name: "Aptos CLI", desc: "The Aptos CLI is the command-line interface for interacting with the Aptos blockchain, managing accounts, and deploying contracts.", color: "#6b7280", stage: "Client" },
  CLI: { name: "Aptos CLI", desc: "The Aptos CLI is the command-line interface for interacting with the Aptos blockchain.", color: "#6b7280", stage: "Client" },
  test: { name: "Testing", desc: "Test infrastructure ensuring correctness and reliability of Aptos components.", color: "#6b7280", stage: "Testing / CI" },
  stake: { name: "Staking", desc: "The staking module manages validator stake, delegation, and voting power calculations.", color: "#0047ff", stage: "Framework" },
  keyless: { name: "Keyless Authentication", desc: "Keyless authentication allows users to authenticate with the Aptos blockchain using social login providers (Google, Apple, etc.) without managing private keys.", color: "#14b8a6", stage: "Authentication" },
  decompiler: { name: "Move Decompiler", desc: "The Move decompiler converts compiled Move bytecode back into human-readable source code.", color: "#f59e0b", stage: "Tooling" },
  "move compiler v2": { name: "Move Compiler v2", desc: "The Move Compiler v2 introduces pattern matching, improved type inference, and advanced language features.", color: "#f59e0b", stage: "Execution" },
  "move flow": { name: "Move Flow (MCP Server)", desc: "Move Flow provides AI-assisted development tools for the Move language through an MCP server.", color: "#f59e0b", stage: "Tooling" },
  "Fullnode Sync": { name: "Fullnode State Sync", desc: "State synchronization allows fullnodes to sync blockchain state from validators efficiently.", color: "#6b7280", stage: "Networking" },
  "Consensus Observer": { name: "Consensus Observer", desc: "Consensus Observer allows fullnodes to observe consensus without participating, enabling lighter-weight nodes.", color: "#00c853", stage: "Consensus" },
  Forge: { name: "Forge Test Framework", desc: "Forge is Aptos's end-to-end testing framework.", color: "#6b7280", stage: "Testing / CI" },
  QS: { name: "Quorum Store", desc: "The Quorum Store handles batch dissemination and proof collection for transactions before consensus ordering.", color: "#0047ff", stage: "Consensus" },
  cp: { name: "Move VM Patches", desc: "Cherry-picked fixes for the Move VM runtime to address correctness and stability issues.", color: "#ef4444", stage: "Execution" },
  "encrypted mempool": { name: "Encrypted Mempool (BIBE)", desc: "The encrypted mempool uses Blind Identity-Based Encryption (BIBE) to hide transaction contents until after ordering, preventing MEV extraction.", color: "#ef4444", stage: "Mempool" },
  repo: { name: "Repository Management", desc: "Repository configuration, code ownership, and organizational structure.", color: "#6b7280", stage: "Infrastructure" },
  Config: { name: "Node Configuration", desc: "Configuration optimization for validator and fullnode network settings.", color: "#6b7280", stage: "Infrastructure" },
  Network: { name: "Networking Layer", desc: "The peer-to-peer networking layer handles validator-to-validator and validator-to-fullnode communication.", color: "#14b8a6", stage: "Networking" },
  "Peer Monitoring Service": { name: "Peer Monitoring", desc: "Monitors peer health, distance, and connectivity for network optimization.", color: "#14b8a6", stage: "Networking" },
  "State Sync": { name: "State Synchronization", desc: "State sync enables nodes to efficiently synchronize blockchain state, supporting both bootstrapping and continuous sync.", color: "#6b7280", stage: "Networking" },
  "Smoke Tests": { name: "Smoke Tests", desc: "Smoke tests provide quick validation of core functionality after code changes.", color: "#6b7280", stage: "Testing / CI" },
  "aptos-release": { name: "Release Management", desc: "Release management for Aptos node versions, including version bumps and release branches.", color: "#0047ff", stage: "Release" },
};

// Importance by category
const CAT_IMPORTANCE = {
  Release: 5,
  Security: 7,
  "Feature Progress": 6,
  Performance: 6,
  Infrastructure: 3,
};

// Extract tag from title like "[consensus] ..." or "[vm] ..."
function extractTag(title) {
  const match = title.match(/^\[([^\]]+)\]/);
  if (match) return match[1].trim();
  return null;
}

function getSubsystem(tag, title, category) {
  if (tag && TAG_SUBSYSTEM[tag]) return TAG_SUBSYSTEM[tag];

  // Try case-insensitive match
  if (tag) {
    const lowerTag = tag.toLowerCase();
    for (const [k, v] of Object.entries(TAG_SUBSYSTEM)) {
      if (k.toLowerCase() === lowerTag) return v;
    }
  }

  // Infer from title content
  const t = title.toLowerCase();
  if (t.includes("consensus") || t.includes("quorum store") || t.includes("qs ")) return TAG_SUBSYSTEM.consensus;
  if (t.includes("storage") || t.includes("merkle") || t.includes("jmt") || t.includes("rocksdb")) return TAG_SUBSYSTEM.storage;
  if (t.includes("move vm") || t.includes("mono-move") || t.includes("monomove")) return TAG_SUBSYSTEM["mono-move"];
  if (t.includes("compiler") || t.includes("compiler-v2")) return TAG_SUBSYSTEM["compiler-v2"];
  if (t.includes("encrypted") || t.includes("ciphertext") || t.includes("decryption")) return TAG_SUBSYSTEM["encrypted mempool"];
  if (t.includes("confidential")) return { name: "Confidential Assets", desc: "Confidential asset transfers using zero-knowledge proofs for privacy-preserving transactions.", color: "#ef4444", stage: "Framework" };
  if (t.includes("dkg") || t.includes("dekart")) return { name: "Distributed Key Generation (DKG)", desc: "Distributed Key Generation enables validators to collaboratively generate shared cryptographic keys for threshold signatures and encrypted transactions.", color: "#7c3aed", stage: "Cryptography" };
  if (t.includes("faucet")) return { name: "Faucet", desc: "The faucet provides test tokens on devnet/testnet for development and testing purposes.", color: "#6b7280", stage: "Infrastructure" };
  if (t.includes("docker")) return { name: "Docker / Containerization", desc: "Docker images and container configuration for deploying Aptos nodes.", color: "#6b7280", stage: "Infrastructure" };
  if (t.includes("helm") || t.includes("pfn")) return { name: "Deployment (Helm/K8s)", desc: "Kubernetes and Helm-based deployment infrastructure for Aptos nodes.", color: "#6b7280", stage: "Infrastructure" };
  if (t.includes("formatter")) return { name: "Move Formatter", desc: "Code formatting tool for the Move programming language.", color: "#f59e0b", stage: "Tooling" };
  if (t.includes("nextest")) return { name: "CI / Build Infrastructure", desc: "Testing and build tooling for continuous integration.", color: "#6b7280", stage: "Testing / CI" };
  if (t.includes("network") || t.includes("peer") || t.includes("upstream")) return TAG_SUBSYSTEM.Network;
  if (t.includes("state sync")) return TAG_SUBSYSTEM["State Sync"];

  // Default by category
  if (category === "Performance") return TAG_SUBSYSTEM.storage;
  if (category === "Security") return { name: "Security / Correctness", desc: "Security fixes and correctness improvements across the Aptos codebase.", color: "#ef4444", stage: "Various" };
  if (category === "Release") return { name: "Release Management", desc: "Version releases, deployer updates, and release infrastructure.", color: "#0047ff", stage: "Release" };

  return { name: "Aptos Core", desc: "General improvements to the Aptos blockchain core infrastructure.", color: "#6b7280", stage: "Various" };
}

function generatePipelineDiagram(stage) {
  const stages = [
    { name: "Client", key: "Client" },
    { name: "Mempool", key: "Mempool" },
    { name: "Quorum Store", key: "Consensus" },
    { name: "Consensus (Raptr)", key: "Consensus" },
    { name: "Execution (Block-STM)", key: "Execution" },
    { name: "Storage (JMT)", key: "Storage" },
  ];

  const parts = stages.map(s => {
    const isActive = s.key === stage || s.name.toLowerCase().includes(stage.toLowerCase());
    return isActive ? `<strong style="color:#0047ff">${s.name}</strong>` : s.name;
  });

  return `<pre><code>${parts.join(" → ")}</code></pre>`;
}

function generateAdvanced(commit, tag, subsystem) {
  const titleClean = commit.title.replace(/\[.*?\]\s*/g, "").replace(/#\d+/g, "").trim();

  return `<h3>What Changed</h3>
<p>This commit by <strong>${commit.author}</strong> ${getCategoryVerb(commit.category)} in the <strong>${subsystem.name}</strong> subsystem. ${titleClean.endsWith(".") ? titleClean : titleClean + "."}</p>
<p>${subsystem.desc}</p>

<h3>Where This Fits in Aptos</h3>
<p>This change applies to the <strong>${subsystem.stage}</strong> stage of the Aptos transaction lifecycle:</p>
${generatePipelineDiagram(subsystem.stage)}

<h3>Technical Context</h3>
<p>${getTechnicalContext(commit, tag, subsystem)}</p>

<h3>Why This Matters</h3>
<p>${getWhyMatters(commit, subsystem)}</p>

<h3>Source</h3>
<p>Commit <code>${commit.sha}</code> by ${commit.author} on ${new Date(commit.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>`;
}

function getCategoryVerb(category) {
  switch (category) {
    case "Release": return "ships a release update";
    case "Security": return "addresses a security or correctness concern";
    case "Feature Progress": return "advances a feature implementation";
    case "Performance": return "improves performance";
    case "Infrastructure": return "updates infrastructure";
    default: return "makes changes";
  }
}

function getTechnicalContext(commit, tag, subsystem) {
  const t = commit.title.toLowerCase();

  if (t.includes("encrypted") || t.includes("ciphertext") || t.includes("decryption")) {
    return "The encrypted mempool (BIBE — Blind Identity-Based Encryption) is a privacy feature that hides transaction contents from validators until after ordering. This prevents Maximal Extractable Value (MEV) attacks where validators could front-run or reorder transactions for profit. Validators only see encrypted blobs during consensus; decryption happens after the ordering is finalized.";
  }
  if (t.includes("consensus") || t.includes("quorum store") || tag === "consensus" || tag === "QS") {
    return "The Aptos consensus layer uses Raptr (a leaderless multi-proposer BFT protocol) with Quorum Store for batch dissemination. Validators collect transaction batches, exchange availability proofs, and agree on an ordered sequence of blocks. The Quorum Store ensures that transaction data is available before it enters consensus, reducing redundant data transfer.";
  }
  if (t.includes("storage") || t.includes("hot state") || t.includes("kv") || tag === "storage") {
    return "Aptos storage uses the Jellyfish Merkle Tree (JMT) backed by RocksDB for persistent authenticated state. The hot state cache keeps frequently accessed state values in memory to avoid disk reads during execution. Changes here affect the critical path of state reads and writes during block execution.";
  }
  if (t.includes("mono-move") || t.includes("monomove") || tag === "mono-move") {
    return "MonoMove is a next-generation Move VM runtime that uses global arena allocation, identifier interning, and a garbage collector to dramatically reduce memory allocation overhead. It aims to be a drop-in replacement for the current Move VM with significantly better performance characteristics.";
  }
  if (t.includes("compiler") || tag === "compiler-v2" || tag === "move compiler v2") {
    return "Move Compiler v2 is a ground-up rewrite of the Move compiler with modern language features including pattern matching over structs and enums, improved type inference with constraint unification, and better error reporting. It compiles Move source code into bytecode that runs on the Move VM.";
  }
  if (t.includes("confidential")) {
    return "Confidential Assets enable privacy-preserving token transfers on Aptos using zero-knowledge proofs. Users can transfer tokens without revealing amounts to observers, while still allowing the network to verify correctness. This is built as a Move framework module.";
  }
  if (t.includes("prover") || tag === "prover") {
    return "The Move Prover uses formal verification to mathematically prove that Move smart contracts satisfy their specifications. It translates Move code and specs into verification conditions that are checked by an SMT solver, catching bugs that testing alone might miss.";
  }
  if (t.includes("gas") || tag === "gas") {
    return "Aptos gas metering measures the computational and storage costs of each transaction. Gas costs are calibrated to reflect actual resource usage and prevent denial-of-service attacks. Storage fees are separate from execution gas and are charged for on-chain state growth.";
  }
  if (t.includes("forge") || tag === "forge" || tag === "Forge") {
    return "Forge is Aptos's comprehensive testing framework that spins up entire test networks (swarms) on Kubernetes or locally. It supports running performance benchmarks, chaos tests, and smoke tests against realistic network configurations.";
  }
  if (t.includes("dkg") || t.includes("dekart")) {
    return "Distributed Key Generation (DKG) allows validators to collaboratively generate cryptographic keys without any single party knowing the full key. This is essential for threshold cryptography features like the encrypted mempool and on-chain randomness.";
  }
  if (t.includes("network") || t.includes("peer") || t.includes("upstream") || tag === "Network") {
    return "The Aptos networking layer manages peer-to-peer connections between validators and fullnodes. It handles peer discovery, connection management, message routing, and priority-based peer selection for optimal network performance.";
  }
  if (t.includes("state sync") || tag === "State Sync") {
    return "State synchronization enables new or restarted nodes to catch up to the latest blockchain state by downloading and verifying state data from peers. It supports both bootstrapping (syncing from genesis) and continuous sync (staying up to date).";
  }

  return `This change touches the ${subsystem.name} subsystem. ${subsystem.desc}`;
}

function getWhyMatters(commit, subsystem) {
  const cat = commit.category;
  if (cat === "Security") {
    return "Security and correctness fixes are critical for maintaining the integrity of the Aptos blockchain. Even small bugs in consensus, execution, or cryptographic code can have outsized impact on network safety and user funds.";
  }
  if (cat === "Performance") {
    return "Performance improvements in the storage and execution layers directly impact Aptos's throughput and latency. Faster state access means more transactions per second and lower confirmation times for users.";
  }
  if (cat === "Feature Progress") {
    return `This advances the ${subsystem.name} feature, bringing it closer to production readiness. New features expand what developers and users can do on Aptos, from privacy-preserving transactions to improved smart contract capabilities.`;
  }
  if (cat === "Release") {
    return "Release management ensures that tested, stable code reaches validators and node operators. Proper versioning and deployment processes are essential for network upgrades without disruption.";
  }
  return "Infrastructure improvements keep the development and testing pipeline healthy, enabling faster iteration and higher code quality across the Aptos project.";
}

function generateEli5(commit, tag, subsystem) {
  const cat = commit.category;
  const titleClean = commit.title.replace(/\[.*?\]\s*/g, "").replace(/#\d+/g, "").replace(/\(.*?\)/g, "").trim();

  let analogy, explanation;

  if (cat === "Security") {
    analogy = `Think of the Aptos blockchain as a giant vault that stores everyone's digital assets. Every piece of code that runs on it needs to be rock-solid — even a tiny crack could let something slip through. This change is like a locksmith inspecting and reinforcing one of the locks.`;
    explanation = `The developers found a place in the <strong>${subsystem.name}</strong> system that needed tightening up, and this commit fixes it. It's the kind of behind-the-scenes work that keeps everything safe and running smoothly, even though users never see it directly.`;
  } else if (cat === "Performance") {
    analogy = `Imagine Aptos is a super-fast highway for digital transactions. The faster cars (transactions) can travel, the more useful the highway is. This change is like repaving a section of road so cars can go even faster.`;
    explanation = `This commit improves the <strong>${subsystem.name}</strong> system to work more efficiently. When the blockchain can process things faster, everyone benefits — transactions confirm quicker, and the network can handle more activity.`;
  } else if (cat === "Feature Progress") {
    analogy = `Building a blockchain is like building a spaceship — you add new capabilities one piece at a time. This commit adds another piece to the <strong>${subsystem.name}</strong> module, bringing a new feature closer to launch.`;
    explanation = `The change "${titleClean}" is part of an ongoing effort to make Aptos more capable. Each commit like this is a building block that eventually adds up to something users can see and use.`;
  } else if (cat === "Release") {
    analogy = `When a new version of an app appears on your phone, someone had to package it up and send it out. This commit is part of that process for the Aptos blockchain — making sure the latest improvements reach the people running the network.`;
    explanation = `This is a release or deployment update for the Aptos infrastructure. It ensures that validators and node operators get access to the latest tested version of the software.`;
  } else {
    analogy = `Every building needs a solid foundation — pipes, wiring, and structural supports that you never see but always depend on. This commit is like maintenance work on Aptos's invisible infrastructure.`;
    explanation = `The <strong>${subsystem.name}</strong> system got an update to keep the development and testing pipeline running smoothly. While it's not a flashy new feature, it's essential for the team to keep shipping quality code.`;
  }

  return `<p><strong>The Simple Version:</strong> ${analogy}</p>
<p><strong>What Happened:</strong> ${explanation}</p>`;
}

// Find the max existing report ID
let maxId = Math.max(...existingReports.map(r => r.id), 0);

// Check which commits already have matching reports (by title prefix matching)
function commitHasReport(commit) {
  const prefix = commit.title.slice(0, 25).toLowerCase();
  for (const r of existingReports) {
    if (r.title.toLowerCase().includes(prefix)) return true;
    if (r.githubId === commit.sha) return true;
  }
  return false;
}

const newReports = [];
for (const commit of commits) {
  if (commitHasReport(commit)) {
    console.log(`SKIP (has report): ${commit.sha} — ${commit.title.slice(0, 60)}`);
    continue;
  }

  maxId++;
  const tag = extractTag(commit.title);
  const subsystem = getSubsystem(tag, commit.title, commit.category);

  // Adjust importance based on content
  let importance = CAT_IMPORTANCE[commit.category] || 4;
  const t = commit.title.toLowerCase();
  if (t.includes("encrypted") || t.includes("confidential")) importance = Math.max(importance, 7);
  if (t.includes("mono-move") || t.includes("monomove")) importance = Math.max(importance, 7);
  if (t.includes("hotfix")) importance = Math.max(importance, 8);
  if (t.includes("fix typos") || t.includes("small fix") || t.includes("retry pr")) importance = Math.min(importance, 2);
  if (t.includes("bump deployer")) importance = Math.min(importance, 3);
  if (t.includes("docker images")) importance = Math.min(importance, 3);

  const report = {
    githubId: commit.sha,
    title: commit.title,
    author: commit.author,
    date: commit.date,
    category: commit.category,
    importance,
    sourceUrl: commit.url,
    advanced: generateAdvanced(commit, tag, subsystem),
    eli5: generateEli5(commit, tag, subsystem),
    relatedFeatures: [],
    labels: [],
    id: maxId,
  };

  newReports.push(report);
  console.log(`NEW: ${commit.sha} — ${commit.title.slice(0, 60)}`);
}

console.log(`\n--- Summary ---`);
console.log(`Existing reports: ${existingReports.length}`);
console.log(`New reports generated: ${newReports.length}`);
console.log(`Total reports: ${existingReports.length + newReports.length}`);

// Combine: existing first, then new
const allReports = [...existingReports, ...newReports];
writeFileSync(join(__dirname, "public/data/reports.json"), JSON.stringify(allReports, null, 2));
console.log(`\nWritten to public/data/reports.json`);
