from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Dependent", "dependent_result",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status



@_dataclass(frozen=True, slots=True)
class Dependent:
    bound: int
    below: int

def dependent_result(arg0: int) -> Dependent:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound."""
    return _native._call0(arg0)

from . import _native
