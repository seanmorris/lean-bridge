namespace TicketPulls

structure Ticket where
  value : IO.Ref UInt32
  serial : UInt32

structure Walk where
  ticket : Ticket
  seen : IO.Ref Bool

initialize closes : IO.Ref UInt32 ← IO.mkRef 0

def closedTickets : BaseIO UInt32 := closes.get
def issue (n : UInt32) : BaseIO Ticket := do return ⟨← IO.mkRef 0, n⟩
def readTicket (t : Ticket) : BaseIO UInt32 := do return t.serial + (← t.value.get)
def tickets (t : Ticket) : BaseIO Walk := do return ⟨t, ← IO.mkRef false⟩

def nextTicket (s : Walk) : EIO Ticket (Option Ticket) := do
  if ← s.seen.get then throw s.ticket
  s.seen.set true
  return some s.ticket

def closeTicket (_ : Walk) : BaseIO Unit := closes.modify (· + 1)

end TicketPulls
