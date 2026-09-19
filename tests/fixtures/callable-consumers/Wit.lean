namespace Callables

def mixed (_a : UInt8) (_b : String) (_c : UInt64) (_d : Float) (_e : Int)
    (_f : Nat) (_g : ByteArray) (_h : USize) (value : UInt32) (_j : String)
    (first second : UInt32 → UInt32) : UInt32 := first (second value)

def makeAdder (capture value : UInt32) : UInt32 := capture + value

end Callables
