from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Ok", "Err", "Result", "Envelope", "Event", "EventEmpty", "EventBox", "EventChoices", "AliasPair", "EnvelopeAlias", "array_values", "branch", "event_choices", "event_empty", "event_value", "group_values", "list_values", "no_items", "optional", "pair_values", "produce_envelope", "product", "scalar",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


from typing import Generic as _Generic, TypeVar as _TypeVar

_T = _TypeVar("_T", covariant=True)
_E = _TypeVar("_E", covariant=True)

@_dataclass(frozen=True)
class Some(_Generic[_T]):
    value: _T

@_dataclass(frozen=True)
class Ok(_Generic[_T]):
    value: _T

@_dataclass(frozen=True)
class Err(_Generic[_E]):
    value: _E

Option = Some[_T] | None

Result = Ok[_T] | Err[_E]

from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

_Array1 = tuple[int, ...] | list[int]

@_dataclass(frozen=True, slots=True)
class Envelope:
    payload: int
    digit: int

_Array5 = tuple[Option[Result[int, int]], ...] | list[Option[Result[int, int]]]

@_dataclass(frozen=True, slots=True)
class EventEmpty:
    kind: _ClassVar[_Literal["empty"]] = "empty"


@_dataclass(frozen=True, slots=True)
class EventBox:
    kind: _ClassVar[_Literal["box"]] = "box"
    value: Envelope

@_dataclass(frozen=True, slots=True)
class EventChoices:
    kind: _ClassVar[_Literal["choices"]] = "choices"
    values: _Array5

Event: _TypeAlias = EventEmpty | EventBox | EventChoices

_Array8 = tuple[Option[Envelope], ...] | list[Option[Envelope]]

_Array9 = tuple[int, ...] | list[int]

@_dataclass(frozen=True, slots=True)
class AliasPair:
    left: _Array8
    right: _Array8

from typing import TypeAlias as _TypeAlias

EnvelopeAlias: _TypeAlias = Envelope
def array_values(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call0(value0)

def branch(value0: int) -> Result[int, int]:
    """Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value."""
    return _native._call1(value0)

def event_choices(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call2(value0)

def event_empty(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call3(value0)

def event_value(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call4(value0)

def group_values(value0: int) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    return _native._call5(value0)

def list_values(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call6(value0)

def no_items(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call7(value0)

def optional(value0: int) -> Option[int]:
    """Checked Lean Fin bounds: result? projects the Subtype base value."""
    return _native._call8(value0)

def pair_values(value0: int) -> AliasPair:
    """Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    return _native._call9(value0)

def produce_envelope(value0: int) -> Envelope:
    """Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3."""
    return _native._call10(value0)

def product(value0: int) -> tuple[int, int]:
    """Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value."""
    return _native._call11(value0)

def scalar(value0: int) -> int:
    """Checked Lean Fin bounds: result projects the Subtype base value."""
    return _native._call12(value0)

from . import _native
