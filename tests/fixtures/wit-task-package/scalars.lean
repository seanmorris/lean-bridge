namespace Meter
def text (value : String) : Task String := Task.pure value
def letter (value : Char) : Task Char := Task.pure value
def small (value : Int8) : Task Int8 := Task.pure value
def narrow (value : Int16) : Task Int16 := Task.pure value
def signed (value : Int32) : Task Int32 := Task.pure value
def byte (value : UInt8) : Task UInt8 := Task.pure value
def short (value : UInt16) : Task UInt16 := Task.pure value
def wide (value : UInt64) : Task UInt64 := Task.pure value
def single (value : Float32) : Task Float32 := Task.pure value
def doublePrecision (value : Float) : Task Float := Task.pure value
end Meter
