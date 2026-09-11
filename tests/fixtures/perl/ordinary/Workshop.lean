namespace Workshop

structure Label where
  text : String
  bytes : ByteArray

structure Packet where
  label : Label
  values : Array UInt32
  enabled : Bool

structure Counter where
  value : UInt32
  label : String

structure Reading where
  value : UInt32

structure Scalars where
  unitVal : Unit
  boolVal : Bool
  uint8Val : UInt8
  uint16Val : UInt16
  uint32Val : UInt32
  uint64Val : UInt64
  int8Val : Int8
  int16Val : Int16
  int32Val : Int32
  int64Val : Int64
  natVal : Nat
  intVal : Int
  float32Val : Float32
  floatVal : Float
  stringVal : String
  bytesVal : ByteArray

def add (left right : UInt32) : UInt32 := left + right
def echoUnit (value : Unit) : Unit := value
def echoBool (value : Bool) : Bool := value
def echoUInt8 (value : UInt8) : UInt8 := value
def echoUInt16 (value : UInt16) : UInt16 := value
def echoUInt32 (value : UInt32) : UInt32 := value
def echoUInt64 (value : UInt64) : UInt64 := value
def echoInt8 (value : Int8) : Int8 := value
def echoInt16 (value : Int16) : Int16 := value
def echoInt32 (value : Int32) : Int32 := value
def echoInt64 (value : Int64) : Int64 := value
def echoNat (value : Nat) : Nat := value
def echoInt (value : Int) : Int := value
def echoFloat32 (value : Float32) : Float32 := value
def echoFloat (value : Float) : Float := value
def echoString (value : String) : String := value
def echoBytes (value : ByteArray) : ByteArray := value
def echoPacket (value : Packet) : Packet := value
def echoPackets (values : Array Packet) : Array Packet := values
def echoReading (value : Reading) : Reading := value
def echoReadings (values : Array Reading) : Array Reading := values
def newCounter (value : UInt32) : Counter := ⟨value, "counter"⟩
def readCounter (value : Counter) : UInt32 := value.value
def sameCounter (value : Counter) : Counter := value
def withCallback (value : UInt32) (f : UInt32 → UInt32) : UInt32 := f value + 1
def makeAdder (offset : UInt32) : UInt32 → UInt32 := fun value => value + offset
def keepCallback (callback : UInt32 → UInt32) : UInt32 → UInt32 := callback
def newRunner (value : UInt32) : (UInt32 → UInt32) → UInt32 := fun callback => callback value
def callbackNat (value : Nat) (callback : Nat → Nat) : Nat := callback value
def callbackText (value : String) (callback : String → String) : String := callback value
def withPair (left right : UInt32) (callback : UInt32 → UInt32 → UInt32) : UInt32 := callback left right
def callbackPacket (value : Packet) (callback : Packet → Packet) : Packet := callback value
def callbackPackets (value : Array Packet) (callback : Array Packet → Array Packet) : Array Packet := callback value
def echoScalars (value : Scalars) : Scalars := value
def callUnit (value : Unit) (callback : Unit → Unit) : Unit := callback value
def callBool (value : Bool) (callback : Bool → Bool) : Bool := callback value
def callUInt8 (value : UInt8) (callback : UInt8 → UInt8) : UInt8 := callback value
def callUInt16 (value : UInt16) (callback : UInt16 → UInt16) : UInt16 := callback value
def callUInt32 (value : UInt32) (callback : UInt32 → UInt32) : UInt32 := callback value
def callUInt64 (value : UInt64) (callback : UInt64 → UInt64) : UInt64 := callback value
def callInt8 (value : Int8) (callback : Int8 → Int8) : Int8 := callback value
def callInt16 (value : Int16) (callback : Int16 → Int16) : Int16 := callback value
def callInt32 (value : Int32) (callback : Int32 → Int32) : Int32 := callback value
def callInt64 (value : Int64) (callback : Int64 → Int64) : Int64 := callback value
def callNat (value : Nat) (callback : Nat → Nat) : Nat := callback value
def callInt (value : Int) (callback : Int → Int) : Int := callback value
def callFloat32 (value : Float32) (callback : Float32 → Float32) : Float32 := callback value
def callFloat (value : Float) (callback : Float → Float) : Float := callback value
def callString (value : String) (callback : String → String) : String := callback value
def callBytes (value : ByteArray) (callback : ByteArray → ByteArray) : ByteArray := callback value

theorem add_zero (value : UInt32) : add value 0 = value := by simp [add]

end Workshop
