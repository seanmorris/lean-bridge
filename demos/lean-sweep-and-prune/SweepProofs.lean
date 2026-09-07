import SweepSpec

namespace LeanSweep

theorem pairOf_comm (left right : Entry) : pairOf left right = pairOf right left := by
  simp [pairOf, Nat.min_comm, Nat.max_comm]

theorem pairOf_eq_iff (a b c d : Entry) :
    pairOf a b = pairOf c d ↔
      (a.id = c.id ∧ b.id = d.id) ∨ (a.id = d.id ∧ b.id = c.id) := by
  simp only [pairOf, Prod.mk.injEq]
  omega

theorem pairOf_injective_right (current left right : Entry)
    (same : pairOf current left = pairOf current right) : left.id = right.id := by
  rcases (pairOf_eq_iff _ _ _ _).mp same with equal | equal <;> omega

theorem pairOf_strict (left right : Entry) (different : left.id ≠ right.id) :
    (pairOf left right).1 < (pairOf left right).2 := by
  simp only [pairOf]
  omega

theorem overlapAxis_comm (axis : Nat) (left right : Entry) :
    overlapAxis axis left right ↔ overlapAxis axis right left := by
  exact and_comm

theorem overlap_comm (dimensions : Nat) (left right : Entry) :
    Overlap dimensions left right ↔ Overlap dimensions right left := by
  constructor <;> intro overlap axis bound
  · exact (overlapAxis_comm _ _ _).mp (overlap axis bound)
  · exact (overlapAxis_comm _ _ _).mp (overlap axis bound)

theorem validBox_axis (dimensions axis : Nat) (box : Box) (id : Nat)
    (valid : ValidBox dimensions box) (bound : axis < dimensions) :
    lowerAt axis ⟨id, box⟩ ≤ upperAt axis ⟨id, box⟩ :=
  valid.2.2 axis bound

theorem mem_keepActive (axis : Nat) (current old : Entry) (active : List Entry) :
    old ∈ keepActive axis current active ↔
      old ∈ active ∧ lowerAt axis current ≤ upperAt axis old := by
  simp [keepActive]

theorem keepActive_subset (axis : Nat) (current : Entry) (active : List Entry) :
    ∀ old ∈ keepActive axis current active, old ∈ active := by
  intro old member
  exact ((mem_keepActive _ _ _ _).mp member).1

/-- Expiration is strict: an interval ending exactly at this start remains
active, including zero-width intervals at that coordinate. -/
theorem keepActive_exact_overlap (axis : Nat) (current : Entry) (active : List Entry)
    (valid : lowerAt axis current ≤ upperAt axis current)
    (before : ∀ old ∈ active, lowerAt axis old ≤ lowerAt axis current) :
    ∀ old, old ∈ keepActive axis current active ↔
      old ∈ active ∧ overlapAxis axis current old := by
  intro old
  rw [mem_keepActive]
  constructor
  · rintro ⟨member, lower⟩
    exact ⟨member, lower, Int.le_trans (before old member) valid⟩
  · rintro ⟨member, lower, _⟩
    exact ⟨member, lower⟩

/-- Once an interval expires, sorted starts prevent it from overlapping any
future interval. The proof does not assume positive widths or distinct starts. -/
theorem expired_never_returns (axis : Nat) (current future old : Entry)
    (sorted : lowerAt axis current ≤ lowerAt axis future)
    (expired : upperAt axis old < lowerAt axis current) :
    ¬overlapAxis axis future old := by
  intro overlap
  unfold overlapAxis at overlap
  omega

theorem activeInvariant_empty (axis : Nat) (current : Entry) :
    ActiveInvariant axis current [] [] := by
  simp [ActiveInvariant]

/-- Advancing a nondecreasing sweep coordinate preserves the exact active
set, then inserting the current interval adds precisely the new live entry. -/
theorem activeInvariant_step (axis : Nat) (previous current : Entry)
    (processed active : List Entry)
    (invariant : ActiveInvariant axis previous processed active)
    (monotone : lowerAt axis previous ≤ lowerAt axis current)
    (valid : lowerAt axis current ≤ upperAt axis current) :
    ActiveInvariant axis current (current :: processed)
      (current :: keepActive axis current active) := by
  intro entry
  rw [List.mem_cons, mem_keepActive, invariant entry, List.mem_cons]
  constructor
  · rintro (rfl | ⟨⟨member, _⟩, live⟩)
    · exact ⟨Or.inl rfl, valid⟩
    · exact ⟨Or.inr member, live⟩
  · rintro ⟨rfl | member, live⟩
    · exact Or.inl rfl
    · exact Or.inr ⟨⟨member, Int.le_trans monotone live⟩, live⟩

