import NominalConversion

namespace NominalConversion

abbrev EnvelopeAlias := Envelope
abbrev Envelopes := Array EnvelopeAlias
abbrev DigitAlias := Fin 3

structure Digit where
  newDigit ::
  value : DigitAlias

structure WithDigit where
  payload : Positive
  digit : Digit

def echoAliases (values : Envelopes) : Envelopes := values
def withDigit (value : WithDigit) : Nat := value.payload.val * 100 + value.digit.value.val
def echoDigit (value : Digit) : Digit := value

end NominalConversion

namespace RecursiveMirrors

inductive Chain where
  | empty
  | node (value : NominalConversion.Positive) (digit : Fin 3) (tail : Chain)

def total : Chain → Nat
  | .empty => 0
  | .node value _ tail => value.val + total tail

def first (value : Chain) : Nat := total value
def second (value : Chain) : Nat := total value
def echo (value : Chain) : Chain := value

end RecursiveMirrors

namespace MutualMirrors

mutual
structure Left where
  value : NominalConversion.Positive
  next : Option Right
inductive Right where
  | stop
  | node (value : NominalConversion.Positive) (next : Option Left)
end

mutual
def totalLeft : Left → Nat
  | ⟨value, none⟩ => value.val
  | ⟨value, some next⟩ => value.val + totalRight next
def totalRight : Right → Nat
  | .stop => 0
  | .node value none => value.val
  | .node value (some next) => value.val + totalLeft next
end

def first (value : Left) : Nat := totalLeft value
def second (value : Left) : Nat := totalLeft value
def echo (value : Left) : Left := value

abbrev LeftAlias := Left
abbrev LeftGroup := Array (Option LeftAlias)

def groups (values : LeftGroup) : Nat :=
  values.foldl (fun total value => total + (value.map totalLeft).getD 0) 0

def echoGroups (values : LeftGroup) : LeftGroup := values

end MutualMirrors

namespace MutualChecked

abbrev Positive := NominalConversion.Positive

def plusOne := NominalConversion.plusOne
def plusTwo := NominalConversion.plusTwo

mutual
structure Envelope where
  value : Positive
  mode : Fin 3
  next : Option Step
  linked : mode.val ≤ value.val
inductive Step where
  | stop
  | more (packet : Envelope)
end

def mkEnvelope (value : Positive) (mode : Fin 3) (next : Option Step) : Option Envelope :=
  if linked : mode.val ≤ value.val then some ⟨value, mode, next, linked⟩ else none

def normalizeEnvelope (value : Positive) (mode : Fin 3) (next : Option Step) : Option Envelope :=
  if linked : mode.val ≤ value.val then some ⟨value, mode, next, linked⟩ else none

mutual
def totalEnvelope : Envelope → Nat
  | ⟨value, _, none, _⟩ => value.val
  | ⟨value, _, some next, _⟩ => value.val + totalStep next
def totalStep : Step → Nat
  | .stop => 0
  | .more packet => totalEnvelope packet
end

def first (value : Envelope) : Nat := totalEnvelope value
def second (value : Envelope) : Nat := totalEnvelope value
def echo (value : Envelope) : Envelope := value
abbrev EnvelopeAlias := Envelope
def alias (value : EnvelopeAlias) : Nat := totalEnvelope value

end MutualChecked
