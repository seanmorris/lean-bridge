import NominalSubtypes

namespace NominalSubtypes.GenericCompositions
open NominalSubtypes

/-- A closed generic record whose fixed field is refined independently at each use. -/
structure GenericCarrier (α : Type) where
  value : Positive
  marker : α

abbrev GenericNat := GenericCarrier Nat

def genericUse (value : GenericNat) : Nat := value.value.val + value.marker

def genericEcho {α : Type u} (value : α) : α := value

end NominalSubtypes.GenericCompositions
