namespace NominalPrimitiveSubtypes

-- These author definitions are independent of compiler metadata and host bindings.
def checked {α : Type} (predicate : α → Prop) [DecidablePred predicate]
    (value : α) : Option { item : α // predicate item } :=
  if proof : predicate value then some ⟨value, proof⟩ else none

abbrev PresentUnit := Subtype (fun _ : Unit => True)
abbrev TrueBool := { value : Bool // value = true }
abbrev EvenUInt8 := { value : UInt8 // value.toNat % 2 = 0 }
abbrev EvenUInt16 := { value : UInt16 // value.toNat % 2 = 0 }
abbrev EvenUInt32 := { value : UInt32 // value.toNat % 2 = 0 }
abbrev EvenUInt64 := { value : UInt64 // value.toNat % 2 = 0 }
abbrev EvenInt8 := { value : Int8 // value.toInt % 2 = 0 }
abbrev EvenInt16 := { value : Int16 // value.toInt % 2 = 0 }
abbrev EvenInt32 := { value : Int32 // value.toInt % 2 = 0 }
abbrev EvenInt64 := { value : Int64 // value.toInt % 2 = 0 }
abbrev EvenNat := { value : Nat // value % 2 = 0 }
abbrev EvenInt := { value : Int // value % 2 = 0 }
abbrev FiniteFloat32 := { value : Float32 // value.isFinite = true }
abbrev FiniteFloat64 := { value : Float // value.isFinite = true }
abbrev NonemptyText := { value : String // value.length > 0 }
abbrev NonemptyBytes := { value : ByteArray // value.size > 0 }
abbrev NonzeroChar := { value : Char // value.toNat ≠ 0 }
abbrev EvenUSize := { value : USize // value.toNat % 2 = 0 }
abbrev EvenISize := { value : ISize // value.toInt % 2 = 0 }

-- Unit has one value. Its separate refusal selection tests constructor authority
-- without preventing the normalizing Packet export from reaching other fields.
def unitA (value : Unit) : Option PresentUnit := some ⟨value, trivial⟩
def unitB (value : Unit) : Option PresentUnit := some ⟨value, trivial⟩
def unitReject (_ : Unit) : Option PresentUnit := none
def boolA (value : Bool) : Option TrueBool := checked (· = true) value
def boolB (value : Bool) : Option TrueBool := checked (· = true) (!value)

-- The first selections have a stricter input policy than the Subtype predicate.
-- Result-only producers below may return valid values outside that policy.
def uint8A (value : UInt8) : Option EvenUInt8 :=
  if value.toNat < 100 then checked (fun item : UInt8 => item.toNat % 2 = 0) value else none
def uint8B (value : UInt8) : Option EvenUInt8 :=
  checked (fun item : UInt8 => item.toNat % 2 = 0) (value + 2)
def uint16A (value : UInt16) : Option EvenUInt16 :=
  if value.toNat < 100 then checked (fun item : UInt16 => item.toNat % 2 = 0) value else none
def uint16B (value : UInt16) : Option EvenUInt16 :=
  checked (fun item : UInt16 => item.toNat % 2 = 0) (value + 2)
def uint32A (value : UInt32) : Option EvenUInt32 :=
  if value.toNat < 100 then checked (fun item : UInt32 => item.toNat % 2 = 0) value else none
def uint32B (value : UInt32) : Option EvenUInt32 :=
  checked (fun item : UInt32 => item.toNat % 2 = 0) (value + 2)
def uint64A (value : UInt64) : Option EvenUInt64 :=
  if value.toNat < 100 then checked (fun item : UInt64 => item.toNat % 2 = 0) value else none
def uint64B (value : UInt64) : Option EvenUInt64 :=
  checked (fun item : UInt64 => item.toNat % 2 = 0) (value + 2)
def int8A (value : Int8) : Option EvenInt8 :=
  if value.toInt < 100 then checked (fun item : Int8 => item.toInt % 2 = 0) value else none
def int8B (value : Int8) : Option EvenInt8 :=
  checked (fun item : Int8 => item.toInt % 2 = 0) (value + 2)
def int16A (value : Int16) : Option EvenInt16 :=
  if value.toInt < 100 then checked (fun item : Int16 => item.toInt % 2 = 0) value else none
def int16B (value : Int16) : Option EvenInt16 :=
  checked (fun item : Int16 => item.toInt % 2 = 0) (value + 2)
def int32A (value : Int32) : Option EvenInt32 :=
  if value.toInt < 100 then checked (fun item : Int32 => item.toInt % 2 = 0) value else none
def int32B (value : Int32) : Option EvenInt32 :=
  checked (fun item : Int32 => item.toInt % 2 = 0) (value + 2)
def int64A (value : Int64) : Option EvenInt64 :=
  if value.toInt < 100 then checked (fun item : Int64 => item.toInt % 2 = 0) value else none
def int64B (value : Int64) : Option EvenInt64 :=
  checked (fun item : Int64 => item.toInt % 2 = 0) (value + 2)
def natA (value : Nat) : Option EvenNat :=
  if value < 100 then checked (fun item : Nat => item % 2 = 0) value else none
def natB (value : Nat) : Option EvenNat := checked (fun item : Nat => item % 2 = 0) (value + 2)
def intA (value : Int) : Option EvenInt :=
  if value < 100 then checked (fun item : Int => item % 2 = 0) value else none
def intB (value : Int) : Option EvenInt := checked (fun item : Int => item % 2 = 0) (value + 2)
def float32A (value : Float32) : Option FiniteFloat32 :=
  if value < 10 then checked (fun item : Float32 => item.isFinite = true) value else none
def float32B (value : Float32) : Option FiniteFloat32 :=
  checked (fun item : Float32 => item.isFinite = true) (-value)
def float64A (value : Float) : Option FiniteFloat64 :=
  if value < 10 then checked (fun item : Float => item.isFinite = true) value else none
def float64B (value : Float) : Option FiniteFloat64 :=
  checked (fun item : Float => item.isFinite = true) (-value)
def textA (value : String) : Option NonemptyText :=
  if value.length < 8 then checked (fun item : String => item.length > 0) value else none
def textB (value : String) : Option NonemptyText :=
  checked (fun item : String => item.length > 0) (value ++ "!")
def bytesA (value : ByteArray) : Option NonemptyBytes :=
  if value.size < 8 then checked (fun item : ByteArray => item.size > 0) value else none
def bytesB (value : ByteArray) : Option NonemptyBytes :=
  checked (fun item : ByteArray => item.size > 0) (value.push 255)
def charA (value : Char) : Option NonzeroChar :=
  if value.toNat < 128 then checked (fun item : Char => item.toNat ≠ 0) value else none
def charB (value : Char) : Option NonzeroChar :=
  checked (fun item : Char => item.toNat ≠ 0) (if value == 'a' then 'b' else value)
def usizeA (value : USize) : Option EvenUSize :=
  if value.toNat < 100 then checked (fun item : USize => item.toNat % 2 = 0) value else none
def usizeB (value : USize) : Option EvenUSize :=
  checked (fun item : USize => item.toNat % 2 = 0) (value + 2)
def isizeA (value : ISize) : Option EvenISize :=
  if value.toInt < 100 then checked (fun item : ISize => item.toInt % 2 = 0) value else none
def isizeB (value : ISize) : Option EvenISize :=
  checked (fun item : ISize => item.toInt % 2 = 0) (value + 2)

structure Packet where
  unitValue : PresentUnit
  boolValue : TrueBool
  uint8Value : EvenUInt8
  uint16Value : EvenUInt16
  uint32Value : EvenUInt32
  uint64Value : EvenUInt64
  int8Value : EvenInt8
  int16Value : EvenInt16
  int32Value : EvenInt32
  int64Value : EvenInt64
  natValue : EvenNat
  intValue : EvenInt
  float32Value : FiniteFloat32
  float64Value : FiniteFloat64
  textValue : NonemptyText
  bytesValue : NonemptyBytes
  charValue : NonzeroChar
  usizeValue : EvenUSize
  isizeValue : EvenISize
  digit : Fin 3

structure RawPacket where
  unitValue : Unit
  boolValue : Bool
  uint8Value : UInt8
  uint16Value : UInt16
  uint32Value : UInt32
  uint64Value : UInt64
  int8Value : Int8
  int16Value : Int16
  int32Value : Int32
  int64Value : Int64
  natValue : Nat
  intValue : Int
  float32Value : Float32
  float64Value : Float
  textValue : String
  bytesValue : ByteArray
  charValue : Char
  usizeValue : USize
  isizeValue : ISize
  digit : Nat

abbrev PacketAlias := Packet
abbrev Group := Array (Option PacketAlias)

structure Pair where
  left : Group
  right : Group

inductive Event where
  | empty
  | box (value : Packet)
  | choices (values : Array (Option (Except Packet Packet)))

def echoA (value : Packet) : Packet := value
def echoB (value : Packet) : Packet := value
def refuseUnit (value : Packet) : Packet := value
def combine (left right : Packet) : Packet × Packet := (left, right)
def echoPair (value : Pair) : Pair := value
def echoEventA (value : Event) : Event := value
def echoEventB (value : Event) : Event := value
def aliases (left right : Group) : Group := left ++ right

-- These producers construct proofs directly from their weaker predicates. They
-- never call the A/B input selections and need no host-selected constructors.
def produce (value : RawPacket) : Option Packet := do
  let boolValue ← checked (fun item : Bool => item = true) value.boolValue
  let uint8Value ← checked (fun item : UInt8 => item.toNat % 2 = 0) value.uint8Value
  let uint16Value ← checked (fun item : UInt16 => item.toNat % 2 = 0) value.uint16Value
  let uint32Value ← checked (fun item : UInt32 => item.toNat % 2 = 0) value.uint32Value
  let uint64Value ← checked (fun item : UInt64 => item.toNat % 2 = 0) value.uint64Value
  let int8Value ← checked (fun item : Int8 => item.toInt % 2 = 0) value.int8Value
  let int16Value ← checked (fun item : Int16 => item.toInt % 2 = 0) value.int16Value
  let int32Value ← checked (fun item : Int32 => item.toInt % 2 = 0) value.int32Value
  let int64Value ← checked (fun item : Int64 => item.toInt % 2 = 0) value.int64Value
  let natValue ← checked (fun item : Nat => item % 2 = 0) value.natValue
  let intValue ← checked (fun item : Int => item % 2 = 0) value.intValue
  let float32Value ← checked (fun item : Float32 => item.isFinite = true) value.float32Value
  let float64Value ← checked (fun item : Float => item.isFinite = true) value.float64Value
  let textValue ← checked (fun item : String => item.length > 0) value.textValue
  let bytesValue ← checked (fun item : ByteArray => item.size > 0) value.bytesValue
  let charValue ← checked (fun item : Char => item.toNat ≠ 0) value.charValue
  let usizeValue ← checked (fun item : USize => item.toNat % 2 = 0) value.usizeValue
  let isizeValue ← checked (fun item : ISize => item.toInt % 2 = 0) value.isizeValue
  let digit : Fin 3 ← if proof : value.digit < 3 then some ⟨value.digit, proof⟩ else none
  return {
    unitValue := ⟨value.unitValue, trivial⟩
    boolValue, uint8Value, uint16Value, uint32Value, uint64Value
    int8Value, int16Value, int32Value, int64Value, natValue, intValue
    float32Value, float64Value, textValue, bytesValue, charValue
    usizeValue, isizeValue, digit
  }

def produceGroup (value : RawPacket) : Group :=
  match produce value with
  | none => #[none]
  | some packet => #[none, some packet]

def producePair (value : RawPacket) : Pair := ⟨produceGroup value, produceGroup value⟩

def produceEvent (value : RawPacket) : Event :=
  match produce value with
  | none => .empty
  | some packet => .box packet

def produceChoices (value : RawPacket) : Event :=
  match produce value with
  | none => .choices #[none]
  | some packet => .choices #[none, some (.ok packet), some (.error packet)]

def wordBits : UInt32 := System.Platform.numBits.toUInt32

end NominalPrimitiveSubtypes
