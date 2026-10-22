from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Dependent", "dependent_result", "dependent_roundtrip", "dependent_total",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...



@_dataclass(frozen=True, slots=True)
class Dependent:
    bound: int
    below: int

def dependent_result(arg0: int) -> Dependent:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound."""
    ...

def dependent_roundtrip(arg0: Dependent) -> Dependent:
    """Checked Lean Fin bounds: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound; result projects proof-backed record payload fields; result.below < result.bound."""
    ...

def dependent_total(arg0: Dependent) -> int:
    """Checked Lean Fin bounds: arg0 checked by DependentRecords.mkDependent; arg0.below < arg0.bound."""
    ...

