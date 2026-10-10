namespace NativeFin
structure Holder (α : Type) where
  digit : Fin 5
  value : α
abbrev NatHolder := Holder Nat
def genericSite (value : NatHolder) : Nat := value.digit.val
end NativeFin