theorem uniqueIds_parts (active rest : List Entry) (current : Entry)
    (unique : UniqueIds (active ++ current :: rest)) :
    UniqueIds active ∧ UniqueIds rest ∧
      (∀ old ∈ active, current.id ≠ old.id) ∧
      (∀ next ∈ rest, current.id ≠ next.id) ∧
      (∀ old ∈ active, ∀ next ∈ rest, old.id ≠ next.id) := by
  simp only [UniqueIds, List.map_append, List.map_cons, List.nodup_append,
    List.nodup_cons, List.mem_map, List.mem_cons] at unique
  rcases unique with ⟨activeUnique, ⟨currentFresh, restUnique⟩, disjoint⟩
  refine ⟨activeUnique, restUnique, ?_, ?_, ?_⟩
  · intro old member same
    exact disjoint old.id ⟨old, member, rfl⟩ current.id (Or.inl rfl) same.symm
  · intro next member same
    exact currentFresh ⟨next, member, same.symm⟩
  · intro old oldMember next nextMember same
    exact disjoint old.id ⟨old, oldMember, rfl⟩ next.id
      (Or.inr ⟨next, nextMember, rfl⟩) same

theorem uniqueIds_keepActive (axis : Nat) (active : List Entry) (current : Entry)
    (unique : UniqueIds active) : UniqueIds (keepActive axis current active) := by
  unfold UniqueIds at *
  change (active.map Entry.id).Pairwise (· ≠ ·) at unique
  change ((keepActive axis current active).map Entry.id).Pairwise (· ≠ ·)
  rw [List.pairwise_map] at *
  exact unique.filter _

theorem uniqueIds_next (axis : Nat) (active rest : List Entry) (current : Entry)
    (unique : UniqueIds (active ++ current :: rest)) :
    UniqueIds ((current :: keepActive axis current active) ++ rest) := by
  obtain ⟨activeUnique, restUnique, currentActive, currentRest, disjoint⟩ :=
    uniqueIds_parts active rest current unique
  have liveUnique := uniqueIds_keepActive axis active current activeUnique
  simp only [UniqueIds, List.map_append, List.map_cons, List.nodup_append,
    List.nodup_cons, List.mem_map, List.mem_cons]
  refine ⟨⟨?_, liveUnique⟩, restUnique, ?_⟩
  · rintro ⟨old, member, same⟩
    exact currentActive old (keepActive_subset _ _ _ old member) same.symm
  · intro id member other otherMember same
    rcases member with rfl | ⟨old, member, rfl⟩
    · rcases otherMember with ⟨next, nextMember, rfl⟩
      exact currentRest next nextMember same
    · rcases otherMember with ⟨next, nextMember, rfl⟩
      exact disjoint old (keepActive_subset _ _ _ old member) next nextMember same

theorem before_next (axis : Nat) (active rest : List Entry) (current : Entry)
    (sorted : StartSorted axis (current :: rest))
    (before : Before axis active (current :: rest)) :
    Before axis (current :: keepActive axis current active) rest := by
  have head := (List.pairwise_cons.mp sorted).1
  intro old oldMember next nextMember
  rcases List.mem_cons.mp oldMember with rfl | member
  · exact head next nextMember
  · exact before old (keepActive_subset _ _ _ old member) next (List.mem_cons_of_mem _ nextMember)

