namespace Rejections

partial def loop (value : UInt32) : UInt32 := loop value

def viaLoop (value : UInt32) : UInt32 := loop value

def admitted (value : Nat) : Nat := by sorry

def dependent (bound : Nat) (value : Fin bound) : Nat := value.val

def polymorphic {α : Type u} (value : α) : α := value

@[extern "unreviewed_foreign_increment"]
opaque foreignIncrement : UInt32 → UInt32

def viaForeign (value : UInt32) : UInt32 := foreignIncrement value

structure Tiny where
  value : UInt32

def echoTiny (value : Tiny) : Tiny := value

end Rejections
