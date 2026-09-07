import TopologicalSortOrderLemmas

namespace LeanTopologicalSort.Total

def Walk (edge : Nat → Nat → Bool) : List Nat → Prop
  | [] => True
  | [_] => True
  | a :: b :: rest => edge a b = true ∧ Walk edge (b :: rest)

def OrderValid (edge : Nat → Nat → Bool) (vertices order : List Nat) : Prop :=
  order.Perm vertices ∧ ∀ u ∈ vertices, ∀ v ∈ vertices,
    edge u v = true → order.idxOf u < order.idxOf v

def CycleValid (edge : Nat → Nat → Bool) (vertices cycle : List Nat) : Prop :=
  cycle.Nodup ∧ cycle ≠ [] ∧ cycle ⊆ vertices ∧ Walk edge (cycle ++ [cycle.headD 0])

theorem walk_getElem (edge : Nat → Nat → Bool) (xs : List Nat) (path : Walk edge xs)
    (index : Nat) (bound : index + 1 < xs.length) :
    edge xs[index] xs[index + 1] = true := by
  induction xs generalizing index with
  | nil => simp at bound
  | cons x xs ih =>
      cases xs with
      | nil => simp at bound
      | cons y ys =>
          cases index with
          | zero => exact path.1
          | succ index => exact ih path.2 index (by simpa using bound)

def prefixThrough (target : Nat) : List Nat → List Nat
  | [] => []
  | x :: xs => if x = target then [x] else x :: prefixThrough target xs

theorem prefixThrough_sublist (target : Nat) (xs : List Nat) :
    List.Sublist (prefixThrough target xs) xs := by
  induction xs with
  | nil => simp [prefixThrough]
  | cons x xs ih =>
      simp only [prefixThrough]
      split
      · exact List.Sublist.cons_cons _ (List.nil_sublist _)
      · exact List.Sublist.cons_cons _ ih

theorem prefixThrough_nonempty {target : Nat} {xs : List Nat} (member : target ∈ xs) :
    prefixThrough target xs ≠ [] := by
  cases xs with
  | nil => simp at member
  | cons x xs => simp only [prefixThrough]; split <;> simp

theorem prefixThrough_head {target : Nat} {xs : List Nat} (member : target ∈ xs) :
    (prefixThrough target xs).headD 0 = xs.headD 0 := by
  cases xs with
  | nil => simp at member
  | cons x xs => simp only [prefixThrough]; split <;> rfl

theorem close_prefix (edge : Nat → Nat → Bool) (target finish : Nat) (xs : List Nat)
    (member : target ∈ xs) (path : Walk edge xs) (closing : edge target finish = true) :
    Walk edge (prefixThrough target xs ++ [finish]) := by
  induction xs with
  | nil => simp at member
  | cons x xs ih =>
      simp only [prefixThrough]
      split
      · rename_i eq
        subst target
        exact ⟨closing, trivial⟩
      · rename_i ne
        have memtail : target ∈ xs := (List.mem_cons.mp member).resolve_left (Ne.symm ne)
        cases xs with
        | nil => simp at memtail
        | cons y ys =>
            have next := ih memtail path.2
            by_cases same : y = target
            · simpa [prefixThrough, same, Walk] using And.intro path.1 next
            · simpa [prefixThrough, same, Walk] using And.intro path.1 next

