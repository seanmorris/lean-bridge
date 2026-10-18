from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Span", "Ticket", "Stamped", "produce", "produce_stamped",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status



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

def produce(arg0: int) -> Ticket:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toSpan projects proof-backed record payload fields; result.word projects the Subtype base value."""
    return _native._call0(arg0)

def produce_stamped(arg0: int) -> Stamped:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.toTicket projects proof-backed record payload fields; result.toTicket.toSpan projects proof-backed record payload fields; result.toTicket.word projects the Subtype base value; result.mark < 8."""
    return _native._call1(arg0)

from . import _native
