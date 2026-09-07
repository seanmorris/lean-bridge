import FlowProofs

/-! Linear-time executable certificates. The loops use owned arrays for vertex
balances and exact integer arithmetic. No search or path enumeration is needed
to check a candidate's optimality. -/

namespace LeanDinic

def allBelow : Nat → (Nat → Bool) → Bool
  | 0, _ => true
  | count + 1, predicate => predicate count && allBelow count predicate

theorem allBelow_iff (count : Nat) (predicate : Nat → Bool) :
    allBelow count predicate = true ↔ ∀ index, index < count → predicate index = true := by
  induction count with
  | zero => simp [allBelow]
  | succ count ih =>
      simp only [allBelow, Bool.and_eq_true, ih]
      constructor
      · rintro ⟨current, previous⟩ index bound
        by_cases last : index = count
        · simpa [last] using current
        · exact previous index (by omega)
      · intro checked
        exact ⟨checked count (by omega), fun index bound => checked index (by omega)⟩

def balanceAt (balances : Array Int) (vertex : Nat) : Int := balances[vertex]?.getD 0

def addFlowEdge (balances : Array Int) (edge : Edge) (flow : Nat) : Array Int :=
  (balances.modify edge.source (fun balance => balance + (flow : Int))).modify edge.target
    (fun balance => balance - (flow : Int))

theorem addFlowEdge_size (balances : Array Int) (edge : Edge) (flow : Nat) :
    (addFlowEdge balances edge flow).size = balances.size := by simp [addFlowEdge]

theorem addFlowEdge_at (balances : Array Int) (edge : Edge) (flow vertex : Nat)
    (bound : vertex < balances.size) :
    balanceAt (addFlowEdge balances edge flow) vertex = balanceAt balances vertex +
      ((if edge.source = vertex then (flow : Int) else 0) -
       (if edge.target = vertex then (flow : Int) else 0)) := by
  simp only [addFlowEdge, balanceAt, Array.getElem?_modify]
  by_cases source : edge.source = vertex <;> by_cases target : edge.target = vertex <;>
    simp [source, target, bound] <;> omega

def accumulateBalances (network : Network) (flows : Array Nat) : Nat → Array Int → Array Int
  | 0, balances => balances
  | count + 1, balances =>
      accumulateBalances network flows count
        (addFlowEdge balances network.edges[count]! (flowAt flows count))

theorem accumulateBalances_size (network : Network) (flows : Array Nat) (count : Nat)
    (balances : Array Int) :
    (accumulateBalances network flows count balances).size = balances.size := by
  induction count generalizing balances with
  | zero => rfl
  | succ count ih => simp only [accumulateBalances, ih, addFlowEdge_size]

theorem accumulateBalances_at (network : Network) (flows : Array Nat) (count : Nat)
    (balances : Array Int) (vertex : Nat) (bound : vertex < balances.size) :
    balanceAt (accumulateBalances network flows count balances) vertex = balanceAt balances vertex +
      sumInt count (fun index =>
        (if (network.edges[index]!).source = vertex then (flowAt flows index : Int) else 0) -
        (if (network.edges[index]!).target = vertex then (flowAt flows index : Int) else 0)) := by
  induction count generalizing balances with
  | zero => simp [accumulateBalances, sumInt]
  | succ count ih =>
      simp only [accumulateBalances, sumInt]
      rw [ih _ (by simpa [addFlowEdge_size] using bound), addFlowEdge_at _ _ _ _ bound]
      omega

def flowBalances (network : Network) (flows : Array Nat) : Array Int :=
  accumulateBalances network flows network.edges.size (Array.replicate network.vertexCount 0)

theorem flowBalances_at (network : Network) (flows : Array Nat) (vertex : Nat)
    (bound : vertex < network.vertexCount) :
    balanceAt (flowBalances network flows) vertex = divergence network flows vertex := by
  rw [flowBalances, accumulateBalances_at _ _ _ _ _ (by simpa using bound)]
  simp [balanceAt, bound, divergence]

def sumNatFrom (term : Nat → Nat) : Nat → Nat → Nat
  | 0, total => total
  | count + 1, total => sumNatFrom term count (total + term count)

theorem sumNatFrom_eq (term : Nat → Nat) (count total : Nat) :
    sumNatFrom term count total = total + sumNat count term := by
  induction count generalizing total with
  | zero => simp [sumNatFrom, sumNat]
  | succ count ih => simp only [sumNatFrom, ih, sumNat]; omega

def cutCapacityFast (network : Network) (cut : Array Bool) : Nat :=
  sumNatFrom (fun index =>
    let edge := network.edges[index]!
    if cutAt cut edge.source && !cutAt cut edge.target then edge.capacity else 0) network.edges.size 0

theorem cutCapacityFast_eq (network : Network) (cut : Array Bool) :
    cutCapacityFast network cut = cutCapacity network cut := by
  simp [cutCapacityFast, cutCapacity, sumNatFrom_eq]

def feasibleCheck (network : Network) (flows : Array Nat) (value : Nat) : Bool :=
  flows.size == network.edges.size &&
    allBelow network.edges.size (fun index => decide (flowAt flows index ≤ (network.edges[index]!).capacity)) &&
    (let balances := flowBalances network flows
     allBelow network.vertexCount (fun vertex => balanceAt balances vertex == terminalBalance network value vertex))

theorem feasibleCheck_iff (network : Network) (flows : Array Nat) (value : Nat) :
    feasibleCheck network flows value = true ↔ Feasible network flows value := by
  simp only [feasibleCheck, Bool.and_eq_true, beq_iff_eq, allBelow_iff, decide_eq_true_eq]
  simp only [Feasible]
  constructor
  · rintro ⟨⟨size, capacity⟩, balances⟩
    exact ⟨size, capacity, fun vertex bound => by
      simpa [flowBalances_at network flows vertex bound] using balances vertex bound⟩
  · rintro ⟨size, capacity, balances⟩
    exact ⟨⟨size, capacity⟩, fun vertex bound => by
      simpa [flowBalances_at network flows vertex bound] using balances vertex bound⟩

def cutCheck (network : Network) (cut : Array Bool) : Bool :=
  cut.size == network.vertexCount && cutAt cut network.source && !cutAt cut network.sink

theorem cutCheck_iff (network : Network) (cut : Array Bool) :
    cutCheck network cut = true ↔ IsCut network cut := by
  simp [cutCheck, IsCut, Bool.and_eq_true, and_assoc]

def certificateCheck (network : Network) (solution : Solution) : Bool :=
  feasibleCheck network solution.flows solution.value && cutCheck network solution.cut &&
    solution.value == cutCapacityFast network solution.cut

theorem certificateCheck_iff (network : Network) (solution : Solution) :
    certificateCheck network solution = true ↔
      Feasible network solution.flows solution.value ∧ IsCut network solution.cut ∧
        solution.value = cutCapacity network solution.cut := by
  simp [certificateCheck, Bool.and_eq_true, feasibleCheck_iff, cutCheck_iff, cutCapacityFast_eq, and_assoc]

/-- The actual executable certificate proves capacity, conservation, and both
global optimality claims, rather than merely checking one solver's history. -/
theorem certificateCheck_sound (network : Network) (solution : Solution)
    (valid : network.Valid) (checked : certificateCheck network solution = true) : Solves network solution := by
  have facts := (certificateCheck_iff network solution).mp checked
  exact matching_flow_cut_optimal network solution valid facts.1 facts.2.1 facts.2.2

end LeanDinic
