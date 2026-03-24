# Storage Subsystem

Source files:
- `storage/aptosdb/src/db/mod.rs`
- `storage/aptosdb/src/lib.rs`
- `storage/jellyfish-merkle/src/lib.rs`
- `storage/jellyfish-merkle/src/node_type/mod.rs`

---

## AptosDB (`storage/aptosdb/src/db/mod.rs`)

The main database struct holding handles to all sub-databases. Provides APIs for accessing core Aptos data structures. Implements `DbReader` and `DbWriter` traits (in separate modules).

```rust
/// This holds a handle to the underlying DB responsible for physical storage
/// and provides APIs for access to the core Aptos data structures.
pub struct AptosDB {
    pub(crate) ledger_db: Arc<LedgerDb>,
    pub(crate) hot_state_kv_db: Option<Arc<StateKvDb>>,
    pub(crate) state_kv_db: Arc<StateKvDb>,
    pub(crate) event_store: Arc<EventStore>,
    pub(crate) state_store: Arc<StateStore>,
    pub(crate) transaction_store: Arc<TransactionStore>,
    ledger_pruner: LedgerPrunerManager,
    _rocksdb_property_reporter: RocksdbPropertyReporter,
    pre_commit_lock: std::sync::Mutex<()>,
    commit_lock: std::sync::Mutex<()>,
    update_subscriber: Option<Sender<(Instant, Version)>>,
}
```

### Key methods:

```rust
impl AptosDB {
    pub fn open(
        db_paths: StorageDirPaths,
        readonly: bool,
        pruner_config: PrunerConfig,
        rocksdb_configs: RocksdbConfigs,
        buffered_state_target_items: usize,
        max_num_nodes_per_lru_cache_shard: usize,
        internal_indexer_db: Option<InternalIndexerDB>,
        hot_state_config: HotStateConfig,
    ) -> Result<Self>;

    pub fn open_kv_only(...) -> Result<Self>;

    pub fn open_dbs(
        db_paths: &StorageDirPaths,
        rocksdb_configs: RocksdbConfigs,
        env: Option<&Env>,
        block_cache: Option<&Cache>,
        readonly: bool,
        max_num_nodes_per_lru_cache_shard: usize,
        hot_state_config: HotStateConfig,
    ) -> Result<(LedgerDb, Option<StateMerkleDb>, StateMerkleDb, Option<StateKvDb>, StateKvDb)>;

    pub fn add_version_update_subscriber(&mut self) -> ...;
    pub fn get_backup_handler(&self) -> BackupHandler;
    pub fn create_checkpoint(db_path: impl AsRef<Path>, cp_path: impl AsRef<Path>) -> Result<()>;
    pub fn commit_genesis_ledger_info(&self, genesis_li: &LedgerInfoWithSignatures) -> Result<()>;
}
```

### Sub-databases:
- `LedgerDb` - Ledger metadata, transaction info, write sets
- `StateKvDb` - State key-value store (sharded)
- `StateMerkleDb` - State Merkle tree nodes (sharded)
- `EventStore` - Contract events
- `TransactionStore` - Transaction data
- `StateStore` - Buffered state with Merkle tree

### Module organization:
```
storage/aptosdb/src/
  lib.rs            -- re-exports AptosDB from db module
  db/
    mod.rs          -- AptosDB struct definition and constructors
    aptosdb_reader.rs  -- DbReader trait implementation
    aptosdb_writer.rs  -- DbWriter trait implementation
    aptosdb_internal.rs -- Internal helpers
```

---

## JellyfishMerkleTree (`storage/jellyfish-merkle/src/lib.rs`)

A 256-bit sparse Merkle tree optimized for IOPS. Subtrees containing 0 or 1 leaf are replaced by the leaf or a placeholder. InternalNodes compress 4 levels of binary tree into one node with up to 16 children.

### Traits:

```rust
/// Interface between JellyfishMerkleTree and underlying storage holding nodes.
pub trait TreeReader<K> {
    fn get_node(&self, node_key: &NodeKey) -> Result<Node<K>>;
    fn get_node_with_tag(&self, node_key: &NodeKey, tag: &str) -> Result<Node<K>>;
    fn get_node_option(&self, node_key: &NodeKey, tag: &str) -> Result<Option<Node<K>>>;
    fn get_rightmost_leaf(&self, version: Version) -> Result<Option<(NodeKey, LeafNode<K>)>>;
}

pub trait TreeWriter<K>: Send + Sync {
    fn write_node_batch(&self, node_batch: &HashMap<NodeKey, Node<K>>) -> Result<()>;
}

pub trait Key: Clone + Serialize + DeserializeOwned + Send + Sync + 'static {
    fn key_size(&self) -> usize;
}

pub trait Value: Clone + CryptoHash + Serialize + DeserializeOwned + Send + Sync {
    fn value_size(&self) -> usize;
}
```

