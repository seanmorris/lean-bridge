from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Span", "Ticket", "Stamped", "TicketAlias", "aliased", "echo", "first", "nested", "normalized", "pair", "produce", "produce_stamped",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...



@_dataclass(frozen=True, slots=True)
class Span:
    lo: int
    hi: int

@_dataclass(frozen=True, slots=True)
class Ticket:
    to_span: Span
    word: int

@_dataclass(frozen=True, slots=True)
class Stamped:
    to_ticket: Ticket
    mark: int

from typing import TypeAlias as _TypeAlias

TicketAlias: _TypeAlias = Ticket
def aliased(arg0: TicketAlias) -> int:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def echo(arg0: Ticket) -> Ticket:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value."""
    ...

def first(arg0: Ticket) -> int:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord."""
    ...

def nested(arg0: Stamped) -> int:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkStamped; arg0.toTicket checked by InheritedCheckedRecords.mkTicket; arg0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.toTicket.word checked by InheritedCheckedRecords.mkWord; arg0.mark < 8."""
    ...

def normalized(arg0: Ticket) -> int:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.normalizeTicket; arg0.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg0.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def pair(arg0: Ticket, arg1: Ticket) -> int:
    """Checked Lean Fin bounds: arg0 checked by InheritedCheckedRecords.mkTicket; arg0.toSpan checked by InheritedCheckedRecords.mkSpan; arg0.word checked by InheritedCheckedRecords.mkWord; arg1 checked by InheritedCheckedRecords.normalizeTicket; arg1.toSpan checked by InheritedCheckedRecords.normalizeSpan; arg1.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def produce(arg0: int) -> Ticket:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value."""
    ...

def produce_stamped(arg0: int) -> Stamped:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8."""
    ...

