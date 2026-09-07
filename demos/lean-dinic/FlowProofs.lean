import FlowSpec

namespace LeanDinic

theorem sumInt_congr (count : Nat) (left right : Nat → Int)
    (same : ∀ index, index < count → left index = right index) :
    sumInt count left = sumInt count right := by
  induction count with
  | zero => rfl
  | succ count ih =>
      simp only [sumInt, ih (fun index bound => same index (by omega)), same count (by omega)]

theorem sumInt_add (count : Nat) (left right : Nat → Int) :
    sumInt count (fun index => left index + right index) = sumInt count left + sumInt count right := by
  induction count with
  | zero => rfl
  | succ count ih => simp only [sumInt, ih]; omega

theorem sumInt_sub (count : Nat) (left right : Nat → Int) :
    sumInt count (fun index => left index - right index) = sumInt count left - sumInt count right := by
  induction count with
  | zero => rfl
  | succ count ih => simp only [sumInt, ih]; omega

theorem sumInt_zero (count : Nat) : sumInt count (fun _ => 0) = 0 := by
  induction count with
  | zero => rfl
  | succ count ih => simp [sumInt, ih]

theorem sumInt_delta (count vertex : Nat) (value : Int) :
    sumInt count (fun index => if index = vertex then value else 0) =
      if vertex < count then value else 0 := by
  induction count with
  | zero => simp [sumInt]
  | succ count ih =>
      simp only [sumInt, ih]
      split <;> split <;> split <;> simp_all <;> omega

theorem sumInt_comm (rows columns : Nat) (term : Nat → Nat → Int) :
    sumInt rows (fun row => sumInt columns (term row)) =
      sumInt columns (fun column => sumInt rows (fun row => term row column)) := by
  induction rows with
  | zero => simp only [sumInt, sumInt_zero]
  | succ rows ih => simp only [sumInt, ih, sumInt_add]

theorem sumInt_nat (count : Nat) (term : Nat → Nat) :
    sumInt count (fun index => (term index : Int)) = (sumNat count term : Int) := by
  induction count with
  | zero => rfl
  | succ count ih => simp [sumInt, sumNat, ih]

theorem sumInt_le (count : Nat) (left right : Nat → Int)
    (bounded : ∀ index, index < count → left index ≤ right index) :
    sumInt count left ≤ sumInt count right := by
  induction count with
  | zero => simp [sumInt]
  | succ count ih =>
      have previous := ih (fun index bound => bounded index (by omega))
      have current := bounded count (by omega)
      simp only [sumInt]
      omega

theorem sumInt_cut_delta (count vertex : Nat) (cut : Array Bool) (value : Int)
    (bound : vertex < count) :
    sumInt count (fun index => if cutAt cut index then (if vertex = index then value else 0) else 0) =
      if cutAt cut vertex then value else 0 := by
  rw [sumInt_congr count _ (fun index => if index = vertex then (if cutAt cut vertex then value else 0) else 0)]
  · simp [sumInt_delta, bound]
  · intro index _
    by_cases same : vertex = index
    · subst index; simp
    · simp [same, Ne.symm same]

theorem cut_divergence (network : Network) (flows : Array Nat) (cut : Array Bool)
    (valid : network.Valid) :
    sumInt network.vertexCount (fun vertex => if cutAt cut vertex then divergence network flows vertex else 0) =
      sumInt network.edges.size (fun index =>
        (if cutAt cut (network.edges[index]!).source then (flowAt flows index : Int) else 0) -
        (if cutAt cut (network.edges[index]!).target then (flowAt flows index : Int) else 0)) := by
  have distribute (vertex : Nat) :
      (if cutAt cut vertex then divergence network flows vertex else 0) =
        sumInt network.edges.size (fun index =>
          (if cutAt cut vertex then (if (network.edges[index]!).source = vertex then (flowAt flows index : Int) else 0) else 0) -
          (if cutAt cut vertex then (if (network.edges[index]!).target = vertex then (flowAt flows index : Int) else 0) else 0)) := by
    cases cutAt cut vertex <;> simp [divergence, sumInt_zero]
  simp only [distribute]
  rw [sumInt_comm]
  apply sumInt_congr
  intro index bound
  rw [sumInt_sub, sumInt_cut_delta _ _ _ _ (valid.2.2.2 index bound).1,
    sumInt_cut_delta _ _ _ _ (valid.2.2.2 index bound).2]

theorem feasible_cut_balance (network : Network) (flows : Array Nat) (value : Nat)
    (cut : Array Bool) (valid : network.Valid) (feasible : Feasible network flows value)
    (isCut : IsCut network cut) :
    sumInt network.edges.size (fun index =>
      (if cutAt cut (network.edges[index]!).source then (flowAt flows index : Int) else 0) -
      (if cutAt cut (network.edges[index]!).target then (flowAt flows index : Int) else 0)) = value := by
  rw [← cut_divergence network flows cut valid]
  rw [sumInt_congr _ _ (fun vertex => if cutAt cut vertex then terminalBalance network value vertex else 0)
    (fun vertex bound => by rw [feasible.2.2 vertex bound])]
  have expand (vertex : Nat) :
      (if cutAt cut vertex then terminalBalance network value vertex else 0) =
      (if cutAt cut vertex then (if network.source = vertex then (value : Int) else 0) else 0) -
      (if cutAt cut vertex then (if network.sink = vertex then (value : Int) else 0) else 0) := by
    cases cutAt cut vertex <;> simp [terminalBalance, eq_comm]
  simp only [expand]
  rw [sumInt_sub, sumInt_cut_delta _ _ _ _ valid.1,
    sumInt_cut_delta _ _ _ _ valid.2.1]
  simp [isCut.2.1, isCut.2.2]

