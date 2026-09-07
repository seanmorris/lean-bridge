import FlowSpec

/-!
Dinic search on a directed capacitated multigraph. Each original edge owns two
residual arcs, so parallel and antiparallel edges retain separate identities.
The graph, queue, level labels, current arcs, and residual capacities use arrays;
the depth-first path is an explicit stack rather than the host call stack.
-/

namespace LeanDinic

@[inline] def get (values : Array α) (index : Nat) (fallback : α) : α :=
  values.getD index fallback

@[inline] def reverseArc (arc : Nat) : Nat :=
  if arc % 2 = 0 then arc + 1 else arc - 1

def networkCheck (network : Network) : Bool :=
  network.source < network.vertexCount && network.sink < network.vertexCount &&
    network.source != network.sink && network.edges.all (fun edge =>
      edge.source < network.vertexCount && edge.target < network.vertexCount)

structure ResidualGraph where
  offsets : Array Nat
  arcs : Array Nat
  targets : Array Nat
  capacities : Array Nat

private def countDegrees (edges : Array Edge) : Nat → Nat → Array Nat → Array Nat
  | 0, _, degrees => degrees
  | remaining + 1, index, degrees =>
      let edge := get edges index ⟨0, 0, 0⟩
      let sourceDegree := get degrees edge.source 0
      let degrees := degrees.setIfInBounds edge.source (sourceDegree + 1)
      let targetDegree := get degrees edge.target 0
      countDegrees edges remaining (index + 1)
        (degrees.setIfInBounds edge.target (targetDegree + 1))

private def prefixOffsets (degrees : Array Nat) :
    Nat → Nat → Nat → Array Nat → Array Nat
  | 0, _, _, offsets => offsets
  | remaining + 1, vertex, total, offsets =>
      let next := total + get degrees vertex 0
      prefixOffsets degrees remaining (vertex + 1) next (offsets.push next)

private def placeEdges (edges : Array Edge) : Nat → Nat → Array Nat → Array Nat →
    Array Nat → Array Nat → Array Nat × Array Nat × Array Nat
  | 0, _, _, arcs, targets, capacities => (arcs, targets, capacities)
  | remaining + 1, index, cursor, arcs, targets, capacities =>
      let edge := get edges index ⟨0, 0, 0⟩
      let forward := 2 * index
      let sourcePosition := get cursor edge.source 0
      let cursor := cursor.setIfInBounds edge.source (sourcePosition + 1)
      let targetPosition := get cursor edge.target 0
      let cursor := cursor.setIfInBounds edge.target (targetPosition + 1)
      placeEdges edges remaining (index + 1) cursor
        ((arcs.setIfInBounds sourcePosition forward).setIfInBounds targetPosition (forward + 1))
        ((targets.push edge.target).push edge.source)
        ((capacities.push edge.capacity).push 0)

def residualGraph (network : Network) : ResidualGraph :=
  let degrees := countDegrees network.edges network.edges.size 0
    (Array.replicate network.vertexCount 0)
  let offsets := prefixOffsets degrees network.vertexCount 0 0
    (Array.mkEmpty (network.vertexCount + 1) |>.push 0)
  let filled := placeEdges network.edges network.edges.size 0 offsets
    (Array.replicate (2 * network.edges.size) 0)
    (Array.mkEmpty (2 * network.edges.size)) (Array.mkEmpty (2 * network.edges.size))
  ⟨offsets, filled.1, filled.2.1, filled.2.2⟩

theorem placeEdges_arcs_size (edges : Array Edge) (remaining index : Nat)
    (cursor arcs targets capacities : Array Nat) :
    (placeEdges edges remaining index cursor arcs targets capacities).1.size = arcs.size := by
  induction remaining generalizing index cursor arcs targets capacities with
  | zero => rfl
  | succ remaining ih => simp [placeEdges, ih]

theorem residualGraph_arcs_size (network : Network) :
    (residualGraph network).arcs.size = 2 * network.edges.size := by
  simp [residualGraph, placeEdges_arcs_size]

structure Prepared where
  network : Network
  residual : ResidualGraph
  valid : networkCheck network = true

