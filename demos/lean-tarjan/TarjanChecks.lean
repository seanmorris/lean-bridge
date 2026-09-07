import TarjanCore
import TarjanCertificate

/-! The executable CSR certificate establishes the graph-level SCC theorem.
The final section proves local state transitions of the Tarjan candidate. -/

namespace LeanTarjan

theorem allFrom_get (predicate : Nat → Bool) (fuel first vertex : Nat)
    (checked : allFrom predicate fuel first = true)
    (lower : first ≤ vertex) (upper : vertex < first + fuel) : predicate vertex = true := by
  induction fuel generalizing first with
  | zero => omega
  | succ fuel ih =>
      simp only [allFrom, Bool.and_eq_true] at checked
      by_cases same : vertex = first
      · simpa [same] using checked.1
      · exact ih (first + 1) checked.2 (by omega) (by omega)

theorem allUpTo_get (predicate : Nat → Bool) (count vertex : Nat)
    (checked : allUpTo count predicate = true) (bound : vertex < count) : predicate vertex = true := by
  exact allFrom_get predicate count 0 vertex checked (Nat.zero_le _) (by simpa using bound)

theorem adjacentFrom_iff (targets : Array Nat) (stop target fuel index : Nat) :
    adjacentFrom targets stop target fuel index = true ↔
      ∃ position, index ≤ position ∧ position < index + fuel ∧
        position < stop ∧ position < targets.size ∧ get targets position targets.size = target := by
  induction fuel generalizing index with
  | zero =>
      simp only [adjacentFrom, Bool.false_eq_true, false_iff, not_exists]
      rintro position ⟨lower, upper, _⟩
      omega
  | succ fuel ih =>
      simp only [adjacentFrom]
      by_cases valid : index < stop ∧ index < targets.size
      · simp only [Bool.and_eq_true, decide_eq_true_eq, valid, and_self, ↓reduceIte,
          Bool.or_eq_true, beq_iff_eq, ih]
        constructor
        · rintro (found | ⟨position, lower, upper, belowStop, belowSize, found⟩)
          · exact ⟨index, by omega, by omega, valid.1, valid.2, found⟩
          · exact ⟨position, by omega, by omega, belowStop, belowSize, found⟩
        · rintro ⟨position, lower, upper, belowStop, belowSize, found⟩
          by_cases same : position = index
          · exact Or.inl (by simpa [same] using found)
          · exact Or.inr ⟨position, by omega, by omega, belowStop, belowSize, found⟩
      · simp only [Bool.and_eq_true, decide_eq_true_eq, valid, ↓reduceIte,
          Bool.false_eq_true, false_iff, not_exists]
        rintro position ⟨lower, _, belowStop, belowSize, _⟩
        omega

/-- A constant-time CSR edge witness refers to an edge in the generic graph. -/
theorem edgeWitness_sound (input : Input) (source target index : Nat)
    (checked : edgeWitness input source target index = true) :
    Edge input.count input.edge source target := by
  simp only [edgeWitness, Bool.and_eq_true, decide_eq_true_eq, beq_iff_eq] at checked
  obtain ⟨⟨⟨⟨⟨sourceBound, targetBound⟩, indexBound⟩, firstBound⟩, lastBound⟩, found⟩ := checked
  refine ⟨sourceBound, targetBound, ?_⟩
  unfold Input.edge
  apply (adjacentFrom_iff _ _ _ _ _).mpr
  refine ⟨index, firstBound, by omega, lastBound, indexBound, ?_⟩
  simpa [get, Array.getD, indexBound] using found

theorem descendingFrom_sound (input : Input) (result : Candidate)
    (source stop fuel index target : Nat)
    (checked : descendingFrom input result source stop fuel index = true)
    (adjacent : adjacentFrom input.targets stop target fuel index = true) :
    labelAt result.labels source = labelAt result.labels target ∨
      get result.popOrder (labelAt result.labels target) 0 <
        get result.popOrder (labelAt result.labels source) 0 := by
  induction fuel generalizing index with
  | zero => simp [adjacentFrom] at adjacent
  | succ fuel ih =>
      simp only [adjacentFrom, descendingFrom] at adjacent checked
      by_cases valid : index < stop ∧ index < input.targets.size
      · simp only [Bool.and_eq_true, decide_eq_true_eq, valid, and_self, ↓reduceIte,
          Bool.or_eq_true, beq_iff_eq] at adjacent checked
        rcases adjacent with found | later
        · have targetEq : get input.targets index input.count = target := by
            simpa [get, Array.getD, valid.2] using found
          rw [targetEq] at checked
          exact checked.1
        · exact ih (index + 1) checked.2 later
      · simp only [Bool.and_eq_true, decide_eq_true_eq, valid, ↓reduceIte] at adjacent
        contradiction

