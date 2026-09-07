import FlowCertificate
import FlowDuality

/-! Total finite reference solver. This deliberately simple fallback enumerates
bounded integer edge flows and vertex cuts, selecting each optimum independently.
Its cost is exponential in the graph and capacity magnitudes. The compiled Dinic
candidate normally bypasses it after a linear optimality certificate succeeds. -/

namespace LeanDinic

def assignments {α : Type} [Inhabited α] (choices : Nat → List α) : Nat → List (Nat → α)
  | 0 => [fun _ => default]
  | count + 1 => (assignments choices count).flatMap fun previous =>
      (choices count).map fun value => fun index => if index = count then value else previous index

theorem assignments_complete {α : Type} [Inhabited α] (choices : Nat → List α)
    (count : Nat) (target : Nat → α) (present : ∀ index, index < count → target index ∈ choices index) :
    ∃ candidate ∈ assignments choices count, ∀ index, index < count → candidate index = target index := by
  induction count with
  | zero => exact ⟨fun _ => default, by simp [assignments], by omega⟩
  | succ count ih =>
      obtain ⟨previous, member, agrees⟩ := ih (fun index bound => present index (by omega))
      refine ⟨fun index => if index = count then target count else previous index, ?_, ?_⟩
      · simp only [assignments, List.mem_flatMap, List.mem_map]
        exact ⟨previous, member, target count, present count (by omega), rfl⟩
      · intro index bound
        by_cases last : index = count
        · simp [last]
        · simp [last, agrees index (by omega)]

def enumerateArrays {α : Type} [Inhabited α] (choices : Nat → List α) (count : Nat) : List (Array α) :=
  (assignments choices count).map fun candidate => Array.ofFn (fun index : Fin count => candidate index.val)

theorem enumerateArrays_complete {α : Type} [Inhabited α] (choices : Nat → List α)
    (count : Nat) (target : Array α) (size : target.size = count)
    (present : ∀ index, index < count → target[index]! ∈ choices index) :
    target ∈ enumerateArrays choices count := by
  obtain ⟨candidate, member, agrees⟩ := assignments_complete choices count (fun index => target[index]!) present
  apply List.mem_map.mpr
  refine ⟨candidate, member, ?_⟩
  apply Array.ext
  · simp [size]
  · intro index leftBound rightBound
    simp only [Array.getElem_ofFn]
    have bound : index < count := by simpa using leftBound
    simpa [getElem!_pos target index rightBound] using agrees index bound

def maximize {α : Type} (score : α → Nat) (accept : α → Bool) : List α → α → α
  | [], best => best
  | candidate :: rest, best =>
      maximize score accept rest (if accept candidate && decide (score best ≤ score candidate) then candidate else best)

theorem maximize_accepted {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best : α) (accepted : accept best = true) :
    accept (maximize score accept candidates best) = true := by
  induction candidates generalizing best with
  | nil => exact accepted
  | cons candidate rest ih =>
      simp only [maximize]
      apply ih
      split
      · rename_i chosen
        simp only [Bool.and_eq_true] at chosen
        exact chosen.1
      · exact accepted

theorem maximize_initial {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best : α) : score best ≤ score (maximize score accept candidates best) := by
  induction candidates generalizing best with
  | nil => exact Nat.le_refl _
  | cons candidate rest ih =>
      simp only [maximize]
      split
      · rename_i chosen
        have facts : accept candidate = true ∧ score best ≤ score candidate := by simpa using chosen
        have increase := facts.2
        exact Nat.le_trans increase (ih candidate)
      · exact ih best

theorem maximize_member {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best candidate : α)
    (member : candidate ∈ candidates) (accepted : accept candidate = true) :
    score candidate ≤ score (maximize score accept candidates best) := by
  induction candidates generalizing best with
  | nil => simp at member
  | cons first rest ih =>
      simp only [List.mem_cons] at member
      simp only [maximize]
      rcases member with same | later
      · subst candidate
        split
        · exact maximize_initial score accept rest first
        · rename_i skipped
          have bound : score first ≤ score best := by
            simp only [accepted, Bool.true_and, decide_eq_true_eq] at skipped
            omega
          exact Nat.le_trans bound (maximize_initial score accept rest best)
      · exact ih _ later

