namespace Shop
universe u v
/-- A transparent alias used as a closed type argument. -/
abbrev Word := UInt32
/-- Return the value unchanged. -/
def keep {α : Type u} (value : α) : α := value
theorem keep_eq {α : Type u} (value : α) : keep value = value := rfl
/-- Lean must resolve this instance, not the core default of zero. -/
instance (priority := high) : Inhabited UInt32 := ⟨37⟩
/-- An instance dictionary follows the implicit type argument. -/
def pick {α : Type u} [Inhabited α] (useValue : Bool) (value : α) : α := if useValue then value else default
/-- Two explicit type arguments in different universes. -/
def first (α : Type u) (β : Type v) (a : α) (_b : β) : α := a
/-- A monomorphic export beside the specializations. -/
def plain (value : Word) : Word := value + 3
end Shop
