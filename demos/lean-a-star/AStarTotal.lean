import DijkstraCore

/-!
A total reference shortest-path solver for finite graphs with natural weights.
The optimized A* search uses this only if its checked candidate is unavailable.
-/

namespace LeanAStar.Total

open LeanDijkstra

theorem strip_return (graph : Graph) (root current target : Nat) (path : List Nat)
    (walk : Walk graph current target path) (returns : root ∈ path) :
    ∃ suffix, root ∉ suffix ∧ Walk graph root target suffix ∧
      pathCost graph root suffix ≤ pathCost graph current path ∧ suffix ⊆ path := by
  induction path generalizing current with
  | nil => simp at returns
  | cons next rest ih =>
      by_cases later : root ∈ rest
      · obtain ⟨suffix, absent, tailWalk, cost, subset⟩ := ih next walk.2 later
        refine ⟨suffix, absent, tailWalk, ?_, ?_⟩
        · simp only [pathCost, costOfPath] at cost ⊢
          omega
        · exact fun _ mem => List.mem_cons_of_mem _ (subset mem)
      · have same : root = next := (List.mem_cons.mp returns).resolve_right later
        subst next
        refine ⟨rest, later, walk.2, ?_, ?_⟩
        · simp only [pathCost, costOfPath]
          omega
        · exact fun _ mem => List.mem_cons_of_mem _ mem

theorem remove_returns (graph : Graph) (current target : Nat) (path : List Nat)
    (walk : Walk graph current target path) :
    ∃ suffix, current ∉ suffix ∧ Walk graph current target suffix ∧
      pathCost graph current suffix ≤ pathCost graph current path ∧ suffix ⊆ path := by
  by_cases returns : current ∈ path
  · exact strip_return graph current current target path walk returns
  · exact ⟨path, returns, walk, Nat.le_refl _, List.Subset.refl _⟩

def RestrictedPath (graph : Graph) (vertices : List Nat) (current target : Nat)
    (path : List Nat) : Prop :=
  Walk graph current target path ∧ (current :: path) ⊆ vertices

def RestrictedShortest (graph : Graph) (vertices : List Nat) (current target : Nat)
    (path : List Nat) : Prop :=
  RestrictedPath graph vertices current target path ∧
    ∀ alternative, RestrictedPath graph vertices current target alternative →
      pathCost graph current path ≤ pathCost graph current alternative

def RestrictedResult (graph : Graph) (vertices : List Nat) (current target : Nat) :
    Option (List Nat) → Prop
  | some path => RestrictedShortest graph vertices current target path
  | none => ∀ path, ¬RestrictedPath graph vertices current target path

abbrev Certified (graph : Graph) (vertices : List Nat) (current target : Nat) :=
  { result // RestrictedResult graph vertices current target result }

def minimum (cost : List Nat → Nat) : List (List Nat) → Option (List Nat)
  | [] => none
  | path :: rest =>
      match minimum cost rest with
      | none => some path
      | some candidate => if cost path ≤ cost candidate then some path else some candidate

theorem minimum_none (cost : List Nat → Nat) (paths : List (List Nat)) :
    minimum cost paths = none ↔ paths = [] := by
  cases paths with
  | nil => simp [minimum]
  | cons path rest =>
      simp only [minimum, List.cons_ne_nil, iff_false]
      cases minimum cost rest <;> simp
      split <;> simp

theorem minimum_some (cost : List Nat → Nat) (paths : List (List Nat)) (path : List Nat)
    (found : minimum cost paths = some path) :
    path ∈ paths ∧ ∀ alternative ∈ paths, cost path ≤ cost alternative := by
  induction paths generalizing path with
  | nil => simp [minimum] at found
  | cons first rest ih =>
      simp only [minimum] at found
      cases tail : minimum cost rest with
      | none =>
          have empty := (minimum_none cost rest).mp tail
          simp_all
      | some candidate =>
          have best := ih candidate tail
          simp only [tail] at found
          split at found
          · rename_i cheap
            simp only [Option.some.injEq] at found
            subst path
            refine ⟨by simp, ?_⟩
            intro alternative member
            rcases List.mem_cons.mp member with same | restMem
            · subst alternative; exact Nat.le_refl _
            · exact Nat.le_trans cheap (best.2 alternative restMem)
          · rename_i expensive
            simp only [Option.some.injEq] at found
            subst path
            refine ⟨List.mem_cons_of_mem _ best.1, ?_⟩
            intro alternative member
            rcases List.mem_cons.mp member with same | restMem
            · subst alternative; omega
            · exact best.2 alternative restMem

def candidate (graph : Graph) (vertices : List Nat) (current target : Nat)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target)
    (next : Nat) : Option (List Nat) :=
  if graph.Edge current next then (oracle next).val.map (List.cons next) else none