def minimize {α : Type} (score : α → Nat) (accept : α → Bool) : List α → α → α
  | [], best => best
  | candidate :: rest, best =>
      minimize score accept rest (if accept candidate && decide (score candidate ≤ score best) then candidate else best)

theorem minimize_accepted {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best : α) (accepted : accept best = true) :
    accept (minimize score accept candidates best) = true := by
  induction candidates generalizing best with
  | nil => exact accepted
  | cons candidate rest ih =>
      simp only [minimize]
      apply ih
      split
      · rename_i chosen
        simp only [Bool.and_eq_true] at chosen
        exact chosen.1
      · exact accepted

theorem minimize_initial {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best : α) : score (minimize score accept candidates best) ≤ score best := by
  induction candidates generalizing best with
  | nil => exact Nat.le_refl _
  | cons candidate rest ih =>
      simp only [minimize]
      split
      · rename_i chosen
        have facts : accept candidate = true ∧ score candidate ≤ score best := by simpa using chosen
        have decrease := facts.2
        exact Nat.le_trans (ih candidate) decrease
      · exact ih best

theorem minimize_member {α : Type} (score : α → Nat) (accept : α → Bool)
    (candidates : List α) (best candidate : α)
    (member : candidate ∈ candidates) (accepted : accept candidate = true) :
    score (minimize score accept candidates best) ≤ score candidate := by
  induction candidates generalizing best with
  | nil => simp at member
  | cons first rest ih =>
      simp only [List.mem_cons] at member
      simp only [minimize]
      rcases member with same | later
      · subst candidate
        split
        · exact minimize_initial score accept rest first
        · rename_i skipped
          have bound : score best ≤ score first := by
            simp only [accepted, Bool.true_and, decide_eq_true_eq] at skipped
            omega
          exact Nat.le_trans (minimize_initial score accept rest best) bound
      · exact ih _ later

def inferredValue (network : Network) (flows : Array Nat) : Nat :=
  (divergence network flows network.source).toNat

theorem feasible_inferredValue (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value) :
    inferredValue network flows = value := by
  have source := feasible.2.2 network.source valid.1
  simp only [terminalBalance, ↓reduceIte, valid.2.2.1, Int.sub_zero] at source
  simp [inferredValue, source]

def zeroFlow (network : Network) : Array Nat := Array.replicate network.edges.size 0

theorem zeroFlow_feasible (network : Network) : Feasible network (zeroFlow network) 0 := by
  refine ⟨by simp [zeroFlow], ?_, ?_⟩
  · intro index bound
    simp [zeroFlow, flowAt, bound]
  · intro vertex _
    have zero (index : Nat) (bound : index < network.edges.size) : flowAt (zeroFlow network) index = 0 := by
      simp [flowAt, zeroFlow, bound]
    unfold divergence
    rw [sumInt_congr _ _ (fun _ => 0) (by intro index bound; simp [zero index bound])]
    simp [sumInt_zero, terminalBalance]

def flowCandidates (network : Network) : List (Array Nat) :=
  enumerateArrays (fun index => List.range ((network.edges[index]!).capacity + 1)) network.edges.size

theorem flowCandidates_complete (network : Network) (flows : Array Nat) (value : Nat)
    (feasible : Feasible network flows value) : flows ∈ flowCandidates network := by
  apply enumerateArrays_complete _ _ _ feasible.1
  intro index bound
  have capacity := feasible.2.1 index bound
  have flowBound : index < flows.size := by rw [feasible.1]; exact bound
  simpa [List.mem_range, flowAt, getElem!_pos flows index flowBound,
    Array.getElem?_eq_getElem flowBound] using Nat.lt_succ_of_le capacity

def referenceFlow (network : Network) : Array Nat :=
  maximize (inferredValue network) (fun flows => feasibleCheck network flows (inferredValue network flows))
    (flowCandidates network) (zeroFlow network)

