namespace Defaults

/-- Preserve an optional fixed-width word. -/
@[noinline] def word (value0 : UInt32 := 7) : UInt32 := value0

/-- Preserve an optional unbounded natural. -/
@[noinline] def natural
    (value0 : Nat := 184467440737095516160) : Nat := value0

/-- Preserve optional UTF-8 text. -/
@[noinline] def text (value0 : String := "Lean\nBridge") : String := value0

/-- Preserve an optional Unicode scalar. -/
@[noinline] def character (value0 : Char := 'λ') : Char := value0

/-- Preserve an optional value whose default is Option.none. -/
@[noinline] def maybe
    (value0 : Option UInt32 := none) : Option UInt32 := value0

/-- Preserve an optional value whose default is Option.some. -/
@[noinline] def present
    (value0 : Option UInt32 := some 9) : Option UInt32 := value0

/-- Preserve an optional Unit value without confusing omission with host null. -/
@[noinline] def unitValue (value0 : Unit := ()) : Unit := value0

end Defaults
