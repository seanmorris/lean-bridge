namespace Peer

-- The public Ticket owner may disappear while either callback is pending.
-- Mutations before a rejected callback remain observable across packages.
def drive (transform : UInt32 → IO UInt32) (ticket : Shared.Ticket) (twice : Bool) :
    IO (Task (Except IO.Error Shared.Ticket)) :=
  IO.asTask do
    let first ← transform (← ticket.count.get)
    ticket.count.set first
    if twice then ticket.count.set (← transform first)
    return ticket

-- The EIO factory can return a separately owned lease as its typed failure.
def inspect (reject : Bool) (ticket : Shared.Ticket) (transform : UInt32 → IO UInt32) :
    EIO Shared.Ticket (Task (Except IO.Error UInt32)) := do
  if reject then throw ticket
  IO.asTask do transform (← ticket.count.get)

end Peer