def prepare (network : Network) : Option Prepared :=
  if valid : networkCheck network = true then
    some ⟨network, residualGraph network, valid⟩
  else none

private def bfsRow (graph : ResidualGraph) (capacities : Array Nat)
    (count nextLevel stop : Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat × Array Nat
  | 0, _, levels, queue => (levels, queue)
  | remaining + 1, position, levels, queue =>
      if position < stop then
        let arc := get graph.arcs position graph.arcs.size
        let target := get graph.targets arc count
        if 0 < get capacities arc 0 && get levels target count = count then
          bfsRow graph capacities count nextLevel stop remaining (position + 1)
            (levels.setIfInBounds target nextLevel) (queue.push target)
        else bfsRow graph capacities count nextLevel stop remaining (position + 1) levels queue
      else (levels, queue)

private def bfsLoop (graph : ResidualGraph) (capacities : Array Nat) (count : Nat) :
    Nat → Nat → Array Nat → Array Nat → Array Nat
  | 0, _, levels, _ => levels
  | remaining + 1, head, levels, queue =>
      if head < queue.size then
        let vertex := get queue head count
        let first := get graph.offsets vertex 0
        let stop := get graph.offsets (vertex + 1) 0
        let next := bfsRow graph capacities count (get levels vertex count + 1) stop
          (stop - first) first levels queue
        bfsLoop graph capacities count remaining (head + 1) next.1 next.2
      else levels

def levelsFrom (prepared : Prepared) (capacities : Array Nat) : Array Nat :=
  bfsLoop prepared.residual capacities prepared.network.vertexCount
    prepared.network.vertexCount 0
    ((Array.replicate prepared.network.vertexCount prepared.network.vertexCount).setIfInBounds
      prepared.network.source 0)
    (Array.mkEmpty prepared.network.vertexCount |>.push prepared.network.source)

structure PathSearch where
  path : List Nat
  amount : Nat
  cursor : Array Nat

/-- The stack stores residual arcs and the bottleneck before each descent.
Every failed arc advances a current-arc pointer. Backtracking also advances its
parent pointer; levels strictly increase along every descent. -/
def findPath (graph : ResidualGraph) (capacities levels : Array Nat)
    (count sink : Nat) : Nat → Nat → Nat → List Nat → List Nat → Array Nat → PathSearch
  | 0, _, _, _, _, cursor => ⟨[], 0, cursor⟩
  | remaining + 1, vertex, amount, path, limits, cursor =>
      if vertex = sink then ⟨path, amount, cursor⟩
      else
        let position := get cursor vertex 0
        let stop := get graph.offsets (vertex + 1) 0
        if position < stop then
          let arc := get graph.arcs position graph.arcs.size
          let target := get graph.targets arc count
          let capacity := get capacities arc 0
          if 0 < capacity && get levels target count = get levels vertex count + 1 then
            findPath graph capacities levels count sink remaining target (min amount capacity)
              (arc :: path) (amount :: limits) cursor
          else findPath graph capacities levels count sink remaining vertex amount path limits
            (cursor.setIfInBounds vertex (position + 1))
        else
          match path, limits with
          | arc :: rest, previous :: restLimits =>
              let parent := get graph.targets (reverseArc arc) count
              let position := get cursor parent 0
              findPath graph capacities levels count sink remaining parent previous rest restLimits
                (cursor.setIfInBounds parent (position + 1))
          | _, _ => ⟨[], 0, cursor⟩

@[inline] def augmentArc (arc amount : Nat) (capacities : Array Nat) : Array Nat :=
  let forward := get capacities arc 0
  let reverse := reverseArc arc
  let backward := get capacities reverse 0
  (capacities.setIfInBounds arc (forward - amount)).setIfInBounds reverse (backward + amount)

def augmentPath (amount : Nat) : List Nat → Array Nat → Array Nat
  | [], capacities => capacities
  | arc :: rest, capacities => augmentPath amount rest (augmentArc arc amount capacities)

structure SearchState where
  capacities : Array Nat
  value : Nat
  phases : Nat
  augmentations : Nat

private def blockingLoop (prepared : Prepared) (levels : Array Nat) (limit : Nat) :
    Nat → Array Nat → SearchState → SearchState
  | 0, _, state => state
  | remaining + 1, cursor, state =>
      let found := findPath prepared.residual state.capacities levels
        prepared.network.vertexCount prepared.network.sink
        (4 * prepared.residual.arcs.size + 2 * prepared.network.vertexCount + 1)
        prepared.network.source limit [] [] cursor
      if found.amount = 0 then state
      else
        blockingLoop prepared levels limit remaining found.cursor
          ⟨augmentPath found.amount found.path state.capacities, state.value + found.amount,
            state.phases, state.augmentations + 1⟩

def capacitySum (network : Network) : Nat :=
  network.edges.foldl (fun total edge => total + edge.capacity) 0

private def phaseLoop (prepared : Prepared) (limit : Nat) : Nat → SearchState → SearchState
  | 0, state => state
  | remaining + 1, state =>
      let levels := levelsFrom prepared state.capacities
      if get levels prepared.network.sink prepared.network.vertexCount =
          prepared.network.vertexCount then state
      else
        let next := blockingLoop prepared levels limit (prepared.residual.arcs.size + 1)
          prepared.residual.offsets { state with phases := state.phases + 1 }
        if next.value = state.value then next
        else phaseLoop prepared limit remaining next

def dinicRaw (prepared : Prepared) : SearchState :=
  phaseLoop prepared (capacitySum prepared.network) prepared.network.vertexCount
    ⟨prepared.residual.capacities, 0, 0, 0⟩

private def collectFlows (edges : Array Edge) (capacities : Array Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, flows => flows
  | remaining + 1, index, flows =>
      collectFlows edges capacities remaining (index + 1)
        (flows.push ((get edges index ⟨0, 0, 0⟩).capacity - get capacities (2 * index) 0))

def solutionFrom (prepared : Prepared) (state : SearchState) : Solution :=
  let levels := levelsFrom prepared state.capacities
  ⟨collectFlows prepared.network.edges state.capacities prepared.network.edges.size 0
      (Array.mkEmpty prepared.network.edges.size),
    levels.map (fun level => level < prepared.network.vertexCount), state.value⟩

def candidate (prepared : Prepared) : Solution := solutionFrom prepared (dinicRaw prepared)

private def parseEdgesFrom (words : Array Nat) : Nat → Nat → Array Edge → Array Edge
  | 0, _, edges => edges
  | remaining + 1, index, edges =>
      parseEdgesFrom words remaining (index + 3)
        (edges.push ⟨get words index 0, get words (index + 1) 0, get words (index + 2) 0⟩)

def parseEdges (words : Array Nat) : Array Edge :=
  parseEdgesFrom words (words.size / 3) 0 (Array.mkEmpty (words.size / 3))

theorem networkCheck_sound (network : Network) (checked : networkCheck network = true) :
    network.Valid := by
  simp only [networkCheck, Bool.and_eq_true, decide_eq_true_eq, bne_iff_ne] at checked
  refine ⟨checked.1.1.1, checked.1.1.2, checked.1.2, ?_⟩
  intro index bound
  have item := Array.all_eq_true.mp checked.2 index bound
  simpa [Bool.and_eq_true, decide_eq_true_eq, getElem!_pos network.edges index bound] using item

theorem reverseArc_involution (arc : Nat) : reverseArc (reverseArc arc) = arc := by
  simp only [reverseArc]
  split <;> split <;> omega

theorem reverseArc_ne (arc : Nat) : reverseArc arc ≠ arc := by
  simp only [reverseArc]
  split <;> omega

theorem get_set (values : Array α) (index query : Nat) (value fallback : α)
    (bound : query < values.size) :
    get (values.setIfInBounds index value) query fallback =
      if index = query then value else get values query fallback := by
  simp [get, Array.getD, bound, Array.getElem_setIfInBounds]

theorem augmentArc_size (arc amount : Nat) (capacities : Array Nat) :
    (augmentArc arc amount capacities).size = capacities.size := by
  simp [augmentArc]

theorem augmentArc_forward (arc amount : Nat) (capacities : Array Nat)
    (bound : arc < capacities.size) :
    get (augmentArc arc amount capacities) arc 0 = get capacities arc 0 - amount := by
  simp only [augmentArc]
  rw [get_set _ _ _ _ _ (by simpa using bound)]
  simp only [reverseArc_ne, ↓reduceIte]
  rw [get_set _ _ _ _ _ bound]
  simp

theorem augmentArc_reverse (arc amount : Nat) (capacities : Array Nat)
    (bound : reverseArc arc < capacities.size) :
    get (augmentArc arc amount capacities) (reverseArc arc) 0 =
      get capacities (reverseArc arc) 0 + amount := by
  simp only [augmentArc]
  rw [get_set _ _ _ _ _ (by simpa using bound)]
  simp

/-- Augmenting a residual pair transfers capacity without creating any. -/
theorem augmentArc_pair_sum (arc amount : Nat) (capacities : Array Nat)
    (forwardBound : arc < capacities.size) (reverseBound : reverseArc arc < capacities.size)
    (available : amount ≤ get capacities arc 0) :
    get (augmentArc arc amount capacities) arc 0 +
      get (augmentArc arc amount capacities) (reverseArc arc) 0 =
      get capacities arc 0 + get capacities (reverseArc arc) 0 := by
  rw [augmentArc_forward _ _ _ forwardBound, augmentArc_reverse _ _ _ reverseBound]
  omega

theorem augmentArc_positive_progress (arc amount : Nat) (capacities : Array Nat)
    (bound : arc < capacities.size) (positive : 0 < amount)
    (available : amount ≤ get capacities arc 0) :
    get (augmentArc arc amount capacities) arc 0 < get capacities arc 0 := by
  rw [augmentArc_forward _ _ _ bound]
  omega

theorem augmentArc_other (arc query amount : Nat) (capacities : Array Nat)
    (bound : query < capacities.size) (forward : arc ≠ query)
    (reverse : reverseArc arc ≠ query) :
    get (augmentArc arc amount capacities) query 0 = get capacities query 0 := by
  simp only [augmentArc]
  rw [get_set _ _ _ _ _ (by simpa using bound)]
  simp only [reverse, ↓reduceIte]
  rw [get_set _ _ _ _ _ bound]
  simp only [forward, ↓reduceIte]

theorem augmentPath_size (amount : Nat) (path : List Nat) (capacities : Array Nat) :
    (augmentPath amount path capacities).size = capacities.size := by
  induction path generalizing capacities with
  | nil => rfl
  | cons arc rest ih =>
      simpa [augmentPath, augmentArc_size] using ih (augmentArc arc amount capacities)

def PathFits (capacities : Array Nat) (path : List Nat) (amount : Nat) : Prop :=
  ∀ arc, arc ∈ path → amount ≤ get capacities arc 0

/-- Every stored bottleneck fits its edge and the preceding path. -/
def StackFits (capacities : Array Nat) : List Nat → List Nat → Nat → Prop
  | [], [], _ => True
  | arc :: rest, previous :: limits, amount =>
      amount ≤ get capacities arc 0 ∧ amount ≤ previous ∧ StackFits capacities rest limits previous
  | _, _, _ => False

theorem stackFits_pathFits (capacities : Array Nat) (path limits : List Nat) (amount : Nat)
    (fits : StackFits capacities path limits amount) : PathFits capacities path amount := by
  induction path generalizing limits amount with
  | nil => simp [PathFits]
  | cons arc rest ih =>
      cases limits with
      | nil => simp [StackFits] at fits
      | cons previous limits =>
          simp only [StackFits] at fits
          intro query member
          simp only [List.mem_cons] at member
          rcases member with equal | member
          · subst query; exact fits.1
          · exact Nat.le_trans fits.2.1 (ih limits previous fits.2.2 query member)

/-- A returned augmenting amount never exceeds any residual arc on its path,
even if the explicit search budget expires or a branch backtracks. -/
theorem findPath_fits (graph : ResidualGraph) (capacities levels : Array Nat)
    (count sink fuel vertex amount : Nat) (path limits : List Nat) (cursor : Array Nat)
    (fits : StackFits capacities path limits amount) :
    PathFits capacities (findPath graph capacities levels count sink fuel vertex amount path limits cursor).path
      (findPath graph capacities levels count sink fuel vertex amount path limits cursor).amount := by
  induction fuel generalizing vertex amount path limits cursor with
  | zero => simp [findPath, PathFits]
  | succ fuel ih =>
      unfold findPath
      split
      · exact stackFits_pathFits capacities path limits amount fits
      · dsimp only
        split
        · split
          · apply ih
            exact ⟨Nat.min_le_right _ _, Nat.min_le_left _ _, fits⟩
          · exact ih vertex amount path limits _ fits
        · cases path with
          | nil => simp [PathFits]
          | cons arc rest =>
              cases limits with
              | nil => simp [StackFits] at fits
              | cons previous restLimits => exact ih _ previous rest restLimits _ fits.2.2

def StackMinimum (capacities : Array Nat) : List Nat → List Nat → Nat → Nat → Prop
  | [], [], limit, amount => amount = limit
  | arc :: rest, previous :: limits, limit, amount =>
      amount = min previous (get capacities arc 0) ∧ StackMinimum capacities rest limits limit previous
  | _, _, _, _ => False

theorem stackMinimum_witness (capacities : Array Nat) (path limits : List Nat) (limit amount : Nat)
    (minimum : StackMinimum capacities path limits limit amount) :
    amount = limit ∨ ∃ arc, arc ∈ path ∧ get capacities arc 0 = amount := by
  induction path generalizing limits amount with
  | nil => cases limits <;> simp_all [StackMinimum]
  | cons arc rest ih =>
      cases limits with
      | nil => simp [StackMinimum] at minimum
      | cons previous limits =>
          simp only [StackMinimum] at minimum
          by_cases first : previous ≤ get capacities arc 0
          · rw [Nat.min_eq_left first] at minimum
            rcases ih limits previous minimum.2 with equal | ⟨witness, member, equal⟩
            · exact Or.inl (minimum.1.trans equal)
            · exact Or.inr ⟨witness, List.mem_cons_of_mem _ member, equal.trans minimum.1.symm⟩
          · exact Or.inr ⟨arc, List.mem_cons_self,
              (minimum.1.trans (Nat.min_eq_right (by omega))).symm⟩

theorem findPath_minimum (graph : ResidualGraph) (capacities levels : Array Nat)
    (count sink fuel vertex limit amount : Nat) (path limits : List Nat) (cursor : Array Nat)
    (minimum : StackMinimum capacities path limits limit amount) :
    let found := findPath graph capacities levels count sink fuel vertex amount path limits cursor
    found.amount = 0 ∨ found.amount = limit ∨
      ∃ arc, arc ∈ found.path ∧ get capacities arc 0 = found.amount := by
  induction fuel generalizing vertex amount path limits cursor with
  | zero => simp [findPath]
  | succ fuel ih =>
      unfold findPath
      split
      · exact Or.inr (stackMinimum_witness capacities path limits limit amount minimum)
      · dsimp only
        split
        · split
          · apply ih
            exact ⟨rfl, minimum⟩
          · exact ih vertex amount path limits _ minimum
        · cases path with
          | nil => simp
          | cons arc rest =>
              cases limits with
              | nil => simp [StackMinimum] at minimum
              | cons previous restLimits => exact ih _ previous rest restLimits _ minimum.2

/-- A positive nonempty search result exhausts at least one residual arc when
the initial limit bounds the arc capacities. This is the blocking-flow progress
fact; it does not assert that an arbitrary iteration budget is sufficient. -/
theorem findPath_saturates (graph : ResidualGraph) (capacities levels : Array Nat)
    (count sink fuel vertex limit : Nat) (cursor : Array Nat) :
    let found := findPath graph capacities levels count sink fuel vertex limit [] [] cursor
    0 < found.amount → found.path ≠ [] →
      (∀ arc, arc ∈ found.path → get capacities arc 0 ≤ limit) →
      ∃ arc, arc ∈ found.path ∧ get capacities arc 0 = found.amount := by
  intro found positive nonempty bounded
  have minimum := findPath_minimum graph capacities levels count sink fuel vertex limit limit
    [] [] cursor rfl
  change found.amount = 0 ∨ found.amount = limit ∨
    (∃ arc, arc ∈ found.path ∧ get capacities arc 0 = found.amount) at minimum
  rcases minimum with zero | equal | witness
  · omega
  · have fits := findPath_fits graph capacities levels count sink fuel vertex limit [] [] cursor trivial
    change PathFits capacities found.path found.amount at fits
    cases pathEq : found.path with
    | nil => exact False.elim (nonempty pathEq)
    | cons arc rest =>
        have member : arc ∈ found.path := by simp [pathEq]
        exact ⟨arc, by simp, Nat.le_antisymm (by simpa [equal] using bounded arc member)
          (fits arc member)⟩
  · exact witness

theorem blockingLoop_phases (prepared : Prepared) (levels : Array Nat) (limit fuel : Nat)
    (cursor : Array Nat) (state : SearchState) :
    (blockingLoop prepared levels limit fuel cursor state).phases = state.phases := by
  induction fuel generalizing cursor state with
  | zero => rfl
  | succ fuel ih =>
      unfold blockingLoop
      dsimp only
      split
      · rfl
      · exact ih _ _

theorem blockingLoop_augmentations (prepared : Prepared) (levels : Array Nat) (limit fuel : Nat)
    (cursor : Array Nat) (state : SearchState) :
    (blockingLoop prepared levels limit fuel cursor state).augmentations ≤ state.augmentations + fuel := by
  induction fuel generalizing cursor state with
  | zero => simp [blockingLoop]
  | succ fuel ih =>
      unfold blockingLoop
      dsimp only
      split
      · simp
      · apply Nat.le_trans (ih _ _)
        dsimp only
        omega

theorem phaseLoop_phases (prepared : Prepared) (limit fuel : Nat) (state : SearchState) :
    (phaseLoop prepared limit fuel state).phases ≤ state.phases + fuel := by
  induction fuel generalizing state with
  | zero => simp [phaseLoop]
  | succ fuel ih =>
      unfold phaseLoop
      dsimp only
      split
      · simp
      · split
        · simp [blockingLoop_phases]
        · apply Nat.le_trans (ih _)
          rw [blockingLoop_phases]
          dsimp only
          omega

theorem phaseLoop_augmentations (prepared : Prepared) (limit fuel : Nat) (state : SearchState) :
    (phaseLoop prepared limit fuel state).augmentations ≤
      state.augmentations + fuel * (prepared.residual.arcs.size + 1) := by
  induction fuel generalizing state with
  | zero => simp [phaseLoop]
  | succ fuel ih =>
      unfold phaseLoop
      dsimp only
      split
      · simp
      · have blockBound := blockingLoop_augmentations prepared (levelsFrom prepared state.capacities) limit
          (prepared.residual.arcs.size + 1) prepared.residual.offsets
          { state with phases := state.phases + 1 }
        dsimp only at blockBound
        split
        · exact Nat.le_trans blockBound (by simp [Nat.add_mul])
        · have bound := ih (blockingLoop prepared (levelsFrom prepared state.capacities) limit
            (prepared.residual.arcs.size + 1) prepared.residual.offsets { state with phases := state.phases + 1 })
          simp only [Nat.add_mul, Nat.one_mul]
          omega

theorem dinicRaw_phase_bound (prepared : Prepared) :
    (dinicRaw prepared).phases ≤ prepared.network.vertexCount := by
  simpa [dinicRaw] using phaseLoop_phases prepared (capacitySum prepared.network)
    prepared.network.vertexCount ⟨prepared.residual.capacities, 0, 0, 0⟩

theorem dinicRaw_augmentation_bound (prepared : Prepared) :
    (dinicRaw prepared).augmentations ≤
      prepared.network.vertexCount * (prepared.residual.arcs.size + 1) := by
  simpa [dinicRaw] using phaseLoop_augmentations prepared (capacitySum prepared.network)
    prepared.network.vertexCount ⟨prepared.residual.capacities, 0, 0, 0⟩

end LeanDinic