/-- Every feasible directed flow is bounded by every source/sink cut. -/
theorem flow_cut_upper_bound (network : Network) (flows : Array Nat) (value : Nat)
    (cut : Array Bool) (valid : network.Valid) (feasible : Feasible network flows value)
    (isCut : IsCut network cut) : value ≤ cutCapacity network cut := by
  have bound := sumInt_le network.edges.size
    (fun index =>
      (if cutAt cut (network.edges[index]!).source then (flowAt flows index : Int) else 0) -
      (if cutAt cut (network.edges[index]!).target then (flowAt flows index : Int) else 0))
    (fun index => ((if cutAt cut (network.edges[index]!).source && !cutAt cut (network.edges[index]!).target
      then (network.edges[index]!).capacity else 0 : Nat) : Int)) (by
      intro index bound
      have capacity := feasible.2.1 index bound
      cases cutAt cut (network.edges[index]!).source <;>
        cases cutAt cut (network.edges[index]!).target <;> simp_all <;> omega)
  rw [feasible_cut_balance network flows value cut valid feasible isCut, sumInt_nat] at bound
  exact_mod_cast bound

/-- Matching feasible flow and cut capacities certify both optima. -/
theorem matching_flow_cut_optimal (network : Network) (solution : Solution)
    (valid : network.Valid) (feasible : Feasible network solution.flows solution.value)
    (isCut : IsCut network solution.cut) (equal : solution.value = cutCapacity network solution.cut) :
    Solves network solution := by
  constructor
  · refine ⟨feasible, ?_⟩
    intro other otherValue otherFeasible
    rw [equal]
    exact flow_cut_upper_bound network other otherValue solution.cut valid otherFeasible isCut
  · refine ⟨isCut, ?_⟩
    intro other otherCut
    rw [← equal]
    exact flow_cut_upper_bound network solution.flows solution.value other valid feasible otherCut

def totalCapacity (network : Network) : Nat :=
  sumNat network.edges.size (fun index => (network.edges[index]!).capacity)

theorem cutCapacity_bounded (network : Network) (cut : Array Bool) :
    cutCapacity network cut ≤ totalCapacity network := by
  have bound := sumInt_le network.edges.size
    (fun index => ((if cutAt cut (network.edges[index]!).source && !cutAt cut (network.edges[index]!).target
      then (network.edges[index]!).capacity else 0 : Nat) : Int))
    (fun index => ((network.edges[index]!).capacity : Int)) (by
      intro index _
      split <;> omega)
  simp only [sumInt_nat] at bound
  exact_mod_cast bound

theorem totalCapacity_uniform_bound (network : Network) (limit : Nat)
    (bounded : ∀ index, index < network.edges.size → (network.edges[index]!).capacity ≤ limit) :
    totalCapacity network ≤ network.edges.size * limit := by
  have all (count : Nat) (bound : count ≤ network.edges.size) :
      sumNat count (fun index => (network.edges[index]!).capacity) ≤ count * limit := by
    induction count with
    | zero => simp [sumNat]
    | succ count ih =>
        have previous := ih (by omega)
        have current := bounded count (by omega)
        simp only [sumNat, Nat.succ_mul]
        omega
  exact all network.edges.size (Nat.le_refl _)

/-- The browser's one-million-edge, unsigned-32-bit input limits keep all
capacity totals within JavaScript's exact integer range. -/
theorem totalCapacity_javascript_exact (network : Network)
    (edges : network.edges.size ≤ 1000000)
    (capacities : ∀ index, index < network.edges.size → (network.edges[index]!).capacity ≤ 4294967295) :
    totalCapacity network < 9007199254740992 := by
  have total := totalCapacity_uniform_bound network 4294967295 capacities
  have maximum := Nat.mul_le_mul_right 4294967295 edges
  omega

def outgoingFlow (network : Network) (flows : Array Nat) (vertex : Nat) : Nat :=
  sumNat network.edges.size (fun index => if (network.edges[index]!).source = vertex then flowAt flows index else 0)

def incomingFlow (network : Network) (flows : Array Nat) (vertex : Nat) : Nat :=
  sumNat network.edges.size (fun index => if (network.edges[index]!).target = vertex then flowAt flows index else 0)

