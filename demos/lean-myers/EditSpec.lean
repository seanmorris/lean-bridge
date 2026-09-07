import Init

/-! Generic insertion/deletion edit scripts. Operation zero keeps an equal pair,
one deletes a source item, and two inserts a target item. Replacing an item costs
one deletion plus one insertion; there is no unit-cost substitution operation. -/

namespace LeanMyers

structure Input where
  left : Array Nat
  right : Array Nat
  deriving Inhabited, Repr

structure Solution where
  operations : Array Nat
  distance : Nat
  deriving Inhabited, Repr

inductive ValidScript {α : Type} : List α → List α → List Nat → Prop
  | nil : ValidScript [] [] []
  | keep {value : α} {left right operations} : ValidScript left right operations →
      ValidScript (value :: left) (value :: right) (0 :: operations)
  | delete {value : α} {left right operations} : ValidScript left right operations →
      ValidScript (value :: left) right (1 :: operations)
  | insert {value : α} {left right operations} : ValidScript left right operations →
      ValidScript left (value :: right) (2 :: operations)

def scriptCost : List Nat → Nat
  | [] => 0
  | operation :: rest => (if operation = 0 then 0 else 1) + scriptCost rest

def OptimalScript {α : Type} (left right : List α) (operations : List Nat) : Prop :=
  ValidScript left right operations ∧
    ∀ other, ValidScript left right other → scriptCost operations ≤ scriptCost other

def Solves (input : Input) (solution : Solution) : Prop :=
  OptimalScript input.left.toList input.right.toList solution.operations.toList ∧
    solution.distance = scriptCost solution.operations.toList

def scriptCheck {α : Type} [DecidableEq α] : List α → List α → List Nat → Bool
  | [], [], [] => true
  | value :: left, next :: right, 0 :: operations =>
      decide (value = next) && scriptCheck left right operations
  | _ :: left, right, 1 :: operations => scriptCheck left right operations
  | left, _ :: right, 2 :: operations => scriptCheck left right operations
  | _, _, _ => false

def inputScriptCheck (input : Input) (operations : Array Nat) : Bool :=
  scriptCheck input.left.toList input.right.toList operations.toList

/-- Replay keeps actual source values, skips deletions, and obtains inserted
values from the supplied target. Equal keeps are checked, not assumed. -/
def replay {α : Type} [DecidableEq α] : List α → List α → List Nat → Option (List α)
  | [], [], [] => some []
  | value :: left, next :: right, 0 :: operations =>
      if value = next then (replay left right operations).map (value :: ·) else none
  | _ :: left, right, 1 :: operations => replay left right operations
  | left, value :: right, 2 :: operations => (replay left right operations).map (value :: ·)
  | _, _, _ => none

/-- Only inserted values need to accompany an opcode script. Kept target
values are omitted from this payload. -/
def insertionPayload {α : Type} : List α → List Nat → List α
  | _ :: right, 0 :: operations => insertionPayload right operations
  | right, 1 :: operations => insertionPayload right operations
  | value :: right, 2 :: operations => value :: insertionPayload right operations
  | _, _ => []

/-- Apply a patch using only the original sequence and inserted-value payload.
The complete target sequence is not an argument. -/
def applyOperations {α : Type} : List α → List α → List Nat → Option (List α)
  | [], [], [] => some []
  | value :: left, inserted, 0 :: operations =>
      (applyOperations left inserted operations).map (value :: ·)
  | _ :: left, inserted, 1 :: operations => applyOperations left inserted operations
  | left, value :: inserted, 2 :: operations =>
      (applyOperations left inserted operations).map (value :: ·)
  | _, _, _ => none

structure PotentialBounds {α : Type} (left right : List α) (potential : Nat → Nat → Nat) : Prop where
  delete : ∀ row column, row < left.length → column ≤ right.length →
    potential (row + 1) column ≤ potential row column + 1
  insert : ∀ row column, row ≤ left.length → column < right.length →
    potential row (column + 1) ≤ potential row column + 1
  keep : ∀ row column (leftBound : row < left.length) (rightBound : column < right.length),
    left[row] = right[column] → potential (row + 1) (column + 1) ≤ potential row column

end LeanMyers
