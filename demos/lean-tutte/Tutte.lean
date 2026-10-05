import TutteCore

namespace LeanTutte

theorem tilingCheck_sound (width height : Nat) (squares : List Square)
    (accepted : tilingCheck width height squares = true) : Tiling width height squares := by
  exact of_decide_eq_true accepted

theorem coverage_exact (width height : Nat) (squares : List Square)
    (accepted : tilingCheck width height squares = true) (x y : Nat)
    (hx : x < width) (hy : y < height) : coverage squares x y = 1 := by
  exact (tilingCheck_sound width height squares accepted).2.2.2.2 x
    (List.mem_range.mpr hx) y (List.mem_range.mpr hy)

theorem electricalCheck_sound (width height : Nat) (levels : List Nat) (squares : List Square)
    (accepted : electricalCheck width height levels squares = true) :
    Electrical width height levels squares := by
  exact of_decide_eq_true accepted

theorem current_eq_side (width height : Nat) (levels : List Nat) (squares : List Square)
    (accepted : electricalCheck width height levels squares = true)
    (s : Square) (present : s ∈ squares) :
    levels[s.top]?.getD 0 - levels[s.bottom]?.getD 0 = s.side := by
  have h := (electricalCheck_sound width height levels squares accepted).2.2.2.1 s present
  omega

theorem junction_balanced (width height : Nat) (levels : List Nat) (squares : List Square)
    (accepted : electricalCheck width height levels squares = true) (node : Nat)
    (bound : node < levels.length) (notSource : node ≠ 0) (notSink : node ≠ levels.length - 1) :
    incoming squares node = outgoing squares node := by
  exact (electricalCheck_sound width height levels squares accepted).2.2.2.2.2.2.2.2
    node (List.mem_range.mpr bound) notSource notSink

theorem voltageSum_eq (potential : Nat → Int) (start : Nat) (walk : List Nat) :
    voltageSum potential start walk = potential start - potential (endpoint start walk) := by
  induction walk generalizing start with
  | nil => simp [voltageSum, endpoint]
  | cons next rest ih =>
    simp only [voltageSum, endpoint, ih]
    omega

theorem closed_walk_zero (potential : Nat → Int) (start : Nat) (walk : List Nat)
    (closed : endpoint start walk = start) : voltageSum potential start walk = 0 := by
  rw [voltageSum_eq, closed]
  omega

theorem sublist_mem_subsets (part squares : List Square) (sub : part.Sublist squares) :
    part ∈ subsets squares := by
  induction sub with
  | slnil => simp [subsets]
  | cons s sub ih => exact List.mem_append_left _ ih
  | cons_cons s sub ih =>
    apply List.mem_append_right
    exact List.mem_map.mpr ⟨_, ih, rfl⟩

theorem simpleCheck_sound (squares : List Square) (accepted : simpleCheck squares = true)
    (part : List Square) (subset : part ∈ subsets squares)
    (moreThanOne : 1 < part.length) (proper : part.length < squares.length) :
    fillsBox part = false := by
  have empty : compoundParts squares = [] := List.isEmpty_iff.mp accepted
  by_cases full : fillsBox part = true
  · have present : part ∈ compoundParts squares := by
      simp [compoundParts, subset, moreThanOne, proper, full]
    rw [empty] at present
    simp at present
  · exact Bool.eq_false_iff.mpr full

theorem no_rectangular_sublist (squares part : List Square)
    (accepted : simpleCheck squares = true) (sub : part.Sublist squares)
    (moreThanOne : 1 < part.length) (proper : part.length < squares.length) :
    fillsBox part = false :=
  simpleCheck_sound squares accepted part (sublist_mem_subsets part squares sub) moreThanOne proper

theorem perfectCheck_sound (squares : List Square) (accepted : perfectCheck squares = true) :
    (squares.map Square.side).Pairwise (· ≠ ·) := by
  exact (of_decide_eq_true accepted).2

