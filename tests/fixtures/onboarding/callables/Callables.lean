namespace Callables

def callUnit (value : Unit) (callback : Unit → Unit) : Unit := callback value
def twiceUnit (value : Unit) (callback : Unit → Unit) : Unit := callback (callback value)
def makeUnit (captured : Unit) : Bool → Unit → Unit := fun useCaptured value => if useCaptured then captured else value
theorem callUnit_identity (value : Unit) : callUnit value id = value := rfl

def callBool (value : Bool) (callback : Bool → Bool) : Bool := callback value
def twiceBool (value : Bool) (callback : Bool → Bool) : Bool := callback (callback value)
def makeBool (captured : Bool) : Bool → Bool → Bool := fun useCaptured value => if useCaptured then captured else value
theorem callBool_identity (value : Bool) : callBool value id = value := rfl

def callUInt8 (value : UInt8) (callback : UInt8 → UInt8) : UInt8 := callback value
def twiceUInt8 (value : UInt8) (callback : UInt8 → UInt8) : UInt8 := callback (callback value)
def makeUInt8 (captured : UInt8) : Bool → UInt8 → UInt8 := fun useCaptured value => if useCaptured then captured else value
theorem callUInt8_identity (value : UInt8) : callUInt8 value id = value := rfl

def callUInt16 (value : UInt16) (callback : UInt16 → UInt16) : UInt16 := callback value
def twiceUInt16 (value : UInt16) (callback : UInt16 → UInt16) : UInt16 := callback (callback value)
def makeUInt16 (captured : UInt16) : Bool → UInt16 → UInt16 := fun useCaptured value => if useCaptured then captured else value
theorem callUInt16_identity (value : UInt16) : callUInt16 value id = value := rfl

def callUInt32 (value : UInt32) (callback : UInt32 → UInt32) : UInt32 := callback value
def twiceUInt32 (value : UInt32) (callback : UInt32 → UInt32) : UInt32 := callback (callback value)
def makeUInt32 (captured : UInt32) : Bool → UInt32 → UInt32 := fun useCaptured value => if useCaptured then captured else value
theorem callUInt32_identity (value : UInt32) : callUInt32 value id = value := rfl

def callUInt64 (value : UInt64) (callback : UInt64 → UInt64) : UInt64 := callback value
def twiceUInt64 (value : UInt64) (callback : UInt64 → UInt64) : UInt64 := callback (callback value)
def makeUInt64 (captured : UInt64) : Bool → UInt64 → UInt64 := fun useCaptured value => if useCaptured then captured else value
theorem callUInt64_identity (value : UInt64) : callUInt64 value id = value := rfl

def callInt8 (value : Int8) (callback : Int8 → Int8) : Int8 := callback value
def twiceInt8 (value : Int8) (callback : Int8 → Int8) : Int8 := callback (callback value)
def makeInt8 (captured : Int8) : Bool → Int8 → Int8 := fun useCaptured value => if useCaptured then captured else value
theorem callInt8_identity (value : Int8) : callInt8 value id = value := rfl

def callInt16 (value : Int16) (callback : Int16 → Int16) : Int16 := callback value
def twiceInt16 (value : Int16) (callback : Int16 → Int16) : Int16 := callback (callback value)
def makeInt16 (captured : Int16) : Bool → Int16 → Int16 := fun useCaptured value => if useCaptured then captured else value
theorem callInt16_identity (value : Int16) : callInt16 value id = value := rfl

def callInt32 (value : Int32) (callback : Int32 → Int32) : Int32 := callback value
def twiceInt32 (value : Int32) (callback : Int32 → Int32) : Int32 := callback (callback value)
def makeInt32 (captured : Int32) : Bool → Int32 → Int32 := fun useCaptured value => if useCaptured then captured else value
theorem callInt32_identity (value : Int32) : callInt32 value id = value := rfl

def callInt64 (value : Int64) (callback : Int64 → Int64) : Int64 := callback value
def twiceInt64 (value : Int64) (callback : Int64 → Int64) : Int64 := callback (callback value)
def makeInt64 (captured : Int64) : Bool → Int64 → Int64 := fun useCaptured value => if useCaptured then captured else value
theorem callInt64_identity (value : Int64) : callInt64 value id = value := rfl

def callNat (value : Nat) (callback : Nat → Nat) : Nat := callback value
def twiceNat (value : Nat) (callback : Nat → Nat) : Nat := callback (callback value)
def makeNat (captured : Nat) : Bool → Nat → Nat := fun useCaptured value => if useCaptured then captured else value
theorem callNat_identity (value : Nat) : callNat value id = value := rfl

def callInt (value : Int) (callback : Int → Int) : Int := callback value
def twiceInt (value : Int) (callback : Int → Int) : Int := callback (callback value)
def makeInt (captured : Int) : Bool → Int → Int := fun useCaptured value => if useCaptured then captured else value
theorem callInt_identity (value : Int) : callInt value id = value := rfl

def callFloat32 (value : Float32) (callback : Float32 → Float32) : Float32 := callback value
def twiceFloat32 (value : Float32) (callback : Float32 → Float32) : Float32 := callback (callback value)
def makeFloat32 (captured : Float32) : Bool → Float32 → Float32 := fun useCaptured value => if useCaptured then captured else value
theorem callFloat32_identity (value : Float32) : callFloat32 value id = value := rfl

def callFloat (value : Float) (callback : Float → Float) : Float := callback value
def twiceFloat (value : Float) (callback : Float → Float) : Float := callback (callback value)
def makeFloat (captured : Float) : Bool → Float → Float := fun useCaptured value => if useCaptured then captured else value
theorem callFloat_identity (value : Float) : callFloat value id = value := rfl

def callString (value : String) (callback : String → String) : String := callback value
def twiceString (value : String) (callback : String → String) : String := callback (callback value)
def makeString (captured : String) : Bool → String → String := fun useCaptured value => if useCaptured then captured else value
theorem callString_identity (value : String) : callString value id = value := rfl

def callBytes (value : ByteArray) (callback : ByteArray → ByteArray) : ByteArray := callback value
def twiceBytes (value : ByteArray) (callback : ByteArray → ByteArray) : ByteArray := callback (callback value)
def makeBytes (captured : ByteArray) : Bool → ByteArray → ByteArray := fun useCaptured value => if useCaptured then captured else value
theorem callBytes_identity (value : ByteArray) : callBytes value id = value := rfl

def callChar (value : Char) (callback : Char → Char) : Char := callback value
def twiceChar (value : Char) (callback : Char → Char) : Char := callback (callback value)
def makeChar (captured : Char) : Bool → Char → Char := fun useCaptured value => if useCaptured then captured else value
theorem callChar_identity (value : Char) : callChar value id = value := rfl

def callUSize (value : USize) (callback : USize → USize) : USize := callback value
def twiceUSize (value : USize) (callback : USize → USize) : USize := callback (callback value)
def makeUSize (captured : USize) : Bool → USize → USize := fun useCaptured value => if useCaptured then captured else value
theorem callUSize_identity (value : USize) : callUSize value id = value := rfl

def callISize (value : ISize) (callback : ISize → ISize) : ISize := callback value
def twiceISize (value : ISize) (callback : ISize → ISize) : ISize := callback (callback value)
def makeISize (captured : ISize) : Bool → ISize → ISize := fun useCaptured value => if useCaptured then captured else value
theorem callISize_identity (value : ISize) : callISize value id = value := rfl

def wordBits : UInt32 := System.Platform.numBits.toUInt32
end Callables
