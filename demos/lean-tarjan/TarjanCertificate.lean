import TarjanReachability

/-! Linear-size certificates for exact strongly connected components. Ranked
trees establish connectivity; the order of component exits establishes maximality. -/

namespace LeanTarjan

structure SccCertificate (count : Nat) (edge : Nat → Nat → Bool) (labels : Array Nat)
    (popOrder parentForward rankForward parentReverse rankReverse : Nat → Nat) : Prop where
  size : labels.size = count
  bounded : ∀ vertex, vertex < count → labelAt labels vertex < count
  rooted : ∀ vertex, vertex < count → labelAt labels (labelAt labels vertex) = labelAt labels vertex
  forward : ∀ vertex, vertex < count → vertex ≠ labelAt labels vertex →
    parentForward vertex < count ∧
      labelAt labels (parentForward vertex) = labelAt labels vertex ∧
      rankForward (parentForward vertex) < rankForward vertex ∧
      edge (parentForward vertex) vertex = true
  reverse : ∀ vertex, vertex < count → vertex ≠ labelAt labels vertex →
    parentReverse vertex < count ∧
      labelAt labels (parentReverse vertex) = labelAt labels vertex ∧
      rankReverse (parentReverse vertex) < rankReverse vertex ∧
      edge vertex (parentReverse vertex) = true
  descending : ∀ source target, Edge count edge source target →
    labelAt labels source ≠ labelAt labels target →
      popOrder (labelAt labels target) < popOrder (labelAt labels source)

