namespace Specialized
universe u v

/-- A transparent alias used as a specialization type argument. -/
abbrev Word := UInt32

/-- A constructed type behind an alias: specializations name aliases, not expressions. -/
abbrev Words := Array Word

/-- A generic structure. Native packages reject its instantiations at the source. -/
structure Pair (α : Type u) (β : Type v) where
  first : α
  second : β

/-- Return the value unchanged. -/
def echo {α : Type u} (value : α) : α := value

theorem echo_spec {α : Type u} (value : α) : echo value = value := rfl

/-- Lean must resolve this instance, not the core default of zero. -/
instance (priority := high) : Inhabited UInt32 := ⟨37⟩

/-- An instance dictionary follows the implicit type argument. -/
def choose {α : Type u} [Inhabited α] (useValue : Bool) (value : α) : α :=
  if useValue then value else default

/-- Two explicit type arguments in different universes. -/
def first (α : Type u) (β : Type v) (a : α) (_b : β) : α := a

def duplicate {α : Type u} [Add α] (value : α) : α := value + value

/-- A monomorphic export beside the specializations. -/
def plain (value : Word) : Word := value + 3

end Specialized
