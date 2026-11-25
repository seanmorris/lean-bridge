
namespace Closures
open LeanBridge.Host.Jvm

def supplier (x : Box) : IO (Unit → IO Box) :=
  pure fun _ => x.identity
def consumer (x : Box) : IO (UInt32 → IO Unit) :=
  pure fun n => x.setLevel n
def action (x : Box) : IO (Unit → IO Unit) :=
  pure fun _ => do let _ ← x.read

end Closures