def chooseVertex (vertices : List Nat) (p : Nat → Bool)
    (existsVertex : ∃ x ∈ vertices, p x = true) : { x // x ∈ vertices ∧ p x = true } :=
  match found : vertices.find? p with
  | some x => ⟨x, List.mem_of_find?_eq_some found, List.find?_some found⟩
  | none => False.elim (by
      obtain ⟨x, mem, accepted⟩ := existsVertex
      exact (List.find?_eq_none.mp found x mem) accepted)

def chase (edge : Nat → Nat → Bool) (vertices : List Nat)
    (incoming : ∀ x ∈ vertices, ∃ y ∈ vertices, edge y x = true)
    (remaining path : List Nat)
    (nonempty : path ≠ []) (unique : path.Nodup) (inside : path ⊆ vertices)
    (walk : Walk edge path)
    (cover : ∀ x ∈ vertices, x ∈ remaining ∨ x ∈ path) :
    { cycle // CycleValid edge vertices cycle } := by
  let current := path.head nonempty
  have currentInside : current ∈ vertices := inside (List.head_mem nonempty)
  let predecessor := chooseVertex vertices (fun y => edge y current) (incoming current currentInside)
  let previous := predecessor.val
  have prevInside : previous ∈ vertices := predecessor.property.1
  have prevEdge : edge previous current = true := predecessor.property.2
  if repeated : previous ∈ path then
    let cycle := prefixThrough previous path
    refine ⟨cycle, (prefixThrough_sublist previous path).nodup unique,
      prefixThrough_nonempty repeated, ?_, ?_⟩
    · exact fun _ mem => inside ((prefixThrough_sublist previous path).subset mem)
    · have heads : cycle.headD 0 = current := by
        rw [prefixThrough_head repeated]
        cases path <;> simp_all [current]
      rw [heads]
      exact close_prefix edge previous current path repeated walk prevEdge
  else
    have prevRemaining : previous ∈ remaining := (cover previous prevInside).resolve_right repeated
    refine chase edge vertices incoming (remaining.erase previous) (previous :: path)
      (by simp) (List.nodup_cons.mpr ⟨repeated, unique⟩) ?_ ?_ ?_
    · intro x mem
      rcases List.mem_cons.mp mem with same | old
      · subst x; exact prevInside
      · exact inside old
    · cases path with
      | nil => contradiction
      | cons x xs => exact ⟨prevEdge, walk⟩
    · intro x mem
      by_cases same : x = previous
      · exact Or.inr (by simp [same])
      · rcases cover x mem with rem | seen
        · exact Or.inl ((List.mem_erase_of_ne same).mpr rem)
        · exact Or.inr (List.mem_cons_of_mem _ seen)
termination_by remaining.length
decreasing_by
  have len := List.length_erase_of_mem prevRemaining
  have pos := List.length_pos_of_mem prevRemaining
  dsimp [previous, predecessor, current] at len
  omega

/-- A finite graph always has an ordering or a simple directed cycle. Source
removal and the predecessor chase both decrease an explicit list length. -/
def solve (edge : Nat → Nat → Bool) : (vertices : List Nat) → vertices.Nodup →
    { order // OrderValid edge vertices order } ⊕ { cycle // CycleValid edge vertices cycle }
  | [], _ => Sum.inl ⟨[], List.Perm.refl [], by simp⟩
  | first :: rest, unique => by
      let vertices := first :: rest
      let isSource := fun x => !(vertices.any (fun y => edge y x))
      match found : vertices.find? isSource with
      | some source =>
          have member : source ∈ vertices := List.mem_of_find?_eq_some found
          have sourceCheck : isSource source = true := List.find?_some found
          have noIncoming : ∀ y ∈ vertices, edge y source = false := by
            simpa [isSource, List.any_eq_false] using sourceCheck
          match solve edge (vertices.erase source) (unique.erase source) with
          | Sum.inl order =>
              exact Sum.inl ⟨source :: order.val,
                source_prepend edge vertices order.val source order.property.1 unique member
                  noIncoming order.property.2⟩
          | Sum.inr cycle =>
              exact Sum.inr ⟨cycle.val, cycle.property.1, cycle.property.2.1,
                (fun _ mem => List.mem_of_mem_erase (cycle.property.2.2.1 mem)),
                cycle.property.2.2.2⟩
      | none =>
          have incoming : ∀ x ∈ vertices, ∃ y ∈ vertices, edge y x = true := by
            intro x member
            have absent := List.find?_eq_none.mp found x member
            simpa [isSource, List.any_eq_true] using absent
          exact Sum.inr (chase edge vertices incoming (vertices.erase first) [first]
            (by simp) (by simp) (by simp [vertices]) trivial (by
              intro x member
              by_cases same : x = first
              · exact Or.inr (by simp [same])
              · exact Or.inl ((List.mem_erase_of_ne same).mpr member)))
termination_by vertices => vertices.length
decreasing_by
  simp_wf
  have len := List.length_erase_of_mem member
  have pos := List.length_pos_of_mem member
  dsimp [vertices] at len pos
  omega

/-- The constructive solver's returned data always carry the promised graph
property; there is no failure case or precondition on the edge relation. -/
theorem total_solve_correct (edge : Nat → Nat → Bool) (vertices : List Nat)
    (unique : vertices.Nodup) :
    match solve edge vertices unique with
    | .inl order => OrderValid edge vertices order.val
    | .inr cycle => CycleValid edge vertices cycle.val := by
  cases solve edge vertices unique with
  | inl order => exact order.property
  | inr cycle => exact cycle.property

theorem finite_graph_order_or_cycle (edge : Nat → Nat → Bool) (vertices : List Nat)
    (unique : vertices.Nodup) :
    (∃ order, OrderValid edge vertices order) ∨ ∃ cycle, CycleValid edge vertices cycle := by
  cases solve edge vertices unique with
  | inl order => exact Or.inl ⟨order.val, order.property⟩
  | inr cycle => exact Or.inr ⟨cycle.val, cycle.property⟩

end LeanTopologicalSort.Total
