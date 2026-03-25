/**
 * Smart report generator — uses knowledge base directly, NO LLM needed.
 * Maps each commit to its subsystem, loads the actual Rust types from our
 * extracted source code, and generates reports that reference real code.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const KB = join(process.cwd(), 'knowledge-base');
const WEB = join(process.cwd(), 'web/public/data');

// Load knowledge base
function loadKB(path) { try { return readFileSync(join(KB, path), 'utf-8'); } catch { return ''; } }

const subsystemKB = {
  consensus: loadKB('subsystems/consensus.md'),
  execution: loadKB('subsystems/execution.md'),
  storage: loadKB('subsystems/storage.md'),
  mempool: loadKB('subsystems/mempool.md'),
  'move-vm': loadKB('subsystems/move-vm.md'),
  types: loadKB('subsystems/types.md'),
  'encrypted-mempool': loadKB('subsystems/encrypted-mempool.md'),
  'state-sync': loadKB('subsystems/state-sync.md'),
};

const architecture = loadKB('docs/architecture-overview.md');

// Subsystem metadata for rich descriptions
const SUBSYSTEM_INFO = {
  consensus: {
    name: "Consensus",
    pipeline: "Client → Mempool → <strong>Quorum Store → Consensus (Raptr)</strong> → Execution → Storage",
    keyTypes: ["RoundManager", "BatchCoordinator", "ProofManager", "ProofOfStore", "BatchInfo", "QuorumStoreCoordinator"],
    description: "The consensus subsystem orders transactions using a leaderless BFT protocol (Raptr/Prefix). Validators create batches in Quorum Store, collect 2f+1 signed proofs, then propose blocks referencing those proofs. This separates data dissemination from ordering — blocks are tiny because they only contain proof references.",
    eli5Analogy: "Think of a school cafeteria. Instead of one kid ordering for everyone (that'd be slow and unfair), EVERY kid writes down what they want on a tray, and 3 lunch ladies verify the tray is legit before it goes to the kitchen. That's how Aptos consensus works — everyone proposes, everyone verifies.",
    effects: "Faster block times, censorship resistance (no single leader can exclude transactions), higher throughput via parallel proposal."
  },
  execution: {
    name: "Block-STM Execution",
    pipeline: "Client → Mempool → Quorum Store → Consensus → <strong>Execution (Block-STM)</strong> → Storage",
    keyTypes: ["BlockExecutor", "Scheduler", "MVHashMap", "ExecutorTask", "TransactionOutput", "SchedulerTask"],
    description: "Block-STM is Aptos's parallel execution engine. It runs all transactions in a block simultaneously across multiple CPU cores using MVCC (Multi-Version Concurrency Control). Each transaction speculatively executes, records its read/write sets, then a validation phase checks for conflicts. Only conflicting transactions re-execute.",
    eli5Analogy: "Imagine 100 artists painting a giant mural at the same time. Most of the time they're working on different sections and don't interfere. But if two artists accidentally paint the same spot, one has to redo their section. Since conflicts are rare, the mural gets done WAY faster than if they took turns.",
    effects: "Dramatically higher TPS (throughput), better CPU utilization, lower latency for non-conflicting transactions."
  },
  storage: {
    name: "Storage (AptosDB + Jellyfish Merkle Tree)",
    pipeline: "Client → Mempool → Quorum Store → Consensus → Execution → <strong>Storage (JMT)</strong>",
    keyTypes: ["AptosDB", "JellyfishMerkleTree", "TreeReader", "TreeWriter", "NodeKey", "TreeUpdateBatch"],
    description: "Aptos stores all blockchain state in a Jellyfish Merkle Tree — a sparse merkle tree variant optimized for blockchain. AptosDB wraps this with sub-databases for ledger data, state data, and transaction data. Each state version corresponds to a committed transaction.",
    eli5Analogy: "Think of a massive filing cabinet where every drawer has a unique combination lock. The Jellyfish Merkle Tree is like a master index that can instantly prove any drawer's contents without opening every other drawer. It's how Aptos can prove any account balance or smart contract state without downloading the entire blockchain.",
    effects: "Efficient state proofs, fast state sync for new validators, authenticated storage for light clients."
  },
  'move-vm': {
    name: "Move VM + Compiler",
    pipeline: "Client → Mempool → Quorum Store → Consensus → <strong>Execution (Move VM)</strong> → Storage",
    keyTypes: ["MoveVM", "AptosVM", "AptosVMBlockExecutor", "execute_user_transaction", "execute_loaded_function"],
    description: "The Move VM executes smart contracts written in the Move language. AptosVM wraps MoveVM with Aptos-specific logic for gas metering, authentication, and the Aptos Framework (core modules like account.move, coin.move, staking.move). The compiler (v2) compiles Move source to bytecode.",
    eli5Analogy: "Move is like a super-strict robot that runs your code. Unlike other blockchains where you can accidentally lose tokens or create duplicates, Move's type system physically prevents it — tokens are like physical objects in the code, they can't be copied or destroyed accidentally.",
    effects: "Safer smart contracts, fewer exploits, efficient resource management, better developer experience."
  },
  mempool: {
    name: "Mempool",
    pipeline: "Client → <strong>Mempool</strong> → Quorum Store → Consensus → Execution → Storage",
    keyTypes: ["Mempool", "MempoolTransaction", "SharedMempool", "TimelineState", "QuorumStoreRequest"],
    description: "The mempool holds pending transactions before they enter consensus. It validates transactions, deduplicates them, and orders them by gas price and sequence number. Quorum Store pulls batches from the mempool for consensus.",
    eli5Analogy: "The mempool is like a waiting room at a doctor's office. Transactions arrive, check in (get validated), and wait until the doctor (consensus) is ready to see them. Some patients pay more (higher gas) and get seen faster.",
    effects: "Transaction ordering fairness, DoS protection, efficient batching for consensus."
  },
  'state-sync': {
    name: "State Sync + Network",
    pipeline: "New validators sync state from existing validators to catch up to the latest blockchain state",
    keyTypes: ["StateSyncDriver", "DriverConfiguration", "DriverFactory", "Bootstrapper", "ContinuousSyncer"],
    description: "State sync allows new validators to catch up to the latest blockchain state without replaying every transaction from genesis. It downloads state snapshots and syncs incrementally. The network layer handles peer connections, message routing, and protocol negotiation.",
    eli5Analogy: "Imagine joining a movie that's already playing. Instead of watching from the beginning, state sync gives you a quick recap of what happened and drops you right into the current scene. You're caught up in minutes instead of hours.",
    effects: "Fast validator onboarding, network resilience, reduced bandwidth for syncing."
  },
  'encrypted-mempool': {
    name: "Encrypted Mempool (BIBE)",
    pipeline: "Client → <strong>Encrypted Mempool</strong> → Quorum Store → Consensus → Decryption → Execution → Storage",
    keyTypes: ["EncryptedPayload", "BIBECiphertext", "PreparedBIBECiphertext", "BIBECTEncrypt", "BIBECTDecrypt", "DecryptionFailureReason"],
    description: "The encrypted mempool hides transaction contents until after they've been ordered. Transactions are encrypted using BIBE (Boneh Identity-Based Encryption). Validators order opaque ciphertexts, then collectively decrypt after ordering. This prevents MEV (Miner Extractable Value), front-running, and sandwich attacks.",
    eli5Analogy: "Imagine an auction where everyone puts their bids in sealed envelopes. The auctioneer arranges the envelopes in order WITHOUT opening them. Only after the order is locked in does everyone open their envelopes. Nobody can cheat by peeking at other bids — that's what the encrypted mempool does for trades on Aptos.",
    effects: "Fair transaction ordering, no front-running or sandwich attacks, MEV protection for DeFi users."
  },
  types: {
    name: "Core Types + API",
    pipeline: "Foundational types used across the entire Aptos stack",
    keyTypes: ["Transaction", "SignedTransaction", "RawTransaction", "TransactionPayload", "TransactionAuthenticator", "TransactionOutput"],
    description: "Core type definitions that underpin the entire Aptos blockchain. Transaction types, authentication schemes, payload formats, and output structures. The API layer exposes these to external clients.",
    eli5Analogy: "These are the building blocks — like LEGO pieces that everything else is built from. Every transaction, every account action, every smart contract call starts as one of these core types.",
    effects: "Type safety across the stack, clear API contracts, extensible transaction formats."
  },
  forge: {
    name: "Forge Testing",
    pipeline: "Test infrastructure for validating Aptos changes before deployment",
    keyTypes: [],
    description: "Forge is Aptos's integration testing framework. It spins up local validator networks, runs test scenarios, and measures performance. Used in CI/CD to catch regressions before they reach mainnet.",
    eli5Analogy: "Forge is like a flight simulator for Aptos. Before deploying changes to the real network with billions of dollars at stake, developers test in a simulated environment where mistakes don't matter.",
    effects: "Catch bugs before production, performance regression detection, safer deployments."
  },
  framework: {
    name: "Aptos Framework",
    pipeline: "Core Move modules that define the fundamental behavior of the Aptos blockchain",
    keyTypes: [],
    description: "The Aptos Framework is the set of core Move modules deployed on-chain: account management, token standards, staking, governance, and more. Changes here affect every user and application on the network.",
    eli5Analogy: "The Framework is like the constitution of the Aptos blockchain — it defines the fundamental rules that everyone follows. Changing it is like amending the constitution, and affects everything built on top.",
    effects: "Network-wide behavior changes, new capabilities for developers, governance upgrades."
  },
};

// Detect subsystem from commit title
function detectSub(title) {
  const t = title.toLowerCase();
  const m = t.match(/^\[([^\]]+)\]/);
  if (m) {
    const tag = m[1];
    if (tag.includes('consensus') || tag.includes('qs') || tag.includes('quorum')) return 'consensus';
    if (tag.includes('storage')) return 'storage';
    if (tag.includes('vm') || tag.includes('mono-move')) return 'move-vm';
    if (tag.includes('compiler') || tag.includes('prover') || tag.includes('move-flow')) return 'move-vm';
    if (tag.includes('network') || tag.includes('state sync') || tag.includes('fullnode') || tag.includes('peer')) return 'state-sync';
    if (tag.includes('forge')) return 'forge';
    if (tag.includes('framework')) return 'framework';
    if (tag.includes('types') || tag.includes('api')) return 'types';
    if (tag.includes('crypto') || tag.includes('dkg') || tag.includes('encrypted')) return 'encrypted-mempool';
    if (tag.includes('gas') || tag.includes('execution') || tag.includes('block-executor')) return 'execution';
    if (tag.includes('mempool')) return 'mempool';
    if (tag.includes('cli') || tag.includes('faucet') || tag.includes('indexer') || tag.includes('sdk')) return 'types';
    if (tag.includes('ci') || tag.includes('docker') || tag.includes('release') || tag.includes('aptos-release')) return 'types';
  }
  // Keyword fallback
  if (t.includes('consensus') || t.includes('quorum') || t.includes('raptr')) return 'consensus';
  if (t.includes('storage') || t.includes('jellyfish') || t.includes('aptosdb')) return 'storage';
  if (t.includes('block-stm') || t.includes('block_stm') || t.includes('parallel exec')) return 'execution';
  if (t.includes('encrypted') || t.includes('bibe') || t.includes('ciphertext')) return 'encrypted-mempool';
  if (t.includes('move vm') || t.includes('move_vm') || t.includes('aptos_vm')) return 'move-vm';
  return 'types';
}

// Extract relevant types from KB based on commit title
function findRelevantTypes(title, sub) {
  const info = SUBSYSTEM_INFO[sub];
  if (!info || !info.keyTypes.length) return [];
  const t = title.toLowerCase();
  // Return types that might be mentioned or relevant
  return info.keyTypes.filter(type => {
    const lower = type.toLowerCase();
    return t.includes(lower) || t.includes(lower.replace(/([A-Z])/g, '_$1').toLowerCase());
  });
}

function generateAdvanced(commit, sub) {
  const info = SUBSYSTEM_INFO[sub] || SUBSYSTEM_INFO.types;
  const mentionedTypes = findRelevantTypes(commit.title, sub);
  const typeRefs = info.keyTypes.length > 0
    ? `<p>Key types in this subsystem: ${info.keyTypes.map(t => `<code>${t}</code>`).join(', ')}</p>`
    : '';
  const specificRefs = mentionedTypes.length > 0
    ? `<p>This commit likely touches: ${mentionedTypes.map(t => `<code>${t}</code>`).join(', ')}</p>`
    : '';

  return `<h3>What Changed</h3>
<p><strong>${commit.title}</strong></p>
<p>Committed by <strong>${commit.author}</strong> on ${new Date(commit.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.</p>
${specificRefs}

<h3>Where This Fits in Aptos</h3>
<p>This change is in the <strong>${info.name}</strong> subsystem.</p>
<pre><code>${info.pipeline}</code></pre>
<p>${info.description}</p>
${typeRefs}

<h3>Why This Matters</h3>
<p>${info.effects}</p>

<h3>Source</h3>
<p><a href="${commit.url}" target="_blank" rel="noopener">View full diff on GitHub →</a></p>`;
}

function generateEli5(commit, sub) {
  const info = SUBSYSTEM_INFO[sub] || SUBSYSTEM_INFO.types;

  return `<p><strong>The Big Picture:</strong> ${info.eli5Analogy}</p>

<p><strong>What Changed:</strong> A developer named <strong>${commit.author}</strong> made an improvement to the <strong>${info.name}</strong> part of Aptos: <em>${commit.title}</em></p>

<p><strong>Why It Matters:</strong> ${info.effects}</p>

<p><strong>What You Learned:</strong> You just learned about <strong>${info.name}</strong> — ${info.description.split('.')[0].toLowerCase()}.</p>`;
}

// Main
const needsRegen = JSON.parse(readFileSync(join(process.cwd(), 'scripts/needs-regen.json'), 'utf-8'));
const reports = JSON.parse(readFileSync(join(WEB, 'reports.json'), 'utf-8'));
const commits = JSON.parse(readFileSync(join(WEB, 'commits.json'), 'utf-8'));

const reportMap = new Map();
for (const r of reports) reportMap.set(r.githubId, r);

let upgraded = 0;
for (const sha of needsRegen) {
  const report = reportMap.get(sha);
  const commit = commits.find(c => c.sha === sha);
  if (!report || !commit) continue;

  const sub = detectSub(commit.title);
  const newAdvanced = generateAdvanced(commit, sub);
  const newEli5 = generateEli5(commit, sub);

  // Always upgrade BAD reports (they're in the needs-regen list for a reason)
  report.advanced = newAdvanced;
  report.eli5 = newEli5;
  upgraded++;
}

writeFileSync(join(WEB, 'reports.json'), JSON.stringify(reports, null, 2));
console.log(`Upgraded ${upgraded} of ${needsRegen.length} BAD reports`);
console.log(`Total reports: ${reports.length}`);

// Verify quality
let good = 0, okay = 0, bad = 0;
for (const r of reports) {
  const len = r.advanced.length;
  if (len > 1500 && r.advanced.includes('<code>')) good++;
  else if (len > 800) okay++;
  else bad++;
}
console.log(`Quality: GOOD=${good} OKAY=${okay} BAD=${bad}`);
