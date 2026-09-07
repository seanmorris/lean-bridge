import Init

/-!
A bounded least-recently-used cache for arbitrary keys and values. The compact
array stores entries from least to most recently used. Searches and promotion
are O(capacity); the proofs in Lru.lean erase before the C/Wasm build.
-/

namespace LeanLRU

abbrev Entry (Key Value : Type) := Key × Value

structure Cache (Key Value : Type) where
  capacity : Nat
  entries : Array (Entry Key Value)
  deriving Repr

structure Change (Key Value : Type) where
  cache : Cache Key Value
  value : Option Value
  evicted : Option (Entry Key Value)
  status : Nat
  deriving Repr

def empty (capacity : Nat) : Cache Key Value := ⟨capacity, #[]⟩

def lookup [BEq Key] (entries : Array (Entry Key Value)) (key : Key) :
    Option (Entry Key Value) := entries.find? (fun entry => entry.1 == key)

def remove [BEq Key] (entries : Array (Entry Key Value)) (key : Key) :
    Array (Entry Key Value) := entries.filter (fun entry => entry.1 != key)

def get [BEq Key] (cache : Cache Key Value) (key : Key) : Change Key Value :=
  match lookup cache.entries key with
  | none => ⟨cache, none, none, 0⟩
  | some entry =>
    ⟨⟨cache.capacity, (remove cache.entries key).push entry⟩, some entry.2, none, 1⟩

/- A repeated access to the most recent entry needs no search or array rewrite. -/
def fastGet [BEq Key] (cache : Cache Key Value) (key : Key) : Change Key Value :=
  match cache.entries.back? with
  | none => get cache key
  | some entry =>
    if entry.1 == key then ⟨cache, some entry.2, none, 1⟩
    else get cache key

def put [BEq Key] (cache : Cache Key Value) (key : Key) (value : Value) :
    Change Key Value :=
  if cache.capacity = 0 then ⟨empty 0, some value, none, 5⟩
  else
    let kept := remove cache.entries key
    if kept.size < cache.capacity then
      ⟨⟨cache.capacity, kept.push (key, value)⟩, some value, none,
        if kept.size < cache.entries.size then 3 else 2⟩
    else
      ⟨⟨cache.capacity, (kept.extract 1 kept.size).push (key, value)⟩,
        some value, kept[0]?, 4⟩

/- A separate list specification, also ordered least to most recently used. -/
namespace Spec

def remove [BEq Key] (entries : List (Entry Key Value)) (key : Key) :=
  entries.filter (fun entry => entry.1 != key)

def get [BEq Key] (entries : List (Entry Key Value)) (key : Key) :
    List (Entry Key Value) × Option Value :=
  match entries.find? (fun entry => entry.1 == key) with
  | none => (entries, none)
  | some entry => (remove entries key ++ [entry], some entry.2)

def put [BEq Key] (capacity : Nat) (entries : List (Entry Key Value))
    (key : Key) (value : Value) : List (Entry Key Value) :=
  if capacity = 0 then []
  else
    let kept := remove entries key
    (if kept.length < capacity then kept else kept.drop 1) ++ [(key, value)]

end Spec

def Unique (entries : List (Entry Key Value)) : Prop :=
  entries.Pairwise (fun left right => left.1 ≠ right.1)

def Valid (cache : Cache Key Value) : Prop :=
  cache.entries.size ≤ cache.capacity ∧ Unique cache.entries.toList

/- Nat keys and values are the browser ABI specialization. -/
structure Result where
  cache : Cache Nat Nat
  output : Array Nat

def encode (change : Change Nat Nat) : Result :=
  ⟨change.cache, #[change.status, change.value.getD 0,
    (change.evicted.map Prod.fst).getD 0, (change.evicted.map Prod.snd).getD 0]⟩

@[export lean_lru_empty]
def exportedEmpty (capacity : Nat) : Cache Nat Nat := empty capacity

@[export lean_lru_get]
def exportedGet (cache : Cache Nat Nat) (key : Nat) : Result := encode (fastGet cache key)

@[export lean_lru_put]
def exportedPut (cache : Cache Nat Nat) (key value : Nat) : Result :=
  encode (put cache key value)

@[export lean_lru_snapshot]
def exportedSnapshot (cache : Cache Nat Nat) : Array Nat := Id.run do
  let mut output := Array.mkEmpty (cache.entries.size * 2)
  for entry in cache.entries.reverse do
    output := (output.push entry.1).push entry.2
  return output

def runFrom (operations : Array Nat) : Nat → Nat → Cache Nat Nat → Array Nat → Result
  | 0, _, cache, output => ⟨cache, output⟩
  | remaining + 1, index, cache, output =>
    let key := operations.getD (index + 1) 0
    let change := if operations.getD index 0 = 0 then fastGet cache key
      else put cache key (operations.getD (index + 2) 0)
    let output := (((output.push change.status).push (change.value.getD 0)).push
      ((change.evicted.map Prod.fst).getD 0)).push ((change.evicted.map Prod.snd).getD 0)
    runFrom operations remaining (index + 3) change.cache output

@[export lean_lru_run]
def exportedRun (cache : Cache Nat Nat) (operations : Array Nat) : Result :=
  runFrom operations (operations.size / 3) 0 cache (Array.mkEmpty (operations.size / 3 * 4))

@[export lean_lru_batch]
def exportedBatch (capacity : Nat) (operations : Array Nat) : Array Nat :=
  (exportedRun (empty capacity) operations).output

end LeanLRU