theorem pending_step (axis : Nat) (active rest : List Entry) (current : Entry)
    (valid : lowerAt axis current ≤ upperAt axis current)
    (sorted : StartSorted axis (current :: rest))
    (before : Before axis active (current :: rest))
    (unique : UniqueIds (active ++ current :: rest)) (pair : Pair) :
    PendingPair axis active (current :: rest) pair ↔
      pair ∈ (keepActive axis current active).map (pairOf current) ∨
        PendingPair axis (current :: keepActive axis current active) rest pair := by
  have head := (List.pairwise_cons.mp sorted).1
  have activeDifferent := (uniqueIds_parts active rest current unique).2.2.1
  constructor
  · rintro ⟨next, nextMember, old, oldMember, different, same, overlap⟩
    rcases List.mem_cons.mp nextMember with rfl | nextMember
    · rcases List.mem_append.mp oldMember with oldMember | oldMember
      · left
        exact List.mem_map.mpr ⟨old, (mem_keepActive _ _ _ _).mpr ⟨oldMember, overlap.1⟩, same.symm⟩
      · rcases List.mem_cons.mp oldMember with rfl | oldMember
        · exact (different rfl).elim
        · right
          refine ⟨old, oldMember, next, ?_, Ne.symm different, ?_, ?_⟩
          · simp
          · rw [same, pairOf_comm]
          · exact (overlapAxis_comm _ _ _).mp overlap
    · right
      refine ⟨next, nextMember, old, ?_, different, same, overlap⟩
      rcases List.mem_append.mp oldMember with oldMember | oldMember
      · have survives : lowerAt axis current ≤ upperAt axis old :=
          Int.le_trans (head next nextMember) overlap.1
        exact List.mem_append_left _ (List.mem_cons_of_mem _
          ((mem_keepActive _ _ _ _).mpr ⟨oldMember, survives⟩))
      · rcases List.mem_cons.mp oldMember with rfl | oldMember
        · simp
        · exact List.mem_append_right _ oldMember
  · intro emitted
    rcases emitted with emitted | ⟨next, nextMember, old, oldMember, different, same, overlap⟩
    · rcases List.mem_map.mp emitted with ⟨old, oldMember, same⟩
      have live := (mem_keepActive _ _ _ _).mp oldMember
      refine ⟨current, by simp, old, List.mem_append_left _ live.1,
        activeDifferent old live.1, same.symm, live.2, ?_⟩
      exact Int.le_trans (before old live.1 current (by simp)) valid
    · refine ⟨next, List.mem_cons_of_mem _ nextMember, old, ?_, different, same, overlap⟩
      rcases List.mem_append.mp oldMember with oldMember | oldMember
      · rcases List.mem_cons.mp oldMember with rfl | oldMember
        · simp
        · exact List.mem_append_left _ (keepActive_subset _ _ _ old oldMember)
      · exact List.mem_append_right _ (List.mem_cons_of_mem _ oldMember)

/-- Every emitted candidate is exactly an overlap on the chosen axis, and
every such pair is emitted. Expired active entries are proved irrelevant. -/
theorem sweepPairs_exact (axis : Nat) (remaining active : List Entry)
    (valid : AxisValid axis remaining)
    (sorted : StartSorted axis remaining)
    (before : Before axis active remaining)
    (unique : UniqueIds (active ++ remaining)) (pair : Pair) :
    pair ∈ sweepPairs axis remaining active ↔ PendingPair axis active remaining pair := by
  induction remaining generalizing active with
  | nil => simp [sweepPairs, PendingPair]
  | cons current rest ih =>
      have restValid : AxisValid axis rest := fun entry member => valid entry (by simp [member])
      have restSorted := (List.pairwise_cons.mp sorted).2
      rw [sweepPairs, List.mem_append,
        ih (current :: keepActive axis current active) restValid restSorted
          (before_next _ _ _ _ sorted before) (uniqueIds_next _ _ _ _ unique)]
      exact (pending_step axis active rest current (valid current (by simp)) sorted before unique pair).symm

theorem pairOf_map_nodup (current : Entry) (active : List Entry)
    (unique : UniqueIds active) : (active.map (pairOf current)).Nodup := by
  change (active.map Entry.id).Pairwise (· ≠ ·) at unique
  change (active.map (pairOf current)).Pairwise (· ≠ ·)
  rw [List.pairwise_map] at *
  exact unique.imp (fun different same => different (pairOf_injective_right _ _ _ same))