theorem candidate_some (graph : Graph) (vertices : List Nat) (current target next : Nat)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target) (path : List Nat) :
    candidate graph vertices current target oracle next = some path ↔
      graph.Edge current next ∧ ∃ tail, (oracle next).val = some tail ∧ path = next :: tail := by
  simp only [candidate]
  split
  · rename_i edge
    cases found : (oracle next).val <;> simp [edge, eq_comm]
  · rename_i missing
    simp [missing]

def candidates (graph : Graph) (vertices : List Nat) (current target : Nat)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target) : List (List Nat) :=
  (vertices.erase current).filterMap (candidate graph vertices current target oracle)

theorem candidates_sound (graph : Graph) (vertices : List Nat) (current target : Nat)
    (present : current ∈ vertices)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target) (path : List Nat)
    (member : path ∈ candidates graph vertices current target oracle) :
    RestrictedPath graph vertices current target path := by
  obtain ⟨next, _, found⟩ := List.mem_filterMap.mp member
  obtain ⟨edge, tail, computed, same⟩ :=
    (candidate_some graph vertices current target next oracle path).mp found
  subst path
  have solved := (oracle next).property
  rw [computed] at solved
  refine ⟨⟨edge, solved.1.1⟩, ?_⟩
  intro vertex member
  rcases List.mem_cons.mp member with same | later
  · subst vertex; exact present
  · exact List.mem_of_mem_erase (solved.1.2 later)

theorem candidates_complete (graph : Graph) (vertices : List Nat) (current target : Nat)
    (different : current ≠ target)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target)
    (path : List Nat) (valid : RestrictedPath graph vertices current target path) :
    ∃ alternative ∈ candidates graph vertices current target oracle,
      pathCost graph current alternative ≤ pathCost graph current path := by
  obtain ⟨trimmed, absent, walk, cost, subset⟩ :=
    remove_returns graph current target path valid.1
  cases trimmed with
  | nil => exact False.elim (different walk)
  | cons next tail =>
      have inside : (next :: tail) ⊆ vertices.erase current := by
        intro vertex member
        apply (List.mem_erase_of_ne _).mpr
        · exact valid.2 (List.mem_cons_of_mem _ (subset member))
        · intro same
          subst vertex
          exact absent member
      have restricted : RestrictedPath graph (vertices.erase current) next target tail :=
        ⟨walk.2, inside⟩
      have solved := (oracle next).property
      cases computed : (oracle next).val with
      | none =>
          rw [computed] at solved
          exact False.elim (solved tail restricted)
      | some suffix =>
          rw [computed] at solved
          refine ⟨next :: suffix, ?_, ?_⟩
          · apply List.mem_filterMap.mpr
            refine ⟨next, inside (by simp), ?_⟩
            exact (candidate_some graph vertices current target next oracle _).mpr
              ⟨walk.1, suffix, computed, rfl⟩
          · have smaller := solved.2 tail restricted
            simp only [pathCost, costOfPath] at smaller cost ⊢
            omega

