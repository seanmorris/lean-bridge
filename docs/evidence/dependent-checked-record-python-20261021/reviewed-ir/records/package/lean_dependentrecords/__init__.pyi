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

def dependent_result(value0: int) -> Dependent:
    """Checked Lean Fin bounds: result projects proof-backed record payload fields; result.below < result.bound."""
    ...

def dependent_roundtrip(value0: Dependent) -> Dependent:
    """Checked Lean Fin bounds: value0 checked by DependentRecords.mkDependent; value0.below < value0.bound; result projects proof-backed record payload fields; result.below < result.bound."""
    ...

def dependent_total(value0: Dependent) -> int:
    """Checked Lean Fin bounds: value0 checked by DependentRecords.mkDependent; value0.below < value0.bound."""
    ...

