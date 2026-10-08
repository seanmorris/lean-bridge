namespace GenericInheritance

/-- A generic parent and a generic child; the child's toBase field has the unnamed type Base α. -/
structure Base (α : Type) where
  base : α

structure Child (α : Type) extends Base α where
  child : Nat

/-- The one source alias that names the inherited parent of NatChild. -/
abbrev NatBase := Base Nat
abbrev NatChild := Child Nat

/-- A universe-polymorphic parent, instantiated at Type. -/
structure UBase (α : Type u) where
  value : α

structure UChild (α : Type u) extends UBase α where
  extra : Nat

abbrev UNatBase := UBase Nat
abbrev UNatChild := UChild Nat

/-- A phantom parent argument: Marker reaches the package only as provenance. -/
structure Tag (α : Type) where
  label : String

structure Marker where
  id : Nat

structure Tagged (α : Type) extends Tag α where
  count : Nat

abbrev MarkerTag := Tag Marker
abbrev MarkerTagged := Tagged Marker

def grow (value : NatChild) : NatChild := { value with base := value.base + 1, child := value.child * 2 }
def lift (value : UNatChild) : Nat := value.value + value.extra
def relabel (value : MarkerTagged) : MarkerTagged := { value with label := value.label ++ "!" }

end GenericInheritance