theorem forwardTreeCheck_sound (input : Input) (labels : Array Nat) (forest : Forest)
    (vertex : Nat) (notRoot : vertex ≠ labelAt labels vertex)
    (checked : treeCheck input labels forest false vertex = true) :
    get forest.parent vertex input.count < input.count ∧
      labelAt labels (get forest.parent vertex input.count) = labelAt labels vertex ∧
      get forest.rank (get forest.parent vertex input.count) 0 < get forest.rank vertex 0 ∧
      input.edge (get forest.parent vertex input.count) vertex = true := by
  have different : ¬vertex = get labels vertex labels.size := notRoot
  simp only [treeCheck, different, ↓reduceIte, Bool.and_eq_true, decide_eq_true_eq,
    beq_iff_eq, Bool.false_eq_true] at checked
  obtain ⟨⟨⟨bound, same⟩, rank⟩, witness⟩ := checked
  exact ⟨bound, same, rank, (edgeWitness_sound input _ _ _ witness).2.2⟩

theorem reverseTreeCheck_sound (input : Input) (labels : Array Nat) (forest : Forest)
    (vertex : Nat) (notRoot : vertex ≠ labelAt labels vertex)
    (checked : treeCheck input labels forest true vertex = true) :
    get forest.parent vertex input.count < input.count ∧
      labelAt labels (get forest.parent vertex input.count) = labelAt labels vertex ∧
      get forest.rank (get forest.parent vertex input.count) 0 < get forest.rank vertex 0 ∧
      input.edge vertex (get forest.parent vertex input.count) = true := by
  have different : ¬vertex = get labels vertex labels.size := notRoot
  simp only [treeCheck, different, ↓reduceIte, Bool.and_eq_true, decide_eq_true_eq,
    beq_iff_eq] at checked
  obtain ⟨⟨⟨bound, same⟩, rank⟩, witness⟩ := checked
  exact ⟨bound, same, rank, (edgeWitness_sound input _ _ _ witness).2.2⟩

theorem certificateCheck_sound (input : Input) (result : Candidate)
    (checked : certificateCheck input result = true) :
    SccCertificate input.count input.edge result.labels
      (fun root => get result.popOrder root 0)
      (fun vertex => get result.forward.parent vertex input.count)
      (fun vertex => get result.forward.rank vertex 0)
      (fun vertex => get result.backward.parent vertex input.count)
      (fun vertex => get result.backward.rank vertex 0) := by
  simp only [certificateCheck, Bool.and_eq_true, beq_iff_eq] at checked
  have vertexCheck (vertex : Nat) (bound : vertex < input.count) :=
    allUpTo_get _ input.count vertex checked.2 bound
  simp only [Bool.and_eq_true, decide_eq_true_eq, beq_iff_eq] at vertexCheck
  refine ⟨checked.1, ?_, ?_, ?_, ?_, ?_⟩
  · intro vertex bound
    exact (vertexCheck vertex bound).1.1.1.1
  · intro vertex bound
    exact (vertexCheck vertex bound).1.1.1.2
  · intro vertex bound different
    exact forwardTreeCheck_sound input result.labels result.forward vertex different
      (vertexCheck vertex bound).1.1.2
  · intro vertex bound different
    exact reverseTreeCheck_sound input result.labels result.backward vertex different
      (vertexCheck vertex bound).1.2
  · intro source target edge different
    have outcome := descendingFrom_sound input result source
      (get input.offsets (source + 1) 0)
      (get input.offsets (source + 1) 0 - get input.offsets source 0)
      (get input.offsets source 0) target (vertexCheck source edge.1).2 edge.2.2
    exact outcome.resolve_left different

/-! These are local preservation results about the executable DFS transitions.
They do not assert the complete global Tarjan loop invariant. -/

theorem discover_assigns (vertex fallback : Nat) (state : SearchState)
    (indexBound : vertex < state.index.size) (lowBound : vertex < state.low.size)
    (activeBound : vertex < state.active.size) :
    (discover vertex state).nextIndex = state.nextIndex + 1 ∧
      get (discover vertex state).index vertex fallback = state.nextIndex ∧
      get (discover vertex state).low vertex fallback = state.nextIndex ∧
      get (discover vertex state).active vertex false = true ∧
      (discover vertex state).stack = vertex :: state.stack ∧
      (discover vertex state).frames = vertex :: state.frames := by
  simp [discover, get, Array.getD, indexBound, lowBound, activeBound]

