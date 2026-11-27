namespace Owned

def ticketSerial (ticket : Ticket) : UInt32 := ticket.serial

-- Lean reads the callback's actual reply, not the input ticket or a recovery value.
def exchangeTicket (ticket : Ticket) (exchange : Ticket → Ticket) : UInt32 :=
  (exchange ticket).serial

end Owned
