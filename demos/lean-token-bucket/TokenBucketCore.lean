import Init

/-!
A token bucket over natural-number credit units and clock ticks. Time and credit
arithmetic are exact. The browser adapter chooses their physical units.
-/

namespace LeanTokenBucket

structure Config where
  capacity : Nat
  rate : Nat
  deriving Repr, DecidableEq

structure State where
  tokens : Nat
  last : Nat
  deriving Repr, DecidableEq

def Valid (config : Config) (state : State) : Prop := state.tokens ≤ config.capacity

structure Bucket where
  config : Config
  state : State
  deriving Repr, DecidableEq

structure Change where
  state : State
  /-- 0: admitted; 1: throttled; 2: clock regression. -/
  status : Nat
  available : Nat
  refilled : Nat
  retryAfter : Option Nat
  deriving Repr, DecidableEq

def initial (config : Config) (now : Nat) : State := ⟨config.capacity, now⟩

/-- Compare against the saturation threshold before multiplying. On the only
branch that multiplies, the product is at most the unfilled capacity. -/
@[inline] def refill (capacity tokens rate elapsed : Nat) : Nat :=
  if capacity ≤ tokens then capacity
  else if rate = 0 then tokens
  else if (capacity - tokens) / rate < elapsed then capacity
  else tokens + elapsed * rate

@[inline] def retryDelay (config : Config) (available cost : Nat) : Option Nat :=
  if cost ≤ config.capacity ∧ 0 < config.rate then
    some ((cost - available - 1) / config.rate + 1)
  else none

@[inline] def request (config : Config) (state : State) (now cost : Nat) : Change :=
  if now < state.last then ⟨state, 2, state.tokens, 0, none⟩
  else
    let available := refill config.capacity state.tokens config.rate (now - state.last)
    if cost ≤ available then
      ⟨⟨available - cost, now⟩, 0, available, available - state.tokens, some 0⟩
    else
      ⟨⟨available, now⟩, 1, available, available - state.tokens,
        retryDelay config available cost⟩

def spent (cost : Nat) (change : Change) : Nat :=
  if change.status = 0 then cost else 0

def step (bucket : Bucket) (now cost : Nat) : Bucket × Change :=
  let change := request bucket.config bucket.state now cost
  (⟨bucket.config, change.state⟩, change)

/-- Each output is seven words: status, tokens, last, available, refilled,
retry-present, retry-delay. A missing retry has a zero delay word. -/
def encode (change : Change) : Array Nat :=
  #[change.status, change.state.tokens, change.state.last, change.available,
    change.refilled, if change.retryAfter.isSome then 1 else 0,
    change.retryAfter.getD 0]

structure Result where
  bucket : Bucket
  output : Array Nat

@[export lean_token_bucket_empty]
def exportedEmpty (capacity rate now : Nat) : Bucket :=
  let config := Config.mk capacity rate
  ⟨config, initial config now⟩

@[export lean_token_bucket_step]
def exportedStep (bucket : Bucket) (now cost : Nat) : Result :=
  let change := request bucket.config bucket.state now cost
  ⟨⟨bucket.config, change.state⟩, encode change⟩

@[export lean_token_bucket_snapshot]
def exportedSnapshot (bucket : Bucket) : Array Nat :=
  #[bucket.state.tokens, bucket.state.last]

@[inline] def appendOutput (output : Array Nat) (change : Change) : Array Nat :=
  ((((((output.push change.status).push change.state.tokens).push change.state.last).push
    change.available).push change.refilled).push
    (if change.retryAfter.isSome then 1 else 0)).push (change.retryAfter.getD 0)

/-- Timestamp/cost pairs. The FFI requires an even input length. -/
def runFrom (operations : Array Nat) : Nat → Nat → Bucket → Array Nat → Result
  | 0, _, bucket, output => ⟨bucket, output⟩
  | remaining + 1, index, bucket, output =>
    let change := request bucket.config bucket.state (operations.getD index 0)
      (operations.getD (index + 1) 0)
    runFrom operations remaining (index + 2) ⟨bucket.config, change.state⟩
      (appendOutput output change)

/-- Separate scalar loop arguments let compilation eliminate transient state
records. The proof module establishes equality with runFrom. -/
def runCredits (config : Config) (operations : Array Nat) :
    Nat → Nat → Nat → Nat → Array Nat → Result
  | 0, _, tokens, last, output => ⟨⟨config, ⟨tokens, last⟩⟩, output⟩
  | remaining + 1, index, tokens, last, output =>
    let change := request config ⟨tokens, last⟩ (operations.getD index 0)
      (operations.getD (index + 1) 0)
    runCredits config operations remaining (index + 2) change.state.tokens change.state.last
      (appendOutput output change)

@[export lean_token_bucket_run]
def exportedRun (bucket : Bucket) (operations : Array Nat) : Result :=
  runCredits bucket.config operations (operations.size / 2) 0 bucket.state.tokens bucket.state.last
    (Array.mkEmpty (operations.size / 2 * 7))

/-- A list semantics used to state arbitrary-length trace guarantees. -/
def runTrace (config : Config) : State → List (Nat × Nat) → State × Nat
  | state, [] => (state, 0)
  | state, (now, cost) :: remaining =>
    let change := request config state now cost
    let result := runTrace config change.state remaining
    (result.1, spent cost change + result.2)

def decodeOperations (operations : Array Nat) : Nat → Nat → List (Nat × Nat)
  | 0, _ => []
  | remaining + 1, index =>
    (operations.getD index 0, operations.getD (index + 1) 0) ::
      decodeOperations operations remaining (index + 2)

end LeanTokenBucket
