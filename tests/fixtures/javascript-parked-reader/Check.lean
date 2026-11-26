import Reader

-- This tests the producer, not JavaScript cancellation or the Wasm scheduler.
def main : IO Unit := do
  let cursor ← Reader.openCursor 2
  unless (← Reader.pulls) == 0 do throw (IO.userError "opening pulled an item")
  let pull ← Reader.next cursor
  let entry ← Reader.entered
  unless (← IO.wait entry) == 1 do throw (IO.userError "worker did not enter")
  if ← IO.hasFinished pull then throw (IO.userError "worker was not parked")
  unless (← Reader.pulls) == 1 && (← Reader.closes) == 0 do
    throw (IO.userError "incorrect pull or close count")
  let late ← Reader.finished
  if ← IO.hasFinished late then throw (IO.userError "result arrived before release")
  Reader.release 71
  match ← IO.wait pull with
  | .ok (some 73) => pure ()
  | _ => throw (IO.userError "wrong item after release")
  unless (← IO.wait late) == 73 do throw (IO.userError "wrong completion signal")
  Reader.close cursor
  unless (← Reader.closes) == 1 do throw (IO.userError "missing finalizer")
  IO.println "Lean reader: entered, parked, released 71, returned 73, finalized once"
