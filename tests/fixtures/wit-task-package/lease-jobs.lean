namespace Depot
def issue (n : UInt32) : IO (Task Shared.Ticket) := do
  return Task.pure (← make n)
def tag (n : UInt32) : IO (Task Shared.Badge) := do
  return Task.pure (← badge n)
def view (t : Shared.Ticket) : BaseIO (Task UInt32) := do
  return Task.pure (← t.count.get)
end Depot