theorem discover_preserves_existing_index (vertex other fallback : Nat) (state : SearchState)
    (different : vertex ≠ other) (bound : other < state.index.size) :
    get (discover vertex state).index other fallback = get state.index other fallback := by
  simp [discover, get, Array.getD, bound, Array.getElem_setIfInBounds_ne, different]

theorem discover_preserves_stack_uniqueness (vertex : Nat) (state : SearchState)
    (unique : state.stack.Nodup) (fresh : vertex ∉ state.stack) :
    (discover vertex state).stack.Nodup := by
  exact List.nodup_cons.mpr ⟨fresh, unique⟩

theorem lowerLink_value (vertex proposed fallback : Nat) (state : SearchState)
    (bound : vertex < state.low.size) :
    get (lowerLink vertex proposed state).low vertex fallback =
      min (get state.low vertex fallback) proposed := by
  simp [lowerLink, get, Array.getD, bound]

theorem lowerLink_nonincreasing (vertex proposed fallback : Nat) (state : SearchState)
    (bound : vertex < state.low.size) :
    get (lowerLink vertex proposed state).low vertex fallback ≤ get state.low vertex fallback := by
  rw [lowerLink_value vertex proposed fallback state bound]
  exact Nat.min_le_left _ _

theorem lowerLink_preserves_index_bound (vertex proposed fallback : Nat) (state : SearchState)
    (bound : vertex < state.low.size)
    (invariant : get state.low vertex fallback ≤ get state.index vertex fallback) :
    get (lowerLink vertex proposed state).low vertex fallback ≤
      get (lowerLink vertex proposed state).index vertex fallback := by
  exact Nat.le_trans (lowerLink_nonincreasing vertex proposed fallback state bound) invariant

/-- Lowering a low-link to the index of a reachable vertex preserves an actual
reachable witness for the stored value. -/
theorem lowerLink_preserves_reachable_witness (input : Input) (vertex proposed : Nat)
    (state : SearchState) (bound : vertex < state.low.size)
    (oldWitness : ∃ witness, Reachable input.count input.edge vertex witness ∧
      get state.index witness input.count = get state.low vertex input.count)
    (newWitness : ∃ witness, Reachable input.count input.edge vertex witness ∧
      get state.index witness input.count = proposed) :
    ∃ witness, Reachable input.count input.edge vertex witness ∧
      get (lowerLink vertex proposed state).index witness input.count =
        get (lowerLink vertex proposed state).low vertex input.count := by
  rw [lowerLink_value vertex proposed input.count state bound]
  by_cases smaller : get state.low vertex input.count ≤ proposed
  · rw [Nat.min_eq_left smaller]
    exact oldWitness
  · rw [Nat.min_eq_right (by omega : proposed ≤ get state.low vertex input.count)]
    exact newWitness

/-- Popping through a root partitions the original stack. It neither invents
nor drops stack entries, including when the root is absent. -/
theorem popThrough_partition (root : Nat) (stack members : List Nat) :
    (popThrough root stack members).1.reverse ++ (popThrough root stack members).2 =
      members.reverse ++ stack := by
  induction stack generalizing members with
  | nil => simp [popThrough]
  | cons vertex rest ih =>
      simp only [popThrough]
      split
      · simp [List.reverse_cons, List.append_assoc]
      · simpa [List.reverse_cons, List.append_assoc] using ih (vertex :: members)

theorem popThrough_contains_root (root : Nat) (stack members : List Nat)
    (present : root ∈ stack) : root ∈ (popThrough root stack members).1 := by
  induction stack generalizing members with
  | nil => simp at present
  | cons vertex rest ih =>
      simp only [popThrough]
      by_cases same : vertex = root
      · simp [same]
      · simp only [same, ↓reduceIte]
        exact ih (vertex :: members) ((List.mem_cons.mp present).resolve_left (Ne.symm same))

theorem popThrough_preserves_uniqueness (root : Nat) (stack : List Nat)
    (unique : stack.Nodup) :
    (popThrough root stack []).1.Nodup ∧ (popThrough root stack []).2.Nodup ∧
      ∀ vertex, vertex ∈ (popThrough root stack []).1 → vertex ∉ (popThrough root stack []).2 := by
  have preserved := popThrough_partition root stack []
  simp only [List.reverse_nil, List.nil_append] at preserved
  have combined : ((popThrough root stack []).1.reverse ++ (popThrough root stack []).2).Nodup := by
    rw [preserved]
    exact unique
  rw [List.nodup_append] at combined
  refine ⟨(List.reverse_perm _).nodup combined.1, combined.2.1, ?_⟩
  intro vertex member later
  exact combined.2.2 vertex (by simpa using member) vertex later rfl

end LeanTarjan
