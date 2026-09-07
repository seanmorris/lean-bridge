import EditSpec

/-! Myers furthest-reaching diagonals with compact traces. A trace row stores
only the diagonals of its edit depth, not a rectangular edit-distance matrix.
The candidate carries a narrow-band potential certificate for optimality. -/

namespace LeanMyers

@[inline] def get (values : Array α) (index : Nat) (fallback : α) : α := values.getD index fallback

structure Prepared where
  input : Input

@[inline] def prepare (left right : Array Nat) : Prepared := ⟨⟨left, right⟩⟩

structure Start where
  row : Nat
  operation : Nat
  reachable : Bool

/-- Values in trace rows are source positions plus one; zero is unreachable.
At depth d, slot t represents source-minus-target diagonal 2*t-d. -/
@[inline] def chooseStart (input : Input) (depth slot : Nat) (previous : Array Nat) : Start :=
  let deletion := if slot = 0 then 0 else get previous (slot - 1) 0
  let insertion := get previous slot 0
  let deleteValid := deletion > 0 && deletion ≤ input.left.size &&
    2 * slot ≤ deletion + depth && deletion + depth - 2 * slot ≤ input.right.size
  let insertRow := insertion - 1
  let insertValid := insertion > 0 && insertRow ≤ input.left.size &&
    2 * slot ≤ insertRow + depth && insertRow + depth - 2 * slot ≤ input.right.size
  if deleteValid && (!insertValid || insertRow ≤ deletion) then ⟨deletion, 1, true⟩
  else if insertValid then ⟨insertRow, 2, true⟩
  else ⟨0, 0, false⟩

def snake (input : Input) : Nat → Nat → Nat → Nat
  | 0, row, _ => row
  | remaining + 1, row, column =>
      if row < input.left.size && column < input.right.size &&
          get input.left row 0 = get input.right column 0 then
        snake input remaining (row + 1) (column + 1)
      else row

structure Wave where
  row : Array Nat
  reached : Bool

private def fillWave (input : Input) (depth : Nat) (previous : Array Nat) :
    Nat → Nat → Array Nat → Wave
  | 0, _, row => ⟨row, false⟩
  | remaining + 1, slot, row =>
      let start := chooseStart input depth slot previous
      if start.reachable then
        let column := start.row + depth - 2 * slot
        let reached := snake input (min (input.left.size - start.row) (input.right.size - column))
          start.row column
        let row := row.push (reached + 1)
        if reached = input.left.size && reached + depth - 2 * slot = input.right.size then
          ⟨row, true⟩
        else fillWave input depth previous remaining (slot + 1) row
      else fillWave input depth previous remaining (slot + 1) (row.push 0)

structure Search where
  distance : Nat
  trace : Array (Array Nat)

private def searchWaves (input : Input) :
    Nat → Nat → Array Nat → Array (Array Nat) → Search
  | 0, depth, _, trace => ⟨depth, trace⟩
  | remaining + 1, depth, previous, trace =>
      let wave := fillWave input depth previous (depth + 1) 0 (Array.mkEmpty (depth + 1))
      let trace := trace.push wave.row
      if wave.reached then ⟨depth, trace⟩
      else searchWaves input remaining (depth + 1) wave.row trace

def wavefront (input : Input) : Search :=
  searchWaves input (input.left.size + input.right.size + 1) 0 #[1] #[]

private def prependKeeps : Nat → List Nat → List Nat
  | 0, operations => operations
  | remaining + 1, operations => prependKeeps remaining (0 :: operations)

