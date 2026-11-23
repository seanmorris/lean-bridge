prelude
import Init.System.Promise

namespace ThreadProbe

-- Exercise both corrected extern calls in the module's private Wasm filesystem.
@[export lean_bridge_probe_temp_io]
def tempIO : IO Unit := do
  let dir ← IO.FS.createTempDir
  try
    let (_, path) ← IO.FS.createTempFile
    IO.FS.removeFile path
  finally
    IO.FS.removeDir dir

@[export lean_bridge_probe_gate]
def gate : BaseIO (IO.Promise UInt32) := IO.Promise.new

@[export lean_bridge_probe_signal]
def signal (p : IO.Promise UInt32) (v : UInt32) : BaseIO Unit := p.resolve v

@[export lean_bridge_probe_watch]
def watch (p : IO.Promise UInt32) : Task (Option UInt32) := p.result?

@[export lean_bridge_probe_start]
def start (waitFor entered : IO.Promise UInt32) (cooperative : Bool) : BaseIO (Task UInt32) :=
  BaseIO.asTask do
    entered.resolve 1
    let value ← IO.wait waitFor.result?
    let cancelled ← IO.checkCanceled
    return if cooperative && cancelled then 1001 else value.getD 0 + 3

end ThreadProbe
