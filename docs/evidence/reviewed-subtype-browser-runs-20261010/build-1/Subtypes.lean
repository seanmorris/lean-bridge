namespace Subtypes

/-- A nonempty string. -/
abbrev Word := { value : String // value.length > 0 }
/-- An even natural number. -/
abbrev Even := { value : Nat // value % 2 = 0 }
/-- A signed value within one byte. -/
abbrev Small := { value : Int // -128 ≤ value ∧ value < 128 }
/-- Nonempty bytes. -/
abbrev Payload := { value : ByteArray // value.size > 0 }

/-- Checked constructors: the only way a host value becomes a subtype. -/
def checkedWord (value : String) : Option Word :=
  if h : value.length > 0 then some ⟨value, h⟩ else none
def checkedEven (value : Nat) : Option Even :=
  if h : value % 2 = 0 then some ⟨value, h⟩ else none
def checkedSmall (value : Int) : Option Small :=
  if h : -128 ≤ value ∧ value < 128 then some ⟨value, h⟩ else none
def checkedPayload (value : ByteArray) : Option Payload :=
  if h : value.size > 0 then some ⟨value, h⟩ else none

/-- A checked string argument and result. -/
def shout (word : Word) : Word := ⟨word.val ++ "!", by simp [String.length_append]; omega⟩

/-- Half of an even number is exact. -/
def half (value : Even) : Nat := value.val / 2

/-- The checked argument comes after an unchecked one. -/
def scale (factor : Int) (value : Small) : Int := factor * value.val

/-- The first byte of a nonempty payload. -/
def head (payload : Payload) : UInt8 := payload.val.get! 0

/-- A result-only subtype: the host receives the base value. -/
def pad (value : Nat) : Even := ⟨value * 2, by omega⟩

/-- Two checked arguments: the second is rejected after the first passed. -/
def join (left : Word) (right : Word) : Word := ⟨left.val ++ right.val, by simp [String.length_append]; omega⟩

/-- A normalizing constructor: every input is accepted and clamped to the bound. -/
abbrev Bounded := { value : Nat // value ≤ 100 }
def checkedBounded (value : Nat) : Option Bounded := some ⟨min value 100, Nat.min_le_right _ _⟩
/-- The export receives the constructed value, never the caller's input. -/
def clamp (value : Bounded) : Nat := value.val

/-- A checked constructor beside a compiler-checked Fin bound. Kept out of line so the
dispatch probe can count calls to the export itself. -/
@[noinline] def mix (value : Even) (digit : Fin 10) : Nat := value.val + digit.val

end Subtypes

namespace Subtypes
universe u
abbrev Byte := { value : UInt8 // value != 0 }
def checkedByte (value : UInt8) : Option Byte :=
  if h : value != 0 then some ⟨value, h⟩ else none
def byte (value : Byte) : Byte := value
def echo {α : Type u} (value : α) : α := value
def normalizedEven (value : Nat) : Option Even := some ⟨value * 2, by omega⟩
def wrongEven (value : Nat) : Option Nat := some value
unsafe def unsafeEven (value : Nat) : Option Even := checkedEven value
partial def partialEven (value : Nat) : Option Even :=
  if value == 0 then checkedEven value else partialEven (value - 1)
end Subtypes

namespace Subtypes
def zeroEven : Even := ⟨0, by decide⟩
end Subtypes