theorem certificate_forward_reachable
    {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    {popOrder parentForward rankForward parentReverse rankReverse : Nat → Nat}
    (certificate : SccCertificate count edge labels popOrder parentForward rankForward parentReverse rankReverse)
    (vertex : Nat) (bound : vertex < count) :
    Reachable count edge (labelAt labels vertex) vertex := by
  have all : ∀ rank vertex, rankForward vertex = rank → vertex < count →
      Reachable count edge (labelAt labels vertex) vertex := by
    intro rank
    induction rank using Nat.strongRecOn with
    | ind rank ih =>
        intro vertex eq bound
        by_cases root : vertex = labelAt labels vertex
        · rw [← root]
          exact reachable_refl count edge vertex bound
        · have step := certificate.forward vertex bound root
          have previous := ih (rankForward (parentForward vertex)) (by omega)
            (parentForward vertex) rfl step.1
          rw [step.2.1] at previous
          exact reachable_trans count edge (labelAt labels vertex) (parentForward vertex) vertex
            previous (reachable_edge count edge _ _ ⟨step.1, bound, step.2.2.2⟩)
  exact all (rankForward vertex) vertex rfl bound

theorem certificate_reverse_reachable
    {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    {popOrder parentForward rankForward parentReverse rankReverse : Nat → Nat}
    (certificate : SccCertificate count edge labels popOrder parentForward rankForward parentReverse rankReverse)
    (vertex : Nat) (bound : vertex < count) :
    Reachable count edge vertex (labelAt labels vertex) := by
  have all : ∀ rank vertex, rankReverse vertex = rank → vertex < count →
      Reachable count edge vertex (labelAt labels vertex) := by
    intro rank
    induction rank using Nat.strongRecOn with
    | ind rank ih =>
        intro vertex eq bound
        by_cases root : vertex = labelAt labels vertex
        · rw [← root]
          exact reachable_refl count edge vertex bound
        · have step := certificate.reverse vertex bound root
          have previous := ih (rankReverse (parentReverse vertex)) (by omega)
            (parentReverse vertex) rfl step.1
          rw [step.2.1] at previous
          exact reachable_trans count edge vertex (parentReverse vertex) (labelAt labels vertex)
            (reachable_edge count edge _ _ ⟨bound, step.1, step.2.2.2⟩) previous
  exact all (rankReverse vertex) vertex rfl bound

theorem certificate_walk_order
    {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    {popOrder parentForward rankForward parentReverse rankReverse : Nat → Nat}
    (certificate : SccCertificate count edge labels popOrder parentForward rankForward parentReverse rankReverse)
    (source target : Nat) (path : List Nat) (walk : Walk count edge source target path) :
    popOrder (labelAt labels target) ≤ popOrder (labelAt labels source) ∧
      (labelAt labels source ≠ labelAt labels target →
        popOrder (labelAt labels target) < popOrder (labelAt labels source)) := by
  induction path generalizing source with
  | nil =>
      simp only [Walk] at walk
      simp [walk]
  | cons next rest ih =>
      have tail := ih next walk.2
      by_cases same : labelAt labels source = labelAt labels next
      · rw [same]
        exact tail
      · have strict := certificate.descending source next walk.1 same
        exact ⟨by omega, fun _ => by omega⟩

/-- The certificate proves both directions: every reported component is strongly
connected, and mutually reachable vertices cannot be split across components. -/
theorem certificate_partition
    {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    {popOrder parentForward rankForward parentReverse rankReverse : Nat → Nat}
    (certificate : SccCertificate count edge labels popOrder parentForward rankForward parentReverse rankReverse) :
    PartitionSpec count edge labels := by
  refine ⟨certificate.size, certificate.bounded, certificate.rooted, ?_⟩
  intro source sourceBound target targetBound
  constructor
  · intro same
    have sourceForward := certificate_forward_reachable certificate source sourceBound
    have sourceReverse := certificate_reverse_reachable certificate source sourceBound
    have targetForward := certificate_forward_reachable certificate target targetBound
    have targetReverse := certificate_reverse_reachable certificate target targetBound
    rw [same] at sourceForward sourceReverse
    exact ⟨reachable_trans count edge source (labelAt labels target) target sourceReverse targetForward,
      reachable_trans count edge target (labelAt labels target) source targetReverse sourceForward⟩
  · intro connected
    by_cases same : labelAt labels source = labelAt labels target
    · exact same
    · obtain ⟨forward, forwardWalk⟩ := connected.1.2.2
      obtain ⟨reverse, reverseWalk⟩ := connected.2.2.2
      have decrease := (certificate_walk_order certificate source target forward forwardWalk).2 same
      have increase := (certificate_walk_order certificate target source reverse reverseWalk).1
      omega

/-- A nonempty strongly connected set that cannot be enlarged while preserving
mutual reachability. -/
def IsStrongComponent (count : Nat) (edge : Nat → Nat → Bool) (members : Nat → Prop) : Prop :=
  (∃ vertex, members vertex) ∧
    (∀ source, members source → ∀ target, members target → Mutual count edge source target) ∧
    ∀ larger : Nat → Prop, (∀ vertex, members vertex → larger vertex) →
      (∀ source, larger source → ∀ target, larger target → Mutual count edge source target) →
      ∀ vertex, larger vertex → members vertex

theorem partition_maximal {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    (partition : PartitionSpec count edge labels) (root : Nat) (bound : root < count) :
    IsStrongComponent count edge (fun vertex => vertex < count ∧
      labelAt labels vertex = labelAt labels root) := by
  refine ⟨⟨root, bound, rfl⟩, ?_, ?_⟩
  · intro source sourceMem target targetMem
    exact (partition.same_iff source sourceMem.1 target targetMem.1).mp
      (sourceMem.2.trans targetMem.2.symm)
  · intro larger contains connected vertex member
    have rootMember := contains root ⟨bound, rfl⟩
    have both := connected vertex member root rootMember
    exact ⟨both.1.1, (partition.same_iff vertex both.1.1 root bound).mpr both⟩

def CondensationEdge (count : Nat) (edge : Nat → Nat → Bool) (labels : Array Nat)
    (sourceRoot targetRoot : Nat) : Prop :=
  sourceRoot ≠ targetRoot ∧ ∃ source target,
    Edge count edge source target ∧ labelAt labels source = sourceRoot ∧ labelAt labels target = targetRoot

def CondensationWalk (count : Nat) (edge : Nat → Nat → Bool) (labels : Array Nat)
    (current target : Nat) : List Nat → Prop
  | [] => current = target
  | next :: rest => CondensationEdge count edge labels current next ∧
      CondensationWalk count edge labels next target rest

theorem condensation_edge_projects {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    (source target : Nat) (connected : Edge count edge source target)
    (different : labelAt labels source ≠ labelAt labels target) :
    CondensationEdge count edge labels (labelAt labels source) (labelAt labels target) :=
  ⟨different, source, target, connected, rfl, rfl⟩

theorem condensation_edge_reachable {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    (partition : PartitionSpec count edge labels) (sourceRoot targetRoot : Nat)
    (connected : CondensationEdge count edge labels sourceRoot targetRoot) :
    Reachable count edge sourceRoot targetRoot ∧
      labelAt labels sourceRoot = sourceRoot ∧ labelAt labels targetRoot = targetRoot := by
  obtain ⟨_, source, target, actual, sourceEq, targetEq⟩ := connected
  have sourceBound := partition.bounded source actual.1
  have targetBound := partition.bounded target actual.2.1
  have sourceFixed := partition.rooted source actual.1
  have targetFixed := partition.rooted target actual.2.1
  rw [sourceEq] at sourceBound sourceFixed
  rw [targetEq] at targetBound targetFixed
  have before := (partition.same_iff sourceRoot sourceBound source actual.1).mp
    (sourceFixed.trans sourceEq.symm)
  have after := (partition.same_iff target actual.2.1 targetRoot targetBound).mp
    (targetEq.trans targetFixed.symm)
  exact ⟨reachable_trans count edge sourceRoot target targetRoot
    (reachable_trans count edge sourceRoot source target before.1
      (reachable_edge count edge source target actual)) after.1,
    sourceFixed, targetFixed⟩

theorem condensation_walk_reachable {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    (partition : PartitionSpec count edge labels) (sourceRoot targetRoot : Nat) (path : List Nat)
    (bound : sourceRoot < count) (walk : CondensationWalk count edge labels sourceRoot targetRoot path) :
    Reachable count edge sourceRoot targetRoot := by
  induction path generalizing sourceRoot with
  | nil =>
      simp only [CondensationWalk] at walk
      subst targetRoot
      exact reachable_refl count edge sourceRoot bound
  | cons next rest ih =>
      have first := condensation_edge_reachable partition sourceRoot next walk.1
      exact reachable_trans count edge sourceRoot next targetRoot first.1
        (ih next first.1.2.1 walk.2)

/-- Contracting the exact components leaves no nonempty directed cycle. -/
theorem condensation_acyclic {count : Nat} {edge : Nat → Nat → Bool} {labels : Array Nat}
    (partition : PartitionSpec count edge labels) (root next : Nat) (rest : List Nat) :
    ¬CondensationWalk count edge labels root root (next :: rest) := by
  intro cycle
  have first := condensation_edge_reachable partition root next cycle.1
  have returnPath := condensation_walk_reachable partition next root rest first.1.2.1 cycle.2
  have same := (partition.same_iff root first.1.1 next first.1.2.1).mpr ⟨first.1, returnPath⟩
  rw [first.2.1, first.2.2] at same
  exact cycle.1.1 same

end LeanTarjan