theorem flood_sound (count : Nat) (squares : List Square) (a b start fuel : Nat)
    (hs : start < count) (ha : start ≠ a) (hb : start ≠ b)
    (v : Nat) (present : v ∈ flood count squares a b start fuel) :
    Path count squares a b start v := by
  induction fuel generalizing v with
  | zero =>
    simp only [flood, List.mem_singleton] at present
    subst v
    exact Path.refl hs ha hb
  | succ fuel ih =>
    simp only [flood, List.mem_filter, Bool.or_eq_true] at present
    have bounds : v < count ∧ v ≠ a ∧ v ≠ b := by simpa [survivors] using present.1
    rcases present.2 with old | fresh
    · exact ih v (by simpa using old)
    · obtain ⟨u, hu, edge⟩ := List.any_eq_true.mp fresh
      exact Path.step (ih u hu) edge bounds.1 bounds.2.1 bounds.2.2

theorem connectedCheck_sound (count : Nat) (squares : List Square) (a b : Nat)
    (accepted : connectedCheck count squares a b = true) : ConnectedAfter count squares a b := by
  unfold connectedCheck at accepted
  split at accepted
  · contradiction
  · rename_i start rest equation
    have member : start ∈ survivors count a b := by rw [equation]; simp
    have bounds : start < count ∧ start ≠ a ∧ start ≠ b := by simpa [survivors] using member
    refine ⟨start, bounds.1, bounds.2.1, bounds.2.2, ?_⟩
    intro v hv hva hvb
    have present : v ∈ start :: rest := by
      rw [← equation]
      simp [survivors, hv, hva, hvb]
    have reached := List.all_eq_true.mp accepted v present
    exact flood_sound count squares a b start count bounds.1 bounds.2.1 bounds.2.2 v
      (by simpa using reached)

/-- The sentinel `count` represents no deletion; equal indices delete one vertex. -/
theorem threeConnectedCheck_sound (count : Nat) (squares : List Square)
    (accepted : threeConnectedCheck count squares = true) :
    4 ≤ count ∧ ∀ a b, a ≤ count → b ≤ count → ConnectedAfter count squares a b := by
  simp only [threeConnectedCheck, Bool.and_eq_true, decide_eq_true_eq] at accepted
  refine ⟨accepted.1, ?_⟩
  intro a b ha hb
  exact connectedCheck_sound count squares a b
    (List.all_eq_true.mp (List.all_eq_true.mp accepted.2 a (List.mem_range.mpr (by omega)))
      b (List.mem_range.mpr (by omega)))

/-- Acceptance of the actual serialized flags establishes both named predicates. -/
theorem exported_certificate (width height : Nat) (levels words : Array Nat)
    (tiles : (checkExport width height levels words)[0]! = 1)
    (circuit : (checkExport width height levels words)[1]! = 1) :
    Tiling width height (decodeSquares words) ∧
    Electrical width height levels.toList (decodeSquares words) := by
  simp [checkExport, report, flag] at tiles circuit
  exact ⟨tilingCheck_sound _ _ _ tiles, electricalCheck_sound _ _ _ _ circuit⟩

theorem exported_simple (width height : Nat) (levels words : Array Nat)
    (accepted : (checkExport width height levels words)[2]! = 1)
    (part : List Square) (sub : part.Sublist (decodeSquares words))
    (moreThanOne : 1 < part.length) (proper : part.length < (decodeSquares words).length) :
    fillsBox part = false := by
  have checked : simpleCheck (decodeSquares words) = true := by
    simpa [checkExport, report, flag] using accepted
  exact no_rectangular_sublist _ _ checked sub moreThanOne proper

theorem exported_threeConnected (width height : Nat) (levels words : Array Nat)
    (accepted : (checkExport width height levels words)[4]! = 1) :
    4 ≤ levels.toList.length ∧ ∀ a b, a ≤ levels.toList.length → b ≤ levels.toList.length →
      ConnectedAfter levels.toList.length (decodeSquares words) a b := by
  have checked : threeConnectedCheck levels.toList.length (decodeSquares words) = true := by
    simpa [checkExport, report, flag] using accepted
  exact threeConnectedCheck_sound _ _ checked

end LeanTutte
