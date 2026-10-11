namespace StructuralSubtypes

abbrev Positive := { value : Nat // 0 < value }
abbrev Word := { value : String // 0 < value.length }
abbrev Byte := { value : UInt8 // value ≠ 0 }
abbrev Group := Array (Option Positive)
abbrev OtherGroup := Group

def checkedPositive (value : Nat) : Option Positive :=
  if proof : 0 < value then some ⟨value, proof⟩ else none

def normalizePositive (value : Nat) : Option Positive :=
  if 0 < value then some ⟨value + 1, Nat.zero_lt_succ value⟩ else none

def checkedWord (value : String) : Option Word :=
  if proof : 0 < value.length then some ⟨value, proof⟩ else none

def checkedByte (value : UInt8) : Option Byte :=
  if proof : value ≠ 0 then some ⟨value, proof⟩ else none

def wrongPredicate (value : Nat) : Option (Fin 10) :=
  if proof : value < 10 then some ⟨value, proof⟩ else none

unsafe def unsafePositive (value : Nat) : Option Positive := checkedPositive value

def arrays (values : Array Positive) : Array Positive := values
def scalar (value : Positive) : Positive := value
def wrongInput := arrays
def wrongResult := arrays
def unsafeChoice := arrays
def wrongShape := arrays
def emptyChoice := arrays
def extraChoice := arrays
def missingChoice := arrays
def tooDeep := arrays
def tooWide := arrays
def lists (values : List Positive) : List Positive := values
def options (value : Option Positive) : Option Positive := value
def product (value : Positive × Word) : Positive × Word := value
def branch (value : Except Word Positive) : Except Word Positive := value
def byteBranches (values : Array (Option (Byte × Positive))) : Array (Option (Byte × Positive)) := values
def nested (values : Array (List (Option (Positive × Fin 184467440737095516170)))) : Nat :=
  values.size

def aliasPair (values : Group × OtherGroup) : Group × OtherGroup := values
def aliasArguments (first : Group) (second : Group) : Group := first ++ second
def plainFin (values : Array (Option (Fin 10))) : Nat := values.size

def generic {α : Type} (values : List α) : List α := values

structure Box where
  value : Positive

def field (box : Box) : Nat := box.value.val
def callback (run : Positive → Nat) : Nat := run ⟨1, by decide⟩
def callbackAlias (run : Group → Nat) : Nat := run #[]
def callbackReply (run : Nat → Positive) : Nat := (run 1).val

end StructuralSubtypes
