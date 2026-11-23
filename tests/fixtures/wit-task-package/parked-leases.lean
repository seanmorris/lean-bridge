namespace Depot

-- Completion is observable even after the host drops the task. It records the
-- count read by the actual worker; no sleeps or synthetic host results.
initialize completed : IO.Ref (Option (IO.Promise UInt32)) ← IO.mkRef none

def parked (t : Shared.Ticket) : BaseIO (Task Shared.Ticket) := do
  let start ← IO.Promise.new
  let done ← IO.Promise.new
  gate.set (some start)
  completed.set (some done)
  BaseIO.asTask do
    if let some delta ← IO.wait start.result? then t.count.modify (· + delta)
    done.resolve (← t.count.get)
    return t

def unlock (delta : UInt32) : BaseIO (Task Bool) := do
  if let some start ← gate.get then
    start.resolve delta
    gate.set none
    return Task.pure true
  return Task.pure false

def witness : BaseIO (Task UInt32) := do
  if let some done ← completed.get then
    return done.result?.map (fun value => value.getD 0)
  return Task.pure 0

def combined (left right : Shared.Ticket) : BaseIO (Task UInt32) := do
  return Task.pure ((← left.count.get) + (← right.count.get))

end Depot
