import NominalConversion

namespace NominalSelection
open NominalConversion

abbrev EnvelopeAlias := Envelope
abbrev Group := Array (Option EnvelopeAlias)

structure AliasPair where
  left : Group
  right : Group

def aliases (left right : Group) : Nat := left.size + right.size
def inspectAliasPair (value : AliasPair) : Nat := aliases value.left value.right
def plainFin (value : Fin 3) : Nat := value.val

def wrongInput (_ : String) : Option Positive := none
def wrongPredicate (value : Nat) : Option { _n : Nat // True } := some ⟨value, True.intro⟩
unsafe def unsafeChoice (value : Nat) : Option Positive := plusOne value
partial def partialChoice (value : Nat) : Option Positive := partialChoice value
@[extern "nominal_unavailable_foreign"]
def foreignChoice (value : Nat) : Option Positive := plusOne value
def sorryChoice (value : Nat) : Option Positive := some ⟨value, by sorry⟩

def wrongName := first
def wrongOrder := first
def extraField := first
def missingField := first
def duplicateField := first
def emptySelection := first
def wrongInputSelection := first
def wrongPredicateSelection := first
def unsafeSelection := first
def partialSelection := first
def foreignSelection := first
def sorrySelection := first
def outsideSelection := first
def unknownSelection := first
def wrongCaseOrder := eventFirst
def extraCase := eventFirst
def missingCase := eventFirst
def duplicateCase := eventFirst
def wrongCaseField := eventFirst
def tooDeep := first
def tooWide := first
def resultOnly := produce
def callback (run : Envelope → Nat) (value : Envelope) : Nat := run value

structure Generic (α : Type) where
  value : α
abbrev GenericPositive := Generic Positive
def generic (value : GenericPositive) : Nat := value.value.val

inductive Chain where
  | empty
  | node (value : Positive) (tail : Chain)
def recursive (_ : Chain) : Nat := 0

end NominalSelection
