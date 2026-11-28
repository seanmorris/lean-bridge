prelude
import Init.System.Promise

namespace TaskPeer

@[extern "lean_bridge_task_peer_is_worker"]
opaque isWorker : BaseIO Bool

-- The host must not be able to reproduce the expected value by running
-- the peer inline on the owner after the producer has completed.
@[export lean_bridge_task_peer_map]
def onResult (source : Task UInt32) : BaseIO (Task UInt32) :=
  BaseIO.mapTask (fun n => do
    if ← isWorker then return n + 7
    return 0xdeadbeef) source

end TaskPeer