def step (graph : Graph) (vertices : List Nat) (current target : Nat)
    (present : current ∈ vertices) (different : current ≠ target)
    (oracle : ∀ next, Certified graph (vertices.erase current) next target) :
    Certified graph vertices current target := by
  let paths := candidates graph vertices current target oracle
  match found : minimum (pathCost graph current) paths with
  | none =>
      refine ⟨none, ?_⟩
      intro path valid
      obtain ⟨alternative, member, _⟩ :=
        candidates_complete graph vertices current target different oracle path valid
      have empty := (minimum_none (pathCost graph current) paths).mp found
      rw [show candidates graph vertices current target oracle = [] from empty] at member
      simp at member
  | some path =>
      have best := minimum_some (pathCost graph current) paths path found
      refine ⟨some path, candidates_sound graph vertices current target present oracle path best.1, ?_⟩
      intro alternative valid
      obtain ⟨other, member, cost⟩ :=
        candidates_complete graph vertices current target different oracle alternative valid
      exact Nat.le_trans (best.2 other member) cost

def solveRestricted (graph : Graph) (vertices : List Nat) (current target : Nat) :
    Certified graph vertices current target := by
  if present : current ∈ vertices then
    if same : current = target then
      refine ⟨some [], ⟨same, ?_⟩, ?_⟩
      · simpa using present
      · intro alternative _
        exact Nat.zero_le _
    else
      exact step graph vertices current target present same
        (fun next => solveRestricted graph (vertices.erase current) next target)
  else
    refine ⟨none, ?_⟩
    intro path valid
    exact present (valid.2 (by simp))
termination_by vertices.length
decreasing_by
  have length := List.length_erase_of_mem present
  have positive := List.length_pos_of_mem present
  omega

theorem walk_inside (graph : Graph) (current target : Nat) (path : List Nat)
    (bound : current < graph.size) (walk : Walk graph current target path) :
    (current :: path) ⊆ List.range graph.size := by
  induction path generalizing current with
  | nil => simpa using bound
  | cons next rest ih =>
      have tail := ih next walk.1.2.1 walk.2
      intro vertex member
      rcases List.mem_cons.mp member with same | later
      · subst vertex; exact List.mem_range.mpr bound
      · exact tail later

def AnswerValid (graph : Graph) (start target : Nat) : Option (List Nat) → Prop
  | some path => ShortestPath graph start target path
  | none => ∀ path, ¬Walk graph start target path

/-- A total executable reference: enumerate simple paths, choose their cheapest
member, and prove cycle removal makes that choice optimal among all walks. -/
def totalShortest (graph : Graph) (start target : Nat)
    (bounds : start < graph.size ∧ target < graph.size) :
    { answer // AnswerValid graph start target answer } := by
  let solved := solveRestricted graph (List.range graph.size) start target
  have certified := solved.property
  cases result : solved.val with
  | none =>
      rw [result] at certified
      refine ⟨none, ?_⟩
      intro path walk
      exact certified path ⟨walk, walk_inside graph start target path bounds.1 walk⟩
  | some path =>
      rw [result] at certified
      refine ⟨some path, certified.1.1, ?_⟩
      intro alternative walk
      exact certified.2 alternative ⟨walk,
        walk_inside graph start target alternative bounds.1 walk⟩

theorem total_shortest_correct (graph : Graph) (start target : Nat)
    (bounds : start < graph.size ∧ target < graph.size) :
    AnswerValid graph start target (totalShortest graph start target bounds).val :=
  (totalShortest graph start target bounds).property

theorem total_shortest_found (graph : Graph) (start target : Nat)
    (bounds : start < graph.size ∧ target < graph.size) (path : List Nat)
    (found : (totalShortest graph start target bounds).val = some path) :
    ShortestPath graph start target path := by
  have valid := total_shortest_correct graph start target bounds
  simpa [found, AnswerValid] using valid

theorem total_shortest_unreachable (graph : Graph) (start target : Nat)
    (bounds : start < graph.size ∧ target < graph.size)
    (missing : (totalShortest graph start target bounds).val = none) :
    ∀ path, ¬Walk graph start target path := by
  have valid := total_shortest_correct graph start target bounds
  simpa [missing, AnswerValid] using valid

end LeanAStar.Total
