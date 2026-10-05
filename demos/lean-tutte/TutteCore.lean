import Init

namespace LeanTutte

/-- Integer coordinates describe exact squares, not rounded screen pixels. -/
structure Square where
  x : Nat
  y : Nat
  side : Nat
  top : Nat
  bottom : Nat
  deriving Repr, DecidableEq

def contains (s : Square) (x y : Nat) : Bool :=
  s.x ≤ x && x < s.x + s.side && s.y ≤ y && y < s.y + s.side

def coverage (squares : List Square) (x y : Nat) : Nat :=
  (squares.filter (fun s => contains s x y)).length

/-- Exactly one square covers every unit cell; every square fits the boundary. -/
def Tiling (width height : Nat) (squares : List Square) : Prop :=
  0 < width ∧ 0 < height ∧ squares ≠ [] ∧
  (∀ s ∈ squares, 0 < s.side ∧ s.x + s.side ≤ width ∧ s.y + s.side ≤ height) ∧
  (∀ x ∈ List.range width, ∀ y ∈ List.range height, coverage squares x y = 1)

instance (w h : Nat) (ss : List Square) : Decidable (Tiling w h ss) :=
  inferInstanceAs (Decidable (_ ∧ _ ∧ _ ∧ _ ∧ _))

def tilingCheck (width height : Nat) (squares : List Square) : Bool :=
  decide (Tiling width height squares)

def incoming (squares : List Square) (node : Nat) : Nat :=
  ((squares.filter (fun s => s.bottom == node)).map Square.side).sum

def outgoing (squares : List Square) (node : Nat) : Nat :=
  ((squares.filter (fun s => s.top == node)).map Square.side).sum

/-- Unit-resistance wires join the actual upper and lower levels of their square.
The first and last junctions are the battery terminals. -/
def Electrical (width height : Nat) (levels : List Nat) (squares : List Square) : Prop :=
  2 ≤ levels.length ∧ levels[0]? = some height ∧ levels[levels.length - 1]? = some 0 ∧
  (∀ s ∈ squares, s.top < levels.length ∧ s.bottom < levels.length ∧
    levels[s.top]? = some (height - s.y) ∧
    levels[s.bottom]? = some (height - (s.y + s.side)) ∧
    levels[s.top]?.getD 0 = levels[s.bottom]?.getD 0 + s.side) ∧
  incoming squares 0 = 0 ∧ outgoing squares 0 = width ∧
  incoming squares (levels.length - 1) = width ∧ outgoing squares (levels.length - 1) = 0 ∧
  (∀ node ∈ List.range levels.length, node ≠ 0 → node ≠ levels.length - 1 →
    incoming squares node = outgoing squares node)

instance (w h : Nat) (vs : List Nat) (ss : List Square) : Decidable (Electrical w h vs ss) :=
  inferInstanceAs (Decidable (_ ∧ _ ∧ _ ∧ _ ∧ _ ∧ _ ∧ _ ∧ _ ∧ _))

def electricalCheck (width height : Nat) (levels : List Nat) (squares : List Square) : Bool :=
  decide (Electrical width height levels squares)

def subsets : List Square → List (List Square)
  | [] => [[]]
  | s :: rest => let tails := subsets rest; tails ++ tails.map (s :: ·)

def area (ss : List Square) : Nat := (ss.map (fun s => s.side * s.side)).sum

def box (ss : List Square) : Nat × Nat × Nat × Nat :=
  match ss with
  | [] => (0, 0, 0, 0)
  | s :: rest => rest.foldl (fun (x, y, right, bottom) q =>
      (min x q.x, min y q.y, max right (q.x + q.side), max bottom (q.y + q.side)))
      (s.x, s.y, s.x + s.side, s.y + s.side)

/-- In a disjoint tiling, filling a bounding box makes a rectangular sub-tiling. -/
def fillsBox (ss : List Square) : Bool :=
  let (x, y, right, bottom) := box ss
  area ss == (right - x) * (bottom - y)

def compoundParts (ss : List Square) : List (List Square) :=
  (subsets ss).filter (fun part => 1 < part.length && part.length < ss.length && fillsBox part)

def simpleCheck (ss : List Square) : Bool := (compoundParts ss).isEmpty

def perfectCheck (ss : List Square) : Bool :=
  decide (1 < ss.length ∧ (ss.map Square.side).Pairwise (· ≠ ·))

/-- A voltage difference around a walk telescopes, regardless of the drawing. -/
def voltageSum (potential : Nat → Int) : Nat → List Nat → Int
  | _, [] => 0
  | start, next :: rest => potential start - potential next + voltageSum potential next rest

def endpoint : Nat → List Nat → Nat
  | start, [] => start
  | _, next :: rest => endpoint next rest

/-- Add the external pole-to-pole edge before testing vertex connectivity. -/
def linked (count : Nat) (squares : List Square) (a b : Nat) : Bool :=
  (a == 0 && b == count - 1) || (b == 0 && a == count - 1) ||
    squares.any (fun s => (s.top == a && s.bottom == b) || (s.top == b && s.bottom == a))

def survivors (count a b : Nat) : List Nat :=
  (List.range count).filter (fun v => v != a && v != b)

def flood (count : Nat) (squares : List Square) (a b start : Nat) : Nat → List Nat
  | 0 => [start]
  | fuel + 1 =>
    let seen := flood count squares a b start fuel
    (survivors count a b).filter (fun v => seen.contains v || seen.any (fun u => linked count squares u v))

def connectedCheck (count : Nat) (squares : List Square) (a b : Nat) : Bool :=
  match survivors count a b with
  | [] => false
  | start :: rest => (start :: rest).all (fun v => (flood count squares a b start count).contains v)

def threeConnectedCheck (count : Nat) (squares : List Square) : Bool :=
  4 ≤ count && (List.range (count + 1)).all (fun a =>
    (List.range (count + 1)).all (fun b => connectedCheck count squares a b))

inductive Path (count : Nat) (squares : List Square) (a b start : Nat) : Nat → Prop where
  | refl : start < count → start ≠ a → start ≠ b → Path count squares a b start start
  | step {u v : Nat} : Path count squares a b start u → linked count squares u v = true →
      v < count → v ≠ a → v ≠ b → Path count squares a b start v

def ConnectedAfter (count : Nat) (squares : List Square) (a b : Nat) : Prop :=
  ∃ start, start < count ∧ start ≠ a ∧ start ≠ b ∧
    ∀ v, v < count → v ≠ a → v ≠ b → Path count squares a b start v

def decodeSquares (words : Array Nat) : List Square :=
  (List.range (words.size / 5)).map (fun i =>
    ⟨words[i * 5]!, words[i * 5 + 1]!, words[i * 5 + 2]!,
      words[i * 5 + 3]!, words[i * 5 + 4]!⟩)

def flag (value : Bool) : Nat := if value then 1 else 0

/-- The exported result comes from these exact executable checks. -/
def report (width height : Nat) (levels : List Nat) (squares : List Square) : Array Nat :=
  #[flag (tilingCheck width height squares), flag (electricalCheck width height levels squares),
    flag (simpleCheck squares), flag (perfectCheck squares), flag (threeConnectedCheck levels.length squares)] ++
    ((List.range levels.length).flatMap (fun n => [incoming squares n, outgoing squares n])).toArray

@[export lean_tutte_check]
def checkExport (width height : Nat) (levels words : Array Nat) : Array Nat :=
  report width height levels.toList (decodeSquares words)

end LeanTutte
