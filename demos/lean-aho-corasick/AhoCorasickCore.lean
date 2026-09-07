import Init

/-!
A generic finite-alphabet Aho–Corasick matcher. Patterns and input are flat token
arrays; the browser bridge specializes tokens to bytes. No logging, moderation,
or text-layout concepts occur in this module.
-/

namespace LeanAhoCorasick

def arrayGet (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

structure PatternTable where
  offsets : Array Nat
  tokens : Array Nat
deriving Repr, DecidableEq

def PatternTable.count (table : PatternTable) : Nat := table.offsets.size - 1

def PatternTable.start (table : PatternTable) (pattern : Nat) : Nat :=
  arrayGet table.offsets pattern table.tokens.size

def PatternTable.stop (table : PatternTable) (pattern : Nat) : Nat :=
  arrayGet table.offsets pattern.succ table.tokens.size

def PatternTable.length (table : PatternTable) (pattern : Nat) : Nat :=
  table.stop pattern - table.start pattern

private def offsetsValidFrom (table : PatternTable) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, pattern =>
      let first := table.start pattern
      let stop := table.stop pattern
      first < stop && stop ≤ table.tokens.size &&
        offsetsValidFrom table fuel pattern.succ

def patternsValid (alphabetSize : Nat) (table : PatternTable) : Bool :=
  alphabetSize > 0 && table.offsets.size > 0 &&
    arrayGet table.offsets 0 1 = 0 &&
    arrayGet table.offsets (table.offsets.size - 1) 0 = table.tokens.size &&
    offsetsValidFrom table table.count 0 &&
    table.tokens.all (fun token => token < alphabetSize)

structure Match where
  pattern : Nat
  start : Nat
  stop : Nat
deriving Repr, DecidableEq

private def matchAtFrom (table : PatternTable) (input : Array Nat)
    (pattern start : Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, offset =>
      arrayGet table.tokens (table.start pattern + offset) table.tokens.size =
          arrayGet input (start + offset) input.size &&
        matchAtFrom table input pattern start fuel offset.succ

def occursAt (table : PatternTable) (input : Array Nat) (occurrence : Match) : Bool :=
  occurrence.pattern < table.count &&
    occurrence.stop = occurrence.start + table.length occurrence.pattern &&
    occurrence.stop ≤ input.size &&
    matchAtFrom table input occurrence.pattern occurrence.start
      (table.length occurrence.pattern) 0

private def appendZeros : Nat → Array Nat → Array Nat
  | 0, values => values
  | fuel + 1, values => appendZeros fuel (values.push 0)

private structure TrieState where
  transitions : Array Nat
  outputs : Array (Array Nat)
  parent : Array Nat
  parentToken : Array Nat

private def insertPatternFrom (alphabetSize : Nat) (table : PatternTable)
    (stop pattern : Nat) : Nat → Nat → Nat → TrieState → TrieState
  | 0, _, _, state => state
  | fuel + 1, index, node, state =>
      if index < stop then
        let token := arrayGet table.tokens index alphabetSize
        let slot := node * alphabetSize + token
        let target := arrayGet state.transitions slot 0
        if target = 0 then
          let created := state.outputs.size
          insertPatternFrom alphabetSize table stop pattern fuel index.succ created {
            transitions := (appendZeros alphabetSize state.transitions).setIfInBounds slot created
            outputs := state.outputs.push #[]
            parent := state.parent.push node
            parentToken := state.parentToken.push token
          }
        else insertPatternFrom alphabetSize table stop pattern fuel index.succ target state
      else
        let terminal := arrayGet state.outputs node #[]
        { state with outputs := state.outputs.setIfInBounds node (terminal.push pattern) }

private def insertPatternsFrom (alphabetSize : Nat) (table : PatternTable) :
    Nat → Nat → TrieState → TrieState
  | 0, _, state => state
  | fuel + 1, pattern, state =>
      let first := table.start pattern
      let stop := table.stop pattern
      let next := insertPatternFrom alphabetSize table stop pattern
        (stop - first + 1) first 0 state
      insertPatternsFrom alphabetSize table fuel pattern.succ next

private def rootQueueFrom (alphabetSize : Nat) (transitions : Array Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, queue => queue
  | fuel + 1, token, queue =>
      let child := arrayGet transitions token 0
      rootQueueFrom alphabetSize transitions fuel token.succ
        (if child = 0 then queue else queue.push child)

private structure FailureState where
  transitions : Array Nat
  failure : Array Nat
  outputs : Array (Array Nat)
  queue : Array Nat

private def completeRowFrom (alphabetSize node fallback : Nat) :
    Nat → Nat → FailureState → FailureState
  | 0, _, state => state
  | fuel + 1, token, state =>
      let slot := node * alphabetSize + token
      let child := arrayGet state.transitions slot 0
      let fallbackTarget := arrayGet state.transitions (fallback * alphabetSize + token) 0
      if child = 0 then
        completeRowFrom alphabetSize node fallback fuel token.succ {
          state with transitions := state.transitions.setIfInBounds slot fallbackTarget
        }
      else
        let inherited := arrayGet state.outputs fallbackTarget #[]
        let direct := arrayGet state.outputs child #[]
        completeRowFrom alphabetSize node fallback fuel token.succ {
          transitions := state.transitions
          failure := state.failure.setIfInBounds child fallbackTarget
          outputs := state.outputs.setIfInBounds child (direct ++ inherited)
          queue := state.queue.push child
        }

private def completeFailureLinks (alphabetSize stateCount : Nat) :
    Nat → Nat → FailureState → FailureState
  | 0, _, state => state
  | fuel + 1, head, state =>
      if head < state.queue.size then
        let node := arrayGet state.queue head 0
        let fallback := arrayGet state.failure node 0
        let next := completeRowFrom alphabetSize node fallback alphabetSize 0 state
        completeFailureLinks alphabetSize stateCount fuel head.succ next
      else state

private def flattenOutputsFrom (outputs : Array (Array Nat)) :
    Nat → Nat → Array Nat → Array Nat → Array Nat × Array Nat
  | 0, _, offsets, values => (offsets, values)
  | fuel + 1, state, offsets, values =>
      let emitted := arrayGet outputs state #[]
      flattenOutputsFrom outputs fuel state.succ (offsets.push (values.size + emitted.size))
        (values ++ emitted)

private def insertSorted (value : Nat) : List Nat → List Nat
  | [] => [value]
  | head :: tail => if value ≤ head then value :: head :: tail else head :: insertSorted value tail

private def sortOutputsFrom (outputs : Array (Array Nat)) : Nat → Nat → Array (Array Nat) → Array (Array Nat)
  | 0, _, sorted => sorted
  | fuel + 1, state, sorted =>
      let values := arrayGet outputs state #[]
      let ordered := values.toList.foldl (fun result value => insertSorted value result) [] |>.toArray
      sortOutputsFrom outputs fuel state.succ (sorted.setIfInBounds state ordered)

private def candidateBucketsFrom (alphabetSize : Nat) (table : PatternTable) :
    Nat → Nat → Array (Array Nat) → Array (Array Nat)
  | 0, _, buckets => buckets
  | fuel + 1, pattern, buckets =>
      let token := arrayGet table.tokens (table.stop pattern - 1) alphabetSize
      let bucket := arrayGet buckets token #[]
      candidateBucketsFrom alphabetSize table fuel pattern.succ
        (buckets.setIfInBounds token (bucket.push pattern))

private def buildCandidateIndex (alphabetSize : Nat) (table : PatternTable) : Array Nat × Array Nat :=
  let buckets := candidateBucketsFrom alphabetSize table table.count 0
    (Array.replicate alphabetSize #[])
  flattenOutputsFrom buckets alphabetSize 0 #[0] #[]

structure Machine where
  alphabetSize : Nat
  table : PatternTable
  transitions : Array Nat
  failure : Array Nat
  outputOffsets : Array Nat
  outputPatterns : Array Nat
  candidateOffsets : Array Nat
  candidatePatterns : Array Nat
  parent : Array Nat
  parentToken : Array Nat
deriving Repr, DecidableEq

def Machine.stateCount (machine : Machine) : Nat := machine.failure.size

def compile (alphabetSize : Nat) (table : PatternTable) : Machine :=
  let trie := insertPatternsFrom alphabetSize table table.count 0 {
    transitions := Array.replicate alphabetSize 0
    outputs := #[#[]]
    parent := #[0]
    parentToken := #[0]
  }
  let stateCount := trie.outputs.size
  let queue := rootQueueFrom alphabetSize trie.transitions alphabetSize 0 #[]
  let completed := completeFailureLinks alphabetSize stateCount (stateCount + 1) 0 {
    transitions := trie.transitions
    failure := Array.replicate stateCount 0
    outputs := trie.outputs
    queue
  }
  let sortedOutputs := sortOutputsFrom completed.outputs stateCount 0 completed.outputs
  let flattened := flattenOutputsFrom sortedOutputs stateCount 0 #[0] #[]
  let candidates := buildCandidateIndex alphabetSize table
  { alphabetSize, table, transitions := completed.transitions, failure := completed.failure,
    outputOffsets := flattened.1, outputPatterns := flattened.2,
    candidateOffsets := candidates.1, candidatePatterns := candidates.2,
    parent := trie.parent, parentToken := trie.parentToken }

def machineShapeCheck (machine : Machine) : Bool :=
  patternsValid machine.alphabetSize machine.table && machine.stateCount > 0 &&
    machine.transitions.size = machine.stateCount * machine.alphabetSize &&
    machine.outputOffsets.size = machine.stateCount + 1 &&
    machine.candidateOffsets.size = machine.alphabetSize + 1 &&
    machine.parent.size = machine.stateCount && machine.parentToken.size = machine.stateCount &&
    arrayGet machine.outputOffsets 0 1 = 0 &&
    arrayGet machine.outputOffsets machine.stateCount 0 = machine.outputPatterns.size &&
    arrayGet machine.candidateOffsets 0 1 = 0 &&
    arrayGet machine.candidateOffsets machine.alphabetSize 0 = machine.candidatePatterns.size &&
    machine.transitions.all (fun target => target < machine.stateCount) &&
    machine.failure.all (fun target => target < machine.stateCount) &&
    machine.outputPatterns.all (fun pattern => pattern < machine.table.count) &&
    machine.candidatePatterns.all (fun pattern => pattern < machine.table.count)

private def trieInvariantFrom (machine : Machine) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, state =>
      let parent := arrayGet machine.parent state machine.stateCount
      let token := arrayGet machine.parentToken state machine.alphabetSize
      parent < state && token < machine.alphabetSize &&
        arrayGet machine.transitions (parent * machine.alphabetSize + token) machine.stateCount = state &&
        trieInvariantFrom machine fuel state.succ

def trieInvariantCheck (machine : Machine) : Bool :=
  arrayGet machine.parent 0 1 = 0 && arrayGet machine.parentToken 0 machine.alphabetSize = 0 &&
    trieInvariantFrom machine (machine.stateCount - 1) 1

private def stateDepthFrom (parent : Array Nat) : Nat → Nat → Nat → Nat
  | 0, _, depth => depth
  | fuel + 1, state, depth =>
      if state = 0 then depth
      else stateDepthFrom parent fuel (arrayGet parent state 0) depth.succ

def stateDepth (machine : Machine) (state : Nat) : Nat :=
  stateDepthFrom machine.parent machine.stateCount state 0

private def failureInvariantFrom (machine : Machine) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, state =>
      let fallback := arrayGet machine.failure state machine.stateCount
      fallback < machine.stateCount && stateDepth machine fallback < stateDepth machine state &&
        failureInvariantFrom machine fuel state.succ

def failureInvariantCheck (machine : Machine) : Bool :=
  arrayGet machine.failure 0 1 = 0 && failureInvariantFrom machine (machine.stateCount - 1) 1

def candidateInvariantCheck (machine : Machine) : Bool :=
  let expected := buildCandidateIndex machine.alphabetSize machine.table
  machine.candidateOffsets == expected.1 && machine.candidatePatterns == expected.2

def TrieInvariant (machine : Machine) : Prop := trieInvariantCheck machine = true
def FailureInvariant (machine : Machine) : Prop := failureInvariantCheck machine = true

def machineInvariantCheck (machine : Machine) : Bool :=
  machineShapeCheck machine && trieInvariantCheck machine && failureInvariantCheck machine &&
    candidateInvariantCheck machine

def MachineInvariant (machine : Machine) : Prop := machineInvariantCheck machine = true

instance (machine : Machine) : Decidable (MachineInvariant machine) := by
  unfold MachineInvariant
  infer_instance

def compileCertified (alphabetSize : Nat) (table : PatternTable) :
    Option { machine : Machine // MachineInvariant machine } :=
  if patternsValid alphabetSize table then
    let machine := compile alphabetSize table
    if valid : MachineInvariant machine then some ⟨machine, valid⟩ else none
  else none

private def emitFrom (machine : Machine) (stop : Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, result => result
  | fuel + 1, index, result =>
      let pattern := arrayGet machine.outputPatterns index machine.table.count
      let length := machine.table.length pattern
      emitFrom machine stop fuel index.succ
        (result.push pattern |>.push (stop - length) |>.push stop)

private def scanFrom (machine : Machine) (input : Array Nat) :
    Nat → Nat → Nat → Array Nat → Array Nat
  | 0, _, _, result => result
  | fuel + 1, index, state, result =>
      let token := arrayGet input index machine.alphabetSize
      let next := arrayGet machine.transitions (state * machine.alphabetSize + token) 0
      let first := arrayGet machine.outputOffsets next 0
      let stop := arrayGet machine.outputOffsets next.succ first
      let emitted := emitFrom machine index.succ (stop - first) first result
      scanFrom machine input fuel index.succ next emitted

def scan (machine : Machine) (input : Array Nat) : Array Nat :=
  scanFrom machine input input.size 0 0 #[]

theorem scan_empty (machine : Machine) : scan machine #[] = #[] := by
  rfl

private def resultHasFrom (result : Array Nat) (wanted : Match) : Nat → Nat → Bool
  | 0, _ => false
  | fuel + 1, index =>
      if index + 2 < result.size then
        if arrayGet result index 0 = wanted.pattern &&
            arrayGet result (index + 1) 0 = wanted.start &&
            arrayGet result (index + 2) 0 = wanted.stop then true
        else resultHasFrom result wanted fuel (index + 3)
      else false

def resultHas (result : Array Nat) (wanted : Match) : Bool :=
  resultHasFrom result wanted (result.size / 3) 0

private def soundFrom (table : PatternTable) (input result : Array Nat) : Nat → Nat → Bool
  | 0, _ => true
  | fuel + 1, index =>
      if index + 2 < result.size then
        occursAt table input {
          pattern := arrayGet result index table.count
          start := arrayGet result (index + 1) input.size
          stop := arrayGet result (index + 2) input.size
        } && soundFrom table input result fuel (index + 3)
      else false

def soundCheck (table : PatternTable) (input result : Array Nat) : Bool :=
  result.size % 3 = 0 && soundFrom table input result (result.size / 3) 0

private def expectedCandidatesFrom (machine : Machine) (input : Array Nat) (stop : Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, result => result
  | fuel + 1, candidate, result =>
      let pattern := arrayGet machine.candidatePatterns candidate machine.table.count
      let length := machine.table.length pattern
      let wanted := { pattern, start := stop - length, stop : Match }
      let next := if decide (length ≤ stop) && occursAt machine.table input wanted then
        result.push pattern |>.push wanted.start |>.push stop
      else result
      expectedCandidatesFrom machine input stop fuel candidate.succ next

private def expectedStopsFrom (machine : Machine) (input : Array Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, result => result
  | fuel + 1, stop, result =>
      let token := arrayGet input (stop - 1) machine.alphabetSize
      let first := arrayGet machine.candidateOffsets token 0
      let after := arrayGet machine.candidateOffsets token.succ first
      let next := expectedCandidatesFrom machine input stop (after - first) first result
      expectedStopsFrom machine input fuel stop.succ next

def expectedMatches (machine : Machine) (input : Array Nat) : Array Nat :=
  expectedStopsFrom machine input input.size 1 #[]

def completeCheck (machine : Machine) (input result : Array Nat) : Bool :=
  result == expectedMatches machine input

def ExactResult (machine : Machine) (input result : Array Nat) : Prop :=
  soundCheck machine.table input result = true ∧ completeCheck machine input result = true

instance (machine : Machine) (input result : Array Nat) :
    Decidable (ExactResult machine input result) := by
  unfold ExactResult
  infer_instance

def scanCertified (machine : Machine) (input : Array Nat) :
    Option { result : Array Nat // ExactResult machine input result } :=
  if input.all (fun token => token < machine.alphabetSize) then
    let result := scan machine input
    if valid : ExactResult machine input result then some ⟨result, valid⟩ else none
  else none

def byteMachine (offsets tokens : Array Nat) : Machine :=
  compile 256 { offsets, tokens }

@[export lean_aho_corasick_compile]
def compileBytes (offsets tokens : Array Nat) : Machine := byteMachine offsets tokens

@[export lean_aho_corasick_machine_valid]
def machineValidBytes (machine : Machine) : UInt32 :=
  if machineInvariantCheck machine then 1 else 0

@[export lean_aho_corasick_scan]
def scanBytes (machine : Machine) (input : Array Nat) : Array Nat :=
  match scanCertified machine input with
  | some result => result.val
  | none => #[]

end LeanAhoCorasick