theorem divergence_eq_outgoing_sub_incoming (network : Network) (flows : Array Nat) (vertex : Nat) :
    divergence network flows vertex = (outgoingFlow network flows vertex : Int) - incomingFlow network flows vertex := by
  unfold divergence outgoingFlow incomingFlow
  rw [sumInt_sub]
  have source (index : Nat) :
      (if (network.edges[index]!).source = vertex then (flowAt flows index : Int) else 0) =
        ((if (network.edges[index]!).source = vertex then flowAt flows index else 0 : Nat) : Int) := by split <;> rfl
  have target (index : Nat) :
      (if (network.edges[index]!).target = vertex then (flowAt flows index : Int) else 0) =
        ((if (network.edges[index]!).target = vertex then flowAt flows index else 0 : Nat) : Int) := by split <;> rfl
  simp only [source, target, sumInt_nat]

theorem feasible_internal_conservation (network : Network) (flows : Array Nat) (value vertex : Nat)
    (feasible : Feasible network flows value) (bound : vertex < network.vertexCount)
    (notSource : vertex ≠ network.source) (notSink : vertex ≠ network.sink) :
    outgoingFlow network flows vertex = incomingFlow network flows vertex := by
  have balance := feasible.2.2 vertex bound
  simp only [divergence_eq_outgoing_sub_incoming, terminalBalance, notSource, notSink, ↓reduceIte] at balance
  omega

theorem feasible_source_value (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value) :
    outgoingFlow network flows network.source = incomingFlow network flows network.source + value := by
  have balance := feasible.2.2 network.source valid.1
  simp only [divergence_eq_outgoing_sub_incoming, terminalBalance, valid.2.2.1, ↓reduceIte] at balance
  omega

theorem feasible_sink_value (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value) :
    incomingFlow network flows network.sink = outgoingFlow network flows network.sink + value := by
  have balance := feasible.2.2 network.sink valid.2.1
  simp only [divergence_eq_outgoing_sub_incoming, terminalBalance, Ne.symm valid.2.2.1, ↓reduceIte] at balance
  omega

theorem feasible_value_bounded (network : Network) (flows : Array Nat) (value : Nat)
    (valid : network.Valid) (feasible : Feasible network flows value) : value ≤ totalCapacity network := by
  have outgoing := sumInt_le network.edges.size
    (fun index => ((if (network.edges[index]!).source = network.source then flowAt flows index else 0 : Nat) : Int))
    (fun index => ((network.edges[index]!).capacity : Int)) (by
      intro index bound
      have capacity := feasible.2.1 index bound
      split <;> omega)
  simp only [sumInt_nat] at outgoing
  have outgoingBound : outgoingFlow network flows network.source ≤ totalCapacity network := by
    exact_mod_cast outgoing
  have balance := feasible_source_value network flows value valid feasible
  omega

theorem sumInt_eq_each (count : Nat) (left right : Nat → Int)
    (bounded : ∀ index, index < count → left index ≤ right index)
    (equal : sumInt count left = sumInt count right) :
    ∀ index, index < count → left index = right index := by
  induction count with
  | zero => omega
  | succ count ih =>
      have previous := sumInt_le count left right (fun index bound => bounded index (by omega))
      have current := bounded count (by omega)
      simp only [sumInt] at equal
      intro index bound
      by_cases last : index = count
      · subst index; omega
      · exact ih (fun index bound => bounded index (by omega)) (by omega) index (by omega)

/-- A matched cut has every outgoing crossing edge saturated and every incoming
crossing edge empty. This is the precise bottleneck shown by the demo. -/
theorem matching_cut_edges (network : Network) (solution : Solution)
    (valid : network.Valid) (feasible : Feasible network solution.flows solution.value)
    (isCut : IsCut network solution.cut) (equal : solution.value = cutCapacity network solution.cut)
    (index : Nat) (bound : index < network.edges.size) :
    (cutAt solution.cut (network.edges[index]!).source = true →
      cutAt solution.cut (network.edges[index]!).target = false →
      flowAt solution.flows index = (network.edges[index]!).capacity) ∧
    (cutAt solution.cut (network.edges[index]!).source = false →
      cutAt solution.cut (network.edges[index]!).target = true → flowAt solution.flows index = 0) := by
  let left := fun index =>
      (if cutAt solution.cut (network.edges[index]!).source then (flowAt solution.flows index : Int) else 0) -
      (if cutAt solution.cut (network.edges[index]!).target then (flowAt solution.flows index : Int) else 0)
  let right := fun (index : Nat) => ((if cutAt solution.cut (network.edges[index]!).source && !cutAt solution.cut (network.edges[index]!).target
      then (network.edges[index]!).capacity else 0 : Nat) : Int)
  have bounded : ∀ index, index < network.edges.size → left index ≤ right index := by
    intro index bound
    have capacity := feasible.2.1 index bound
    unfold left right
    cases cutAt solution.cut (network.edges[index]!).source <;>
      cases cutAt solution.cut (network.edges[index]!).target <;> simp_all <;> omega
  have total : sumInt network.edges.size left = sumInt network.edges.size right := by
    rw [feasible_cut_balance network solution.flows solution.value solution.cut valid feasible isCut]
    simp only [right, sumInt_nat]
    exact congrArg Int.ofNat equal
  have edge := sumInt_eq_each network.edges.size left right bounded total index bound
  constructor <;> intro source target <;> simp [left, right, source, target] at edge <;> omega

end LeanDinic