/-- Each canonical pair occurs once. Equal start coordinates do not create
duplicate candidates because input IDs are unique. -/
theorem sweepPairs_nodup (axis : Nat) (remaining active : List Entry)
    (valid : AxisValid axis remaining)
    (sorted : StartSorted axis remaining)
    (before : Before axis active remaining)
    (unique : UniqueIds (active ++ remaining)) :
    (sweepPairs axis remaining active).Nodup := by
  induction remaining generalizing active with
  | nil => simp [sweepPairs]
  | cons current rest ih =>
      have restValid : AxisValid axis rest := fun entry member => valid entry (by simp [member])
      have restSorted := (List.pairwise_cons.mp sorted).2
      have restBefore := before_next _ _ _ _ sorted before
      have restUnique := uniqueIds_next axis active rest current unique
      have parts := uniqueIds_parts active rest current unique
      rw [sweepPairs, List.nodup_append]
      refine ⟨pairOf_map_nodup current _ (uniqueIds_keepActive _ _ _ parts.1),
        ih _ restValid restSorted restBefore restUnique, ?_⟩
      intro left leftMember right rightMember same
      obtain ⟨old, oldMember, oldPair⟩ := List.mem_map.mp leftMember
      obtain ⟨next, nextMember, other, _, _, otherPair, _⟩ :=
        (sweepPairs_exact axis rest _ restValid restSorted restBefore restUnique right).mp rightMember
      have equalPairs : pairOf current old = pairOf next other :=
        oldPair.trans (same.trans otherPair)
      rcases (pairOf_eq_iff _ _ _ _).mp equalPairs with equal | equal
      · exact parts.2.2.2.1 next nextMember equal.1
      · exact parts.2.2.2.2 old (keepActive_subset _ _ _ old oldMember) next nextMember equal.2

theorem pending_empty_iff (axis : Nat) (entries : List Entry) (pair : Pair) :
    PendingPair axis [] entries pair ↔ AxisPair axis entries pair := by
  constructor
  · rintro ⟨left, leftMember, right, rightMember, different, same, overlap⟩
    simp only [List.nil_append] at rightMember
    by_cases order : left.id < right.id
    · refine ⟨left, leftMember, right, rightMember, order, ?_, overlap⟩
      simpa [pairOf, Nat.min_eq_left (Nat.le_of_lt order), Nat.max_eq_right (Nat.le_of_lt order)] using same
    · have reverse : right.id < left.id := by omega
      refine ⟨right, rightMember, left, leftMember, reverse, ?_, (overlapAxis_comm _ _ _).mp overlap⟩
      simpa [pairOf, Nat.min_eq_right (Nat.le_of_lt reverse), Nat.max_eq_left (Nat.le_of_lt reverse)] using same
  · rintro ⟨left, leftMember, right, rightMember, order, same, overlap⟩
    refine ⟨left, leftMember, right, by simpa using rightMember, by omega, ?_, overlap⟩
    simpa [pairOf, Nat.min_eq_left (Nat.le_of_lt order), Nat.max_eq_right (Nat.le_of_lt order)] using same

theorem sweepPairs_axis_exact (axis : Nat) (entries : List Entry)
    (valid : AxisValid axis entries) (sorted : StartSorted axis entries)
    (unique : UniqueIds entries) (pair : Pair) :
    pair ∈ sweepPairs axis entries [] ↔ AxisPair axis entries pair := by
  rw [sweepPairs_exact axis entries [] valid sorted (by simp [Before]) (by simpa using unique)]
  exact pending_empty_iff axis entries pair

theorem sweepPairs_axis_nodup (axis : Nat) (entries : List Entry)
    (valid : AxisValid axis entries) (sorted : StartSorted axis entries)
    (unique : UniqueIds entries) : (sweepPairs axis entries []).Nodup :=
  sweepPairs_nodup axis entries [] valid sorted (by simp [Before]) (by simpa using unique)

theorem axisPair_perm (axis : Nat) (left right : List Entry)
    (permutation : left.Perm right) (pair : Pair) :
    AxisPair axis left pair ↔ AxisPair axis right pair := by
  simp only [AxisPair, permutation.mem_iff]

theorem boxPair_perm (dimensions : Nat) (left right : List Entry)
    (permutation : left.Perm right) (pair : Pair) :
    BoxPair dimensions left pair ↔ BoxPair dimensions right pair := by
  simp only [BoxPair, permutation.mem_iff]

/-- Any extra predicate filters the exact axis candidates without adding or
duplicating a pair. The runtime instantiates this with the remaining axes. -/
theorem filtered_sweep_exact (axis : Nat) (entries : List Entry) (test : Pair → Bool)
    (valid : AxisValid axis entries) (sorted : StartSorted axis entries)
    (unique : UniqueIds entries) (pair : Pair) :
    pair ∈ (sweepPairs axis entries []).filter test ↔
      AxisPair axis entries pair ∧ test pair = true := by
  rw [List.mem_filter, sweepPairs_axis_exact axis entries valid sorted unique]

