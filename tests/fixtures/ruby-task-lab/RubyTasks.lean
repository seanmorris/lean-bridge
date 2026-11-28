import Pulse

namespace RubyTasks

def rt_unit (v : Unit) : Task Unit := Task.pure v
def rt_bool (v : Bool) : Task Bool := Task.pure v
def rt_uint8 (v : UInt8) : Task UInt8 := Task.pure v
def rt_int8 (v : Int8) : Task Int8 := Task.pure v
def rt_uint16 (v : UInt16) : Task UInt16 := Task.pure v
def rt_int16 (v : Int16) : Task Int16 := Task.pure v
def rt_uint32 (v : UInt32) : Task UInt32 := Task.pure v
def rt_int32 (v : Int32) : Task Int32 := Task.pure v
def rt_uint64 (v : UInt64) : Task UInt64 := Task.pure v
def rt_int64 (v : Int64) : Task Int64 := Task.pure v
def rt_usize (v : USize) : Task USize := Task.pure v
def rt_isize (v : ISize) : Task ISize := Task.pure v
def rt_char (v : Char) : Task Char := Task.pure v
def rt_string (v : String) : Task String := Task.pure v
def rt_bytes (v : ByteArray) : Task ByteArray := Task.pure v
def rt_nat (v : Nat) : Task Nat := Task.pure v
def rt_int (v : Int) : Task Int := Task.pure v
def rt_float32 (v : Float32) : Task Float32 := Task.pure v
def rt_float64 (v : Float) : Task Float := Task.pure v

def direct (reject : Bool) (message : String) : EIO String UInt32 := do
  if reject then throw message
  return 23

def identity (s : String) : String := s
def base (n : UInt64) : BaseIO UInt64 := pure n

def wide (reject : Bool) (n : Int) (bytes : ByteArray) :
    EIO (Except ByteArray Int) (Task (Except ByteArray Int)) := do
  let payload : Except ByteArray Int := if n < 0 then .error bytes else .ok n
  if reject then throw payload
  return Task.pure payload

def terminal (reject : Bool) (n : Int) : BaseIO (Task (Except IO.Error Int)) :=
  BaseIO.asTask do
    if reject then return .error (IO.userError "terminal Ruby task failure")
    return .ok n

end RubyTasks
