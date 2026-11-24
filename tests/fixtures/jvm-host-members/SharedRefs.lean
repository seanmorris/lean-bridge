import LeanBridge.Host.Jvm
open LeanBridge.Host.Jvm

@[export lb_compare_wrappers]
unsafe def compareWrappers (a b : Box) : IO Bool := pure (ptrEq a b)

@[export lb_box_self]
def boxSelf (box : Box) : IO Box := box.identity

@[export lb_key_self]
def keySelf (key : Key) : IO Key := key.identity
