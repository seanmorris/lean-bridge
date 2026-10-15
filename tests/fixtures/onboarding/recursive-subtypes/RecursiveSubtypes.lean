namespace RecursiveSubtypes

abbrev Positive := { value : Nat // 0 < value }

def positive (value : Nat) : Positive :=
  ⟨value + 1, Nat.zero_lt_succ value⟩

def plusOne (value : Nat) : Option Positive :=
  if value < 100 then some (positive value) else none

def plusTwo (value : Nat) : Option Positive :=
  if value < 90 then some (positive (value + 1)) else none

inductive Chain where
  | empty
  | node (value : Positive) (digit : Fin 3) (tail : Chain)

abbrev ChainAlias := Chain
abbrev Groups := Array (Option ChainAlias)

def first : Chain → Nat
  | .empty => 0
  | .node value _ _ => value.val

def second : Chain → Nat
  | .empty => 0
  | .node value _ _ => value.val

def echo (value : Chain) : Chain := value

def groups (values : Groups) : Nat := values.size

def echoGroups (values : Groups) : Groups := values

def produce (value : Nat) : Chain :=
  .node (positive value) ⟨2, by decide⟩ (.node (positive (value + 1)) ⟨1, by decide⟩ .empty)

end RecursiveSubtypes
