namespace GenericRecords

/-- The same closed application in two namespaces keeps two public identities. -/
namespace Left
abbrev LeftBox := Box Nat
end Left
namespace Right
abbrev RightBox := Box Nat
end Right

abbrev OptionalBoxes := Option Boxes
abbrev Nats := List Nat
abbrev OptionalNat := Option Nat

/-- A single polymorphic declaration, specialized by export configuration. -/
def echo {α : Type u} (value : α) : α := value

theorem echo_spec {α : Type u} (value : α) : echo value = value := rfl

end GenericRecords