def reconstruct (input : Input) (trace : Array (Array Nat)) :
    Nat → Nat → Nat → List Nat → List Nat
  | 0, row, _, operations => prependKeeps row operations
  | depth + 1, row, column, operations =>
      let slot := (row + depth + 1 - column) / 2
      let start := chooseStart input (depth + 1) slot (get trace depth #[])
      let firstColumn := start.row + depth + 1 - 2 * slot
      let operations := start.operation :: prependKeeps (row - start.row) operations
      reconstruct input trace depth
        (start.row - if start.operation = 1 then 1 else 0)
        (firstColumn - if start.operation = 2 then 1 else 0) operations

private def appendKeeps : Nat → Array Nat → Array Nat
  | 0, operations => operations
  | remaining + 1, operations => appendKeeps remaining (operations.push 0)

/-- An owned reverse-order output array avoids one list allocation per emitted
operation. The final reverse is in-place when the array has a single owner. -/
def reconstructReversed (input : Input) (trace : Array (Array Nat)) :
    Nat → Nat → Nat → Array Nat → Array Nat
  | 0, row, _, operations => appendKeeps row operations
  | depth + 1, row, column, operations =>
      let slot := (row + depth + 1 - column) / 2
      let start := chooseStart input (depth + 1) slot (get trace depth #[])
      let firstColumn := start.row + depth + 1 - 2 * slot
      let operations := (appendKeeps (row - start.row) operations).push start.operation
      reconstructReversed input trace depth
        (start.row - if start.operation = 1 then 1 else 0)
        (firstColumn - if start.operation = 2 then 1 else 0) operations

def myers (input : Input) : Solution :=
  if input.left.isEmpty then ⟨Array.replicate input.right.size 2, input.right.size⟩
  else if input.right.isEmpty then ⟨Array.replicate input.left.size 1, input.left.size⟩
  else
    let found := wavefront input
    if found.distance = 0 then ⟨Array.replicate input.left.size 0, 0⟩
    else ⟨(reconstructReversed input found.trace found.distance input.left.size input.right.size
      (Array.mkEmpty (input.left.size + input.right.size))).reverse, found.distance⟩

/-- Truncation to d makes every vertex outside the strict diagonal band have
potential d. Rows are also clipped to the target length to avoid empty padding
proportional to the longer sequence when one input is short. -/
def bandWidth (input : Input) (distance : Nat) : Nat :=
  min (2 * distance - 1) (input.right.size + 1)

def bandFirst (distance row : Nat) : Nat := row + 1 - distance

def inBand (distance row column : Nat) : Prop := row < column + distance ∧ column < row + distance

instance (distance row column : Nat) : Decidable (inBand distance row column) :=
  inferInstanceAs (Decidable (_ ∧ _))

@[inline] def bandValue (input : Input) (distance : Nat) (values : Array Nat) (row column : Nat) : Nat :=
  if inBand distance row column then
    get values (row * bandWidth input distance + (column - bandFirst distance row)) distance
  else distance

@[inline] def potentialCell (input : Input) (distance : Nat) (values : Array Nat) (row column : Nat) : Nat :=
  if row = 0 then min distance column
  else if column = 0 then min distance row
  else
    let changed := min (bandValue input distance values (row - 1) column + 1)
      (bandValue input distance values row (column - 1) + 1)
    let retained := if get input.left (row - 1) 0 = get input.right (column - 1) 0 then
        min changed (bandValue input distance values (row - 1) (column - 1))
      else changed
    min distance retained

private def potentialRow (input : Input) (distance row : Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, values => values
  | remaining + 1, column, values =>
      let value := if column ≤ input.right.size && inBand distance row column then
        potentialCell input distance values row column else distance
      potentialRow input distance row remaining (column + 1) (values.push value)

private def potentialRows (input : Input) (distance width : Nat) :
    Nat → Nat → Array Nat → Array Nat
  | 0, _, values => values
  | remaining + 1, row, values =>
      let next := potentialRow input distance row width (bandFirst distance row) values
      potentialRows input distance width remaining (row + 1) next

def buildPotential (input : Input) (distance : Nat) : Array Nat :=
  if distance = 0 then #[]
  else
    let width := bandWidth input distance
    potentialRows input distance width (input.left.size + 1) 0
      (Array.mkEmpty ((input.left.size + 1) * width))

structure Candidate where
  solution : Solution
  potential : Array Nat

def candidate (input : Input) : Candidate :=
  let solution := myers input
  ⟨solution, buildPotential input solution.distance⟩

theorem appendKeeps_reverse (count : Nat) (operations : Array Nat) :
    (appendKeeps count operations).toList.reverse = prependKeeps count operations.toList.reverse := by
  induction count generalizing operations with
  | zero => rfl
  | succ count ih =>
      simp [appendKeeps, ih, prependKeeps]

theorem reconstructReversed_eq (input : Input) (trace : Array (Array Nat))
    (depth row column : Nat) (operations : Array Nat) :
    (reconstructReversed input trace depth row column operations).toList.reverse =
      reconstruct input trace depth row column operations.toList.reverse := by
  induction depth generalizing row column operations with
  | zero => exact appendKeeps_reverse row operations
  | succ depth ih =>
      simp [reconstructReversed, ih, reconstruct, appendKeeps_reverse]

theorem reconstructed_array_eq (input : Input) (trace : Array (Array Nat)) (depth : Nat) :
    (reconstructReversed input trace depth input.left.size input.right.size
      (Array.mkEmpty (input.left.size + input.right.size))).reverse =
      (reconstruct input trace depth input.left.size input.right.size []).toArray := by
  apply Array.toList_inj.mp
  simpa using reconstructReversed_eq input trace depth input.left.size input.right.size
    (Array.mkEmpty (input.left.size + input.right.size))

theorem snake_monotone (input : Input) (fuel row column : Nat) : row ≤ snake input fuel row column := by
  induction fuel generalizing row column with
  | zero => exact Nat.le_refl row
  | succ fuel ih =>
      unfold snake
      split
      · exact Nat.le_trans (by omega) (ih (row + 1) (column + 1))
      · exact Nat.le_refl row

theorem snake_bounded (input : Input) (fuel row column : Nat) :
    snake input fuel row column ≤ row + fuel := by
  induction fuel generalizing row column with
  | zero => simp [snake]
  | succ fuel ih =>
      unfold snake
      split
      · have bound := ih (row + 1) (column + 1); omega
      · omega

theorem snake_matches (input : Input) (fuel row column : Nat) :
    ∀ offset, row + offset < snake input fuel row column →
      row + offset < input.left.size ∧ column + offset < input.right.size ∧
        get input.left (row + offset) 0 = get input.right (column + offset) 0 := by
  induction fuel generalizing row column with
  | zero => intro offset bound; simp only [snake] at bound; omega
  | succ fuel ih =>
      unfold snake
      split
      next matching =>
        simp only [Bool.and_eq_true, decide_eq_true_eq] at matching
        intro offset bound
        cases offset with
        | zero => simpa using And.intro matching.1.1 (And.intro matching.1.2 matching.2)
        | succ offset =>
            have previous := ih (row + 1) (column + 1) offset (by omega)
            simpa [Nat.add_assoc, Nat.add_comm, Nat.add_left_comm] using previous
      next unmatched => intro offset bound; omega

theorem potentialCell_bounded (input : Input) (distance : Nat) (values : Array Nat) (row column : Nat) :
    potentialCell input distance values row column ≤ distance := by
  unfold potentialCell
  split
  · exact Nat.min_le_left _ _
  · split <;> exact Nat.min_le_left _ _

theorem potentialRow_bounded (input : Input) (distance row fuel column : Nat) (values : Array Nat)
    (bounded : values.all (fun value => value ≤ distance) = true) :
    (potentialRow input distance row fuel column values).all (fun value => value ≤ distance) = true := by
  induction fuel generalizing column values with
  | zero => exact bounded
  | succ fuel ih =>
      unfold potentialRow
      apply ih
      simp only [Array.all_push, Bool.and_eq_true, decide_eq_true_eq]
      refine ⟨bounded, ?_⟩
      split
      · exact potentialCell_bounded _ _ _ _ _
      · exact Nat.le_refl _

theorem potentialRows_bounded (input : Input) (distance width fuel row : Nat) (values : Array Nat)
    (bounded : values.all (fun value => value ≤ distance) = true) :
    (potentialRows input distance width fuel row values).all (fun value => value ≤ distance) = true := by
  induction fuel generalizing row values with
  | zero => exact bounded
  | succ fuel ih =>
      unfold potentialRows
      exact ih _ _ (potentialRow_bounded _ _ _ _ _ _ bounded)

theorem buildPotential_bounded (input : Input) (distance : Nat) :
    (buildPotential input distance).all (fun value => value ≤ distance) = true := by
  unfold buildPotential
  split
  · simp
  · apply potentialRows_bounded
    simp

theorem potentialRow_size (input : Input) (distance row fuel column : Nat) (values : Array Nat) :
    (potentialRow input distance row fuel column values).size = values.size + fuel := by
  induction fuel generalizing column values with
  | zero => simp [potentialRow]
  | succ fuel ih => simp [potentialRow, ih, Nat.add_comm, Nat.add_left_comm]

theorem potentialRows_size (input : Input) (distance width fuel row : Nat) (values : Array Nat) :
    (potentialRows input distance width fuel row values).size = values.size + fuel * width := by
  induction fuel generalizing row values with
  | zero => simp [potentialRows]
  | succ fuel ih =>
      simp [potentialRows, ih, potentialRow_size, Nat.add_mul, Nat.add_assoc,
        Nat.add_comm, Nat.add_left_comm]

theorem buildPotential_size (input : Input) (distance : Nat) :
    (buildPotential input distance).size = (input.left.size + 1) * bandWidth input distance := by
  unfold buildPotential
  split
  next zero => simp [zero, bandWidth]
  next nonzero => simp [potentialRows_size]

/-- Storage scales with the edit band, capped by the shorter row dimension;
zero edit distance stores no potential cells. -/
theorem buildPotential_band_bound (input : Input) (distance : Nat) :
    (buildPotential input distance).size ≤ (input.left.size + 1) * (2 * distance - 1) := by
  rw [buildPotential_size]
  exact Nat.mul_le_mul_left _ (Nat.min_le_left _ _)

theorem bandValue_outside (input : Input) (distance : Nat) (values : Array Nat) (row column : Nat)
    (outside : ¬inBand distance row column) : bandValue input distance values row column = distance := by
  simp [bandValue, outside]

end LeanMyers