### Core types:

```rust
pub type NodeBatch<K> = HashMap<NodeKey, Node<K>>;

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct NodeStats {
    pub new_nodes: usize,
    pub new_leaves: usize,
    pub stale_nodes: usize,
    pub stale_leaves: usize,
}

#[derive(Clone, Debug, Eq, Hash, Ord, PartialEq, PartialOrd)]
pub struct StaleNodeIndex {
    pub stale_since_version: Version,
    pub node_key: NodeKey,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct TreeUpdateBatch<K> {
    pub node_batch: Vec<Vec<(NodeKey, Node<K>)>>,
    pub stale_node_index_batch: Vec<Vec<StaleNodeIndex>>,
}

pub struct JellyfishMerkleTree<'a, R, K> {
    reader: &'a R,
    phantom_value: PhantomData<K>,
}
```

### Key methods:

```rust
impl<'a, R, K> JellyfishMerkleTree<'a, R, K>
where
    R: 'a + TreeReader<K> + Sync,
    K: Key,
{
    pub fn new(reader: &'a R) -> Self;

    /// Apply value set for a shard, returns new shard root node and update batch.
    /// Assumes 16 shards.
    pub fn batch_put_value_set_for_shard(
        &self,
        shard_id: u8,
        value_set: Vec<(HashValue, Option<&(HashValue, K)>)>,
        node_hashes: Option<&HashMap<NibblePath, HashValue>>,
        persisted_version: Option<Version>,
        version: Version,
    ) -> Result<(Node<K>, TreeUpdateBatch<K>)>;

    pub fn put_top_levels_nodes(...) -> Result<(HashValue, TreeUpdateBatch<K>)>;
    pub fn get_shard_persisted_versions(...) -> Result<Option<Version>>;

    /// Get value with Merkle proof at a given version
    pub fn get_with_proof(
        &self,
        key: HashValue,
        version: Version,
    ) -> Result<(Option<(HashValue, (K, Version))>, SparseMerkleProof)>;

    pub fn get_with_proof_ext(...) -> Result<(Option<(HashValue, (K, Version))>, SparseMerkleProofExt)>;
    pub fn get_range_proof(...) -> Result<SparseMerkleRangeProof>;
    pub fn get(&self, key: HashValue, version: Version) -> Result<Option<HashValue>>;
    pub fn get_root_hash(&self, version: Version) -> Result<HashValue>;
    pub fn get_root_hash_option(&self, version: Version) -> Result<Option<HashValue>>;
    pub fn get_leaf_count(&self, version: Version) -> Result<usize>;
}
```

---

## Node Types (`storage/jellyfish-merkle/src/node_type/mod.rs`)

```rust
/// The unique key of each node.
pub struct NodeKey {
    version: Version,
    nibble_path: NibblePath,
}

impl NodeKey {
    pub fn new(version: Version, nibble_path: NibblePath) -> Self;
    pub fn new_empty_path(version: Version) -> Self;
    pub fn version(&self) -> Version;
    pub fn nibble_path(&self) -> &NibblePath;
    pub fn gen_child_node_key(&self, version: Version, n: Nibble) -> Self;
    pub fn gen_parent_node_key(&self) -> Self;
    pub fn encode(&self) -> Result<Vec<u8>>;
    pub fn decode(val: &[u8]) -> Result<NodeKey>;
    pub fn get_shard_id(&self) -> Option<usize>;
}

pub enum NodeType {
    Leaf,
    Null,
    Internal { leaf_count: usize },
}

/// Each child of InternalNode
pub struct Child {
    pub hash: HashValue,
    pub version: Version,
    pub node_type: NodeType,
}

/// Collection of children indexed 0-15
pub struct Children(Arc<[(Nibble, Child)]>);

/// Represents a 4-level subtree with up to 16 children at the bottom level.
/// Reduces IOPS by 4x by compressing 4 levels into 1 node.
pub struct InternalNode {
    children: Children,
    leaf_count: usize,
}

// LeafNode stores the full key hash and value hash
pub struct LeafNode<K> { ... }

pub enum Node<K> {
    Internal(InternalNode),
    Leaf(LeafNode<K>),
    Null,
}
```
