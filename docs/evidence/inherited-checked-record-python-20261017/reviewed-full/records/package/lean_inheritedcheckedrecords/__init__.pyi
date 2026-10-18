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
def aliased(value0: TicketAlias) -> int:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; value0.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def echo(value0: Ticket) -> Ticket:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.normalizeTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.normalizeWord; result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value."""
    ...

def first(value0: Ticket) -> int:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.mkWord."""
    ...

def nested(value0: Stamped) -> int:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkStamped; value0.toTicket checked by InheritedCheckedRecords.mkTicket; value0.toTicket.toSpan checked by InheritedCheckedRecords.mkSpan; value0.toTicket.word checked by InheritedCheckedRecords.mkWord; value0.mark < 8."""
    ...

def normalized(value0: Ticket) -> int:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.normalizeTicket; value0.toSpan checked by InheritedCheckedRecords.normalizeSpan; value0.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def pair(value0: Ticket, value1: Ticket) -> int:
    """Checked Lean Fin bounds: value0 checked by InheritedCheckedRecords.mkTicket; value0.toSpan checked by InheritedCheckedRecords.mkSpan; value0.word checked by InheritedCheckedRecords.mkWord; value1 checked by InheritedCheckedRecords.normalizeTicket; value1.toSpan checked by InheritedCheckedRecords.normalizeSpan; value1.word checked by InheritedCheckedRecords.normalizeWord."""
    ...

def produce(value0: int) -> Ticket:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value."""
    ...

def produce_stamped(value0: int) -> Stamped:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8."""
    ...

