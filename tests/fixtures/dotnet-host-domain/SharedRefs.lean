import LeanBridge.Host.Dotnet
open LeanBridge.Host.Dotnet

@[export lb_same]
unsafe def sameObject (a b : Box) : IO Bool := pure (ptrEq a b)

@[export lb_self]
def selfObject (box : Box) : IO Box := box.identity

@[export lb_key]
def selfKey (key : Key) : IO Key := key.identity

@[export lb_child]
def getChild (box : Box) : IO Box := box.child

@[export lb_factory]
def construct : IO Box := do
  let box ← Box.create 31
  box.setLevel ((← box.getLevel) + 11)
  unless (← box.read) == 42 do throw (IO.userError "mutable CLR property")
  box.identity
