namespace LeanLinkSpike.Alpha

structure Box where
  value : UInt32
  label : String

@[export lean_link_alpha_box]
def box (value : UInt32) : Box :=
  { value, label := "alpha" }

set_option compiler.ignoreBorrowAnnotation true in
  @[export lean_link_alpha_read]
  def read (box : @& Box) : UInt32 :=
    box.value

end LeanLinkSpike.Alpha
