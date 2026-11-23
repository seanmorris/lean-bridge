"""Each marked call must be rejected before execution."""
import lease_desk as desk
import lease_depot as depot
import other_desk as foreign


def invalid(ticket: desk.Ticket, badge: depot.Badge, other: foreign.Ticket) -> None:
    depot.count(badge)  # wrong resource kind
    desk.count(other)  # same name, different defining Lean source
    foreign.count(ticket)  # mismatch in the other direction
