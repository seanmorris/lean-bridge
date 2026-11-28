import LeanBridge.Host.Python

open LeanBridge.Host.Python

private def check (p : Bool) (why : String) : IO Unit :=
  unless p do throw (IO.userError why)

private def exercise : IO Unit := do
  let box ← Box.box 42
  let alias ← box.identity
  let other ← Box.box 42
  check (← box.sameAs alias) "the host did not receive the same instance"
  check (!(← box.sameAs other)) "distinct host instances compared identical"
  check ((← alias.read) == 42) "read method"
  check ((← Box.live) == 2) "unexpected number of live Python objects"
  alias.setLevel 81
  check ((← box.getLevel) == 81) "write through an alias"
  check ((← box.scale (0.25 : Float32)) == (20.25 : Float32)) "floating-point ABI"
  let message ← try
    box.setLevel 999
    pure "setter did not reject"
  catch e => pure e.toString
  check (message == "outside the host range") "Python property failure did not reach Lean"
  check ((← box.getLevel) == 81) "failed write changed the host object"
  check ((← other.finish) == 42) "consumed receiver"
  check ((← alias.finish) == 81) "consumed alias"
  check ((← box.read) == 81) "consumption released someone else's reference"

def main : IO Unit := do
  exercise
  check ((← Box.live) == 0) "host objects remained after the Lean call"
  IO.println "host-owned Python members, identity, errors and cleanup passed"
