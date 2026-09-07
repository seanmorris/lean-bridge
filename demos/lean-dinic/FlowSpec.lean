import Init

/-! A directed capacitated multigraph. Each array entry is a distinct edge,
including parallel, antiparallel, and self-loop entries. Capacities and flows
use exact nonnegative integers. -/

namespace LeanDinic

structure Edge where
  source : Nat
  target : Nat
  capacity : Nat
  deriving Inhabited, Repr, BEq, DecidableEq

structure Network where
  vertexCount : Nat
  source : Nat
  sink : Nat
  edges : Array Edge
  deriving Inhabited, Repr

structure Solution where
  flows : Array Nat
  cut : Array Bool
  value : Nat
  deriving Inhabited, Repr

def Network.Valid (network : Network) : Prop :=
  network.source < network.vertexCount ∧ network.sink < network.vertexCount ∧
  network.source ≠ network.sink ∧
  ∀ index, index < network.edges.size →
    (network.edges[index]!).source < network.vertexCount ∧
    (network.edges[index]!).target < network.vertexCount

def sumNat : Nat → (Nat → Nat) → Nat
  | 0, _ => 0
  | count + 1, term => sumNat count term + term count

def sumInt : Nat → (Nat → Int) → Int
  | 0, _ => 0
  | count + 1, term => sumInt count term + term count

def flowAt (flows : Array Nat) (index : Nat) : Nat := flows[index]?.getD 0

def cutAt (cut : Array Bool) (vertex : Nat) : Bool := cut[vertex]?.getD false

def divergence (network : Network) (flows : Array Nat) (vertex : Nat) : Int :=
  sumInt network.edges.size fun index =>
    let edge := network.edges[index]!
    (if edge.source = vertex then (flowAt flows index : Int) else 0) -
    (if edge.target = vertex then (flowAt flows index : Int) else 0)

def terminalBalance (network : Network) (value vertex : Nat) : Int :=
  (if vertex = network.source then (value : Int) else 0) -
  (if vertex = network.sink then (value : Int) else 0)

def Feasible (network : Network) (flows : Array Nat) (value : Nat) : Prop :=
  flows.size = network.edges.size ∧
  (∀ index, index < network.edges.size → flowAt flows index ≤ (network.edges[index]!).capacity) ∧
  ∀ vertex, vertex < network.vertexCount →
    divergence network flows vertex = terminalBalance network value vertex

def IsCut (network : Network) (cut : Array Bool) : Prop :=
  cut.size = network.vertexCount ∧ cutAt cut network.source = true ∧
    cutAt cut network.sink = false

def cutCapacity (network : Network) (cut : Array Bool) : Nat :=
  sumNat network.edges.size fun index =>
    let edge := network.edges[index]!
    if cutAt cut edge.source && !cutAt cut edge.target then edge.capacity else 0

def MaximumFlow (network : Network) (flows : Array Nat) (value : Nat) : Prop :=
  Feasible network flows value ∧
    ∀ other otherValue, Feasible network other otherValue → otherValue ≤ value

def MinimumCut (network : Network) (cut : Array Bool) : Prop :=
  IsCut network cut ∧ ∀ other, IsCut network other → cutCapacity network cut ≤ cutCapacity network other

def Solves (network : Network) (solution : Solution) : Prop :=
  MaximumFlow network solution.flows solution.value ∧ MinimumCut network solution.cut

end LeanDinic