theorem filtered_sweep_nodup (axis : Nat) (entries : List Entry) (test : Pair → Bool)
    (valid : AxisValid axis entries) (sorted : StartSorted axis entries)
    (unique : UniqueIds entries) :
    ((sweepPairs axis entries []).filter test).Nodup :=
  (sweepPairs_axis_nodup axis entries valid sorted unique).filter test

/-- Filtering all axes returns exactly the intersecting closed AABB pairs.
This statement is generic in dimension count and integer coordinates. -/
theorem filtered_sweep_box_exact (dimensions axis : Nat) (entries : List Entry)
    (test : Pair → Bool) (axisBound : axis < dimensions)
    (valid : AxisValid axis entries) (sorted : StartSorted axis entries)
    (unique : UniqueIds entries)
    (testCorrect : ∀ left ∈ entries, ∀ right ∈ entries, left.id < right.id →
      (test (left.id, right.id) = true ↔ Overlap dimensions left right)) (pair : Pair) :
    pair ∈ (sweepPairs axis entries []).filter test ↔ BoxPair dimensions entries pair := by
  rw [filtered_sweep_exact axis entries test valid sorted unique]
  constructor
  · rintro ⟨⟨left, leftMember, right, rightMember, order, same, _⟩, checked⟩
    refine ⟨left, leftMember, right, rightMember, order, same, ?_⟩
    exact (testCorrect left leftMember right rightMember order).mp (by simpa [same] using checked)
  · rintro ⟨left, leftMember, right, rightMember, order, same, overlap⟩
    refine ⟨⟨left, leftMember, right, rightMember, order, same, overlap axis axisBound⟩, ?_⟩
    simpa [same] using (testCorrect left leftMember right rightMember order).mpr overlap

theorem sweepPairs_length_le (axis : Nat) (remaining active : List Entry) :
    (sweepPairs axis remaining active).length ≤
      remaining.length * (remaining.length + active.length) := by
  induction remaining generalizing active with
  | nil => simp [sweepPairs]
  | cons current rest ih =>
      have activeBound : (keepActive axis current active).length ≤ active.length :=
        List.length_filter_le _ _
      have recursive := ih (current :: keepActive axis current active)
      simp only [sweepPairs, List.length_append, List.length_map, List.length_cons] at *
      have productBound : rest.length * (rest.length + ((keepActive axis current active).length + 1)) ≤
          rest.length * (rest.length + (1 + active.length)) :=
        Nat.mul_le_mul_left rest.length (by omega)
      calc
        _ ≤ active.length + rest.length * (rest.length + (1 + active.length)) := by omega
        _ ≤ (rest.length + 1) * (rest.length + 1 + active.length) := by
          simp only [Nat.add_mul, Nat.mul_add, Nat.one_mul, Nat.mul_one]
          omega

/-- Each new interval can pair only with an earlier interval. This tight
bound includes arbitrary active prefixes and needs no geometry assumptions. -/
theorem sweepPairs_length_triangle (axis : Nat) (remaining active : List Entry) :
    2 * (sweepPairs axis remaining active).length ≤
      remaining.length * (remaining.length - 1) + 2 * remaining.length * active.length := by
  induction remaining generalizing active with
  | nil => simp [sweepPairs]
  | cons current rest ih =>
      have activeBound : (keepActive axis current active).length ≤ active.length :=
        List.length_filter_le _ _
      have recursive := ih (current :: keepActive axis current active)
      have productBound := Nat.mul_le_mul_left (2 * rest.length) activeBound
      have triangle : rest.length * (rest.length - 1) + rest.length = rest.length * rest.length := by
        cases rest.length with
        | zero => simp
        | succ count => simp [Nat.mul_succ]
      simp only [sweepPairs, List.length_append, List.length_map, List.length_cons,
        Nat.add_sub_cancel, Nat.mul_add, Nat.add_mul, Nat.mul_one, Nat.one_mul] at recursive ⊢
      omega

theorem sweepPairs_length_choose (axis : Nat) (entries : List Entry) :
    (sweepPairs axis entries []).length ≤ entries.length * (entries.length - 1) / 2 := by
  have bound := sweepPairs_length_triangle axis entries []
  simp only [List.length_nil, Nat.mul_zero, Nat.add_zero] at bound
  omega

end LeanSweep
