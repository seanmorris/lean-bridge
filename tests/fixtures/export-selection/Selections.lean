namespace First

/-- Increment the argument. -/
def bump (value : UInt32) : UInt32 := value + 1

/-- The identity equality records a theorem without exporting it. -/
theorem reflexive (value : UInt32) : value = value := rfl

end First

namespace Second

/-- An unrelated API with the same unqualified name. -/
def bump (value : UInt32) : UInt32 := value + 2

/-- An unselected collection signature does not block the selected scalar. -/
def collection (values : Array UInt32) : Array UInt32 := values

end Second
