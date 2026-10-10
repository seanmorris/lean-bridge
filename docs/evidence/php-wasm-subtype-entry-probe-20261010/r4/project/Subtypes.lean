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
@[noinline, export lb_probe_constructor_checkedWord]
def checkedWord (value : String) : Option Word :=
  if h : value.length > 0 then some ⟨value, h⟩ else none
@[noinline, export lb_probe_constructor_checkedEven]
def checkedEven (value : Nat) : Option Even :=
  if h : value % 2 = 0 then some ⟨value, h⟩ else none
@[noinline, export lb_probe_constructor_checkedSmall]
def checkedSmall (value : Int) : Option Small :=
  if h : -128 ≤ value ∧ value < 128 then some ⟨value, h⟩ else none
@[noinline, export lb_probe_constructor_checkedPayload]
def checkedPayload (value : ByteArray) : Option Payload :=
  if h : value.size > 0 then some ⟨value, h⟩ else none

/-- A checked string argument and result. -/
@[noinline, export lb_probe_source_shout]
def shout (word : Word) : Word := ⟨word.val ++ "!", by simp [String.length_append]; omega⟩

/-- Half of an even number is exact. -/
@[noinline, export lb_probe_source_half]
def half (value : Even) : Nat := value.val / 2

/-- The checked argument comes after an unchecked one. -/
@[noinline, export lb_probe_source_scale]
def scale (factor : Int) (value : Small) : Int := factor * value.val

/-- The first byte of a nonempty payload. -/
@[noinline, export lb_probe_source_head]
def head (payload : Payload) : UInt8 := payload.val.get! 0

/-- A result-only subtype: the host receives the base value. -/
@[noinline, export lb_probe_source_pad]
def pad (value : Nat) : Even := ⟨value * 2, by omega⟩

/-- Two checked arguments: the second is rejected after the first passed. -/
@[noinline, export lb_probe_source_join]
def join (left : Word) (right : Word) : Word := ⟨left.val ++ right.val, by simp [String.length_append]; omega⟩

/-- A normalizing constructor: every input is accepted and clamped to the bound. -/
abbrev Bounded := { value : Nat // value ≤ 100 }
@[noinline, export lb_probe_constructor_checkedBounded]
def checkedBounded (value : Nat) : Option Bounded := some ⟨min value 100, Nat.min_le_right _ _⟩
/-- The export receives the constructed value, never the caller's input. -/
@[noinline, export lb_probe_source_clamp]
def clamp (value : Bounded) : Nat := value.val

/-- A checked constructor beside a compiler-checked Fin bound. Kept out of line so the
dispatch probe can count calls to the export itself. -/
@[noinline, export lb_probe_source_mix]
def mix (value : Even) (digit : Fin 10) : Nat := value.val + digit.val

end Subtypes

namespace Subtypes
universe u
abbrev Byte := { value : UInt8 // value != 0 }
@[noinline, export lb_probe_constructor_checkedByte]
def checkedByte (value : UInt8) : Option Byte :=
  if h : value != 0 then some ⟨value, h⟩ else none
@[noinline, export lb_probe_source_byte]
def byte (value : Byte) : Byte := value
@[noinline, export lb_probe_source_echo]
def echo {α : Type u} (value : α) : α := value
@[noinline, export lb_probe_constructor_normalizedEven]
def normalizedEven (value : Nat) : Option Even := some ⟨value * 2, by omega⟩
def wrongEven (value : Nat) : Option Nat := some value
unsafe def unsafeEven (value : Nat) : Option Even := checkedEven value
partial def partialEven (value : Nat) : Option Even :=
  if value == 0 then checkedEven value else partialEven (value - 1)
end Subtypes

namespace Subtypes
def zeroEven : Even := ⟨0, by decide⟩
end Subtypes

namespace Subtypes
@[noinline, export lb_probe_source_unrestricted]
def unrestricted (value : Nat) : Nat := value
end Subtypes
