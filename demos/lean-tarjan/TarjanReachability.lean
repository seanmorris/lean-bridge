import Init

/-! Generic finite directed graph semantics, independent of any CSR or UI adapter. -/

namespace LeanTarjan

def Edge (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat) : Prop :=
  source < count ∧ target < count ∧ edge source target = true

def Walk (count : Nat) (edge : Nat → Nat → Bool) (current target : Nat) : List Nat → Prop
  | [] => current = target
  | next :: rest => Edge count edge current next ∧ Walk count edge next target rest

def Reachable (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat) : Prop :=
  source < count ∧ target < count ∧ ∃ path, Walk count edge source target path

def Mutual (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat) : Prop :=
  Reachable count edge source target ∧ Reachable count edge target source

def labelAt (labels : Array Nat) (vertex : Nat) : Nat := labels.getD vertex labels.size

structure PartitionSpec (count : Nat) (edge : Nat → Nat → Bool) (labels : Array Nat) : Prop where
  size : labels.size = count
  bounded : ∀ vertex, vertex < count → labelAt labels vertex < count
  rooted : ∀ vertex, vertex < count → labelAt labels (labelAt labels vertex) = labelAt labels vertex
  same_iff : ∀ source, source < count → ∀ target, target < count →
    (labelAt labels source = labelAt labels target ↔ Mutual count edge source target)

theorem walk_append (count : Nat) (edge : Nat → Nat → Bool)
    (source middle target : Nat) (first second : List Nat)
    (left : Walk count edge source middle first) (right : Walk count edge middle target second) :
    Walk count edge source target (first ++ second) := by
  induction first generalizing source with
  | nil => subst source; exact right
  | cons next rest ih => exact ⟨left.1, ih next left.2⟩

theorem reachable_refl (count : Nat) (edge : Nat → Nat → Bool) (vertex : Nat)
    (bound : vertex < count) : Reachable count edge vertex vertex :=
  ⟨bound, bound, [], rfl⟩

theorem reachable_edge (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat)
    (connected : Edge count edge source target) : Reachable count edge source target :=
  ⟨connected.1, connected.2.1, [target], connected, rfl⟩

theorem reachable_trans (count : Nat) (edge : Nat → Nat → Bool) (source middle target : Nat)
    (left : Reachable count edge source middle) (right : Reachable count edge middle target) :
    Reachable count edge source target := by
  obtain ⟨first, firstWalk⟩ := left.2.2
  obtain ⟨second, secondWalk⟩ := right.2.2
  exact ⟨left.1, right.2.1, first ++ second,
    walk_append count edge source middle target first second firstWalk secondWalk⟩

theorem mutual_refl (count : Nat) (edge : Nat → Nat → Bool) (vertex : Nat)
    (bound : vertex < count) : Mutual count edge vertex vertex :=
  ⟨reachable_refl count edge vertex bound, reachable_refl count edge vertex bound⟩

theorem mutual_symm {count : Nat} {edge : Nat → Nat → Bool} {source target : Nat}
    (both : Mutual count edge source target) : Mutual count edge target source := ⟨both.2, both.1⟩

theorem mutual_trans {count : Nat} {edge : Nat → Nat → Bool} {source middle target : Nat}
    (left : Mutual count edge source middle) (right : Mutual count edge middle target) :
    Mutual count edge source target :=
  ⟨reachable_trans count edge source middle target left.1 right.1,
    reachable_trans count edge target middle source right.2 left.2⟩

/-- Paths whose concatenation points belong to the allowed intermediate vertices. -/
inductive Via (count : Nat) (edge : Nat → Nat → Bool) (allowed : List Nat) : Nat → Nat → Prop
  | refl {vertex : Nat} : vertex < count → Via count edge allowed vertex vertex
  | edge {source target : Nat} : Edge count edge source target → Via count edge allowed source target
  | trans {source middle target : Nat} : Via count edge allowed source middle → middle ∈ allowed →
      Via count edge allowed middle target → Via count edge allowed source target

theorem via_mono {count : Nat} {edge : Nat → Nat → Bool} {allowed larger : List Nat}
    {source target : Nat} (subset : allowed ⊆ larger) (path : Via count edge allowed source target) :
    Via count edge larger source target := by
  induction path with
  | refl bound => exact .refl bound
  | edge connected => exact .edge connected
  | trans _ member _ left right => exact .trans left (subset member) right

theorem via_cons (count : Nat) (edge : Nat → Nat → Bool) (pivot : Nat) (allowed : List Nat)
    (source target : Nat) :
    Via count edge (pivot :: allowed) source target ↔
      Via count edge allowed source target ∨
        (Via count edge allowed source pivot ∧ Via count edge allowed pivot target) := by
  constructor
  · intro path
    induction path with
    | refl bound => exact Or.inl (.refl bound)
    | edge connected => exact Or.inl (.edge connected)
    | @trans source middle target _ member _ left right =>
        rcases List.mem_cons.mp member with same | old
        · subst middle
          have before : Via count edge allowed source pivot := by
            rcases left with direct | through
            · exact direct
            · exact through.1
          have after : Via count edge allowed pivot target := by
            rcases right with direct | through
            · exact direct
            · exact through.2
          exact Or.inr ⟨before, after⟩
        · rcases left with directLeft | throughLeft
          · rcases right with directRight | throughRight
            · exact Or.inl (.trans directLeft old directRight)
            · exact Or.inr ⟨.trans directLeft old throughRight.1, throughRight.2⟩
          · rcases right with directRight | throughRight
            · exact Or.inr ⟨throughLeft.1, .trans throughLeft.2 old directRight⟩
            · exact Or.inr ⟨throughLeft.1, throughRight.2⟩
  · intro path
    have lift : ∀ {u v}, Via count edge allowed u v → Via count edge (pivot :: allowed) u v :=
      via_mono (show allowed ⊆ pivot :: allowed from fun _ mem => List.mem_cons_of_mem _ mem)
    rcases path with direct | through
    · exact lift direct
    · exact .trans (lift through.1) (by simp) (lift through.2)

theorem via_nil (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat) :
    Via count edge [] source target ↔
      (source = target ∧ source < count) ∨ Edge count edge source target := by
  constructor
  · intro path
    cases path with
    | refl bound => exact Or.inl ⟨rfl, bound⟩
    | edge connected => exact Or.inr connected
    | trans _ member _ => simp at member
  · rintro (⟨same, bound⟩ | connected)
    · subst target; exact .refl bound
    · exact .edge connected

theorem via_reachable {count : Nat} {edge : Nat → Nat → Bool} {allowed : List Nat}
    {source target : Nat} (path : Via count edge allowed source target) :
    Reachable count edge source target := by
  induction path with
  | refl bound => exact reachable_refl count edge _ bound
  | edge connected => exact reachable_edge count edge _ _ connected
  | trans _ _ _ left right => exact reachable_trans count edge _ _ _ left right

theorem reachable_via_range (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat)
    (path : Reachable count edge source target) : Via count edge (List.range count) source target := by
  obtain ⟨sourceBound, _, vertices, walk⟩ := path
  induction vertices generalizing source with
  | nil => subst target; exact .refl sourceBound
  | cons next rest ih =>
      exact .trans (.edge walk.1) (List.mem_range.mpr walk.1.2.1) (ih next walk.1.2.1 walk.2)

theorem via_range_iff (count : Nat) (edge : Nat → Nat → Bool) (source target : Nat) :
    Via count edge (List.range count) source target ↔ Reachable count edge source target :=
  ⟨via_reachable, reachable_via_range count edge source target⟩

end LeanTarjan
