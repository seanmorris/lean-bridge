import Journal

namespace RubyIO

def rt_unit (v : Unit) : BaseIO Unit := pure v
def rt_bool (v : Bool) : BaseIO Bool := pure v
def rt_uint8 (v : UInt8) : BaseIO UInt8 := pure v
def rt_int8 (v : Int8) : BaseIO Int8 := pure v
def rt_uint16 (v : UInt16) : BaseIO UInt16 := pure v
def rt_int16 (v : Int16) : BaseIO Int16 := pure v
def rt_uint32 (v : UInt32) : BaseIO UInt32 := pure v
def rt_int32 (v : Int32) : BaseIO Int32 := pure v
def rt_uint64 (v : UInt64) : BaseIO UInt64 := pure v
def rt_int64 (v : Int64) : BaseIO Int64 := pure v
def rt_usize (v : USize) : BaseIO USize := pure v
def rt_isize (v : ISize) : BaseIO ISize := pure v
def rt_char (v : Char) : BaseIO Char := pure v
def rt_float32 (v : Float32) : BaseIO Float32 := pure v
def rt_float64 (v : Float) : BaseIO Float := pure v
def rt_string (v : String) : BaseIO String := pure v
def rt_bytes (v : ByteArray) : BaseIO ByteArray := pure v
def rt_nat (v : Nat) : BaseIO Nat := pure v
def rt_int (v : Int) : BaseIO Int := pure v

def nested (reject : Bool) (tag : UInt8) (n : Int) (text : String) (bytes : ByteArray) :
    EIO (Except (Except ByteArray Int) String) (Except (Except ByteArray Int) String) := do
  let value : Except (Except ByteArray Int) String :=
    if tag == 0 then .ok text else if tag == 1 then .error (.ok n) else .error (.error bytes)
  if reject then throw value else return value

end RubyIO
