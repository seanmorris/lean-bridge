
namespace Workshop
open LeanBridge.Host.Perl
initialize saved : IO.Ref (Option Token) ← IO.mkRef none
def keepToken (t : Token) : IO Unit := saved.set (some t)
def readToken : IO Token := do
  let some t ← saved.get | throw (IO.userError "empty")
  t.identity
def forgetToken : IO Unit := saved.set none
def checkInputs (t : Token) (_other : Box) (_value : UInt8) : IO Token := t.identity
def mixedFault (box : Box) (token : Token) (flag : Bool) : EIO (Except Box Token) Unit :=
  if flag then throw (.ok token) else throw (.error box)
end Workshop
