from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Ok", "Err", "Result", "Envelope", "Event", "EventEmpty", "EventBox", "EventChoices", "AliasPair", "EnvelopeAlias", "array_values", "branch", "event_choices", "event_empty", "event_value", "group_values", "list_values", "no_items", "optional", "pair_values", "produce_envelope", "product", "scalar",)

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...


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
def array_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    ...

def branch(arg0: int) -> Result[int, int]:
    """Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value."""
    ...

def event_choices(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def event_empty(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def event_value(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def group_values(arg0: int) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    ...

def list_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    ...

def no_items(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    ...

def optional(arg0: int) -> Option[int]:
    """Checked Lean Fin bounds: result? projects the Subtype base value."""
    ...

def pair_values(arg0: int) -> AliasPair:
    """Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    ...

def produce_envelope(arg0: int) -> Envelope:
    """Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3."""
    ...

def product(arg0: int) -> tuple[int, int]:
    """Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value."""
    ...

def scalar(arg0: int) -> int:
    """Checked Lean Fin bounds: result projects the Subtype base value."""
    ...

