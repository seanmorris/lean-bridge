prelude
import Reader

namespace Parked

def openRead (offset : UInt32) : IO Reader.Cursor := Reader.openCursor offset
def takeRead (c : Reader.Cursor) : BaseIO (Task (Except UInt16 (Option UInt32))) := Reader.next c
def closeRead (c : Reader.Cursor) : BaseIO Unit := Reader.close c
def readPulls : IO UInt32 := Reader.pulls
def readCloses : IO UInt32 := Reader.closes
def releaseRead (n : UInt32) : IO Unit := Reader.release n
def finishedRead : BaseIO (Task UInt32) := Reader.finished
def readySibling (n : UInt32) : Task UInt32 := Reader.sibling n

-- Dispatch into PHP only after the actual pull (not the caller) signals entry.
def onRead (f : UInt32 → IO UInt32) : BaseIO (Task (Except IO.Error UInt32)) := do
  IO.mapTask f (← Reader.entered)

end Parked
