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

/-- A closed generic record whose fixed field is refined independently at each use. -/
structure GenericCarrier (α : Type) where
  value : Positive
  marker : α
abbrev GenericNat := GenericCarrier Nat

def genericUse (value : GenericNat) : Nat := value.value.val + value.marker
def genericEcho {α : Type u} (value : α) : α := value

def genericWrongName := genericUse
def genericWrongField := genericUse
def genericWrongConstructor := genericUse

/-- A generic checked record with retained type and closed value indices. -/
structure IndexedCarrier (α : Type) (flag : Bool) (label : String) (bound : Nat) where
  value : Positive
  marker : α
  flagCount : Nat
  labelSize : Nat
  boundValue : Nat
  flagMatches : (flagCount == 0) = flag
  labelMatches : label.length = labelSize
  boundMatches : bound = boundValue

abbrev IndexedOnAbZero := IndexedCarrier Nat true "ab" 0
abbrev IndexedOffEmptyWide :=
  IndexedCarrier Nat false "" 340282366920938463463374607431768211457
abbrev IndexedOffUnicodeZero := IndexedCarrier Nat false "λ🌱" 0

def checkedIndexedCarrier {α : Type} {flag : Bool} {label : String} {bound : Nat}
    (value : Positive) (marker : α) (flagCount labelSize boundValue : Nat) :
    Option (IndexedCarrier α flag label bound) :=
  if flagMatches : (flagCount == 0) = flag then
    if labelMatches : label.length = labelSize then
      if boundMatches : bound = boundValue then
        some ⟨value, marker, flagCount, labelSize, boundValue,
          flagMatches, labelMatches, boundMatches⟩
      else none
    else none
  else none

def mkIndexedOnAbZero (value : Positive) (marker flagCount labelSize boundValue : Nat) :
    Option IndexedOnAbZero :=
  checkedIndexedCarrier value marker flagCount labelSize boundValue

def mkIndexedOffEmptyWide (value : Positive) (marker flagCount labelSize boundValue : Nat) :
    Option IndexedOffEmptyWide :=
  checkedIndexedCarrier value marker flagCount labelSize boundValue

def mkIndexedOffUnicodeZero (value : Positive) (marker flagCount labelSize boundValue : Nat) :
    Option IndexedOffUnicodeZero :=
  checkedIndexedCarrier value marker flagCount labelSize boundValue

class IndexStamp (α : Type u) where
  stamp : Nat

instance indexedOnAbZeroStamp : IndexStamp IndexedOnAbZero := ⟨1⟩
instance indexedOffEmptyWideStamp : IndexStamp IndexedOffEmptyWide := ⟨2⟩
instance indexedOffUnicodeZeroStamp : IndexStamp IndexedOffUnicodeZero := ⟨3⟩

/-- Specializations retain synthesized dictionaries but expose only the payload. -/
def dependentEcho {α : Type u} [IndexStamp α] (value : α) : α := value

def indexedWrongName (value : IndexedOnAbZero) : Nat := value.marker
def indexedWrongField (value : IndexedOnAbZero) : Nat := value.marker
def indexedWrongConstructor (value : IndexedOnAbZero) : Nat := value.marker
def indexedWrongSubtype (value : IndexedOnAbZero) : Nat := value.marker
def indexedNested (values : Array IndexedOnAbZero) : Nat := values.size

inductive Chain where
  | empty
  | node (value : Positive) (tail : Chain)
def recursive (_ : Chain) : Nat := 0

end NominalSelection