theorem referenceFlow_maximum (network : Network) (valid : network.Valid) :
    MaximumFlow network (referenceFlow network) (inferredValue network (referenceFlow network)) := by
  have initialValue := feasible_inferredValue network (zeroFlow network) 0 valid (zeroFlow_feasible network)
  have initial : feasibleCheck network (zeroFlow network) (inferredValue network (zeroFlow network)) = true := by
    rw [initialValue]
    exact (feasibleCheck_iff _ _ _).mpr (zeroFlow_feasible network)
  constructor
  · exact (feasibleCheck_iff _ _ _).mp (maximize_accepted (inferredValue network)
      (fun flows => feasibleCheck network flows (inferredValue network flows)) _ _ initial)
  · intro other otherValue otherFeasible
    have value := feasible_inferredValue network other otherValue valid otherFeasible
    have accepted : feasibleCheck network other (inferredValue network other) = true := by
      rw [value]
      exact (feasibleCheck_iff _ _ _).mpr otherFeasible
    have bound := maximize_member (inferredValue network)
      (fun flows => feasibleCheck network flows (inferredValue network flows))
      (flowCandidates network) (zeroFlow network) other (flowCandidates_complete _ _ _ otherFeasible) accepted
    simpa only [value, referenceFlow] using bound

def sourceCut (network : Network) : Array Bool :=
  Array.ofFn (fun vertex : Fin network.vertexCount => vertex.val == network.source)

theorem sourceCut_valid (network : Network) (valid : network.Valid) : IsCut network (sourceCut network) := by
  refine ⟨by simp [sourceCut], ?_, ?_⟩
  · simp [sourceCut, cutAt, valid.1]
  · simp [sourceCut, cutAt, valid.2.1, Ne.symm valid.2.2.1]

def cutCandidates (network : Network) : List (Array Bool) :=
  enumerateArrays (fun _ => [false, true]) network.vertexCount

theorem cutCandidates_complete (network : Network) (cut : Array Bool) (isCut : IsCut network cut) :
    cut ∈ cutCandidates network := by
  apply enumerateArrays_complete _ _ _ isCut.1
  intro index _
  cases cut[index]! <;> simp

def referenceCut (network : Network) : Array Bool :=
  minimize (cutCapacityFast network) (cutCheck network) (cutCandidates network) (sourceCut network)

theorem referenceCut_minimum (network : Network) (valid : network.Valid) :
    MinimumCut network (referenceCut network) := by
  have initial := (cutCheck_iff _ _).mpr (sourceCut_valid network valid)
  constructor
  · exact (cutCheck_iff _ _).mp (minimize_accepted _ _ _ _ initial)
  · intro other otherCut
    have bound := minimize_member (cutCapacityFast network) (cutCheck network) (cutCandidates network)
      (sourceCut network) other (cutCandidates_complete _ _ otherCut) ((cutCheck_iff _ _).mpr otherCut)
    simpa only [cutCapacityFast_eq, referenceCut] using bound

def referenceSolve (network : Network) : Solution :=
  let flows := referenceFlow network
  ⟨flows, referenceCut network, inferredValue network flows⟩

/-- Total reference guarantees: the flow is maximum among all feasible integer
flows and the cut is minimum among all source/sink cuts. No success premise. -/
theorem referenceSolve_correct (network : Network) (valid : network.Valid) :
    Solves network (referenceSolve network) :=
  ⟨referenceFlow_maximum network valid, referenceCut_minimum network valid⟩

/-- The fallback's independently selected optima also have exactly matching
values, by the proved integer max-flow/min-cut theorem. -/
theorem referenceSolve_flow_cut_equal (network : Network) (valid : network.Valid) :
    (referenceSolve network).value = cutCapacity network (referenceSolve network).cut :=
  solves_flow_cut_equal network (referenceSolve network) valid (referenceSolve_correct network valid)

theorem referenceSolve_certificate (network : Network) (valid : network.Valid) :
    certificateCheck network (referenceSolve network) = true := by
  apply (certificateCheck_iff _ _).mpr
  have correct := referenceSolve_correct network valid
  exact ⟨correct.1.1, correct.2.1, referenceSolve_flow_cut_equal network valid⟩

end LeanDinic
