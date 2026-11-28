namespace Effects

-- Importing the component runs this even when only the iterator is exported.
initialize boot : IO.Ref String ← do
  IO.mkRef ((← IO.getEnv "LEAN_BRIDGE_EFFECT_BOOT").getD "unset")

def readBoot : IO String := boot.get

def observe (path : String) : IO UInt32 := do
  return if (← IO.FS.readFile path) == "open" then 37 else 0

def worker (path : String) : BaseIO (Task UInt32) := BaseIO.asTask do
  return (← (observe path).toBaseIO).toOption.getD 0

structure Cursor where
  path : String

def walk (path : String) : BaseIO Cursor := pure ⟨path⟩
def pull (c : Cursor) : BaseIO (Task (Option UInt32)) := BaseIO.asTask do
  return (← (observe c.path).toBaseIO).toOption
def close (c : Cursor) : BaseIO Unit := do
  let _ ← (IO.FS.writeFile c.path "closed").toBaseIO

-- Never invoked by the fixture or permitted by the policy.
def changeDirectory (path : String) : IO Unit := IO.Process.setCurrentDir path

end Effects
