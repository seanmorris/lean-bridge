import Alpha

namespace LeanLinkSpike.Beta

@[export lean_link_beta_identity]
def identity (box : LeanLinkSpike.Alpha.Box) : LeanLinkSpike.Alpha.Box :=
  box

set_option compiler.ignoreBorrowAnnotation true in
  @[export lean_link_beta_read]
  def read (box : @& LeanLinkSpike.Alpha.Box) : UInt32 :=
    box.value

end LeanLinkSpike.Beta
