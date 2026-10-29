namespace HostNullDemo

universe u

inductive HostNull (α : Type u) where
  | null
  | value (value : α)

structure Packet where
  direct : HostNull UInt32
  nullableOption : HostNull (Option UInt32)
  optionalNullable : Option (HostNull UInt32)

def echo (value : HostNull UInt32) : HostNull UInt32 := value

def nullableOption (value : HostNull (Option UInt32)) : HostNull (Option UInt32) := value

def optionalNullable (value : Option (HostNull UInt32)) : Option (HostNull UInt32) := value

def packet (value : Packet) : Packet := value

def callHost (value : HostNull UInt32)
    (callback : HostNull UInt32 → HostNull (Option UInt32)) : HostNull (Option UInt32) :=
  callback value

def makeClosure (captured : HostNull (Option UInt32)) :
    HostNull UInt32 → HostNull (Option UInt32) :=
  fun _ => captured

end HostNullDemo
