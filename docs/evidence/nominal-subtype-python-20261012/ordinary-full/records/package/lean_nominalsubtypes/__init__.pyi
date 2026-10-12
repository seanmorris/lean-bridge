from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Ok", "Err", "Result", "Envelope", "Event", "EventEmpty", "EventBox", "EventChoices", "AliasPair", "Pair", "EnvelopeAlias", "aliases", "array_values", "branch", "combine", "echo", "echo_event", "echo_groups", "echo_pair", "event_choices", "event_empty", "event_first", "event_second", "event_value", "first", "group_values", "inspect_alias_pair", "list_values", "nested", "no_items", "optional", "pair_values", "plain_fin", "produce_envelope", "product", "scalar", "second",)

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

@_dataclass(frozen=True, slots=True)
class Envelope:
    payload: int
    digit: int

_Array3 = tuple[Option[Envelope], ...] | list[Option[Envelope]]

_Array4 = tuple[int, ...] | list[int]

_Array7 = tuple[Option[Result[int, int]], ...] | list[Option[Result[int, int]]]

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
    values: _Array7

Event: _TypeAlias = EventEmpty | EventBox | EventChoices

@_dataclass(frozen=True, slots=True)
class AliasPair:
    left: _Array3
    right: _Array3

_Array10 = tuple[int, ...] | list[int]

@_dataclass(frozen=True, slots=True)
class Pair:
    left: Envelope
    right: Envelope

from typing import TypeAlias as _TypeAlias

EnvelopeAlias: _TypeAlias = Envelope
def aliases(arg0: _Array3, arg1: _Array3) -> int:
    """Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3."""
    ...

def array_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    ...

def branch(arg0: int) -> Result[int, int]:
    """Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value."""
    ...

def combine(arg0: Envelope, arg1: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3."""
    ...

def echo(arg0: Envelope) -> Envelope:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3."""
    ...

def echo_event(arg0: Event) -> Event:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def echo_groups(arg0: _Array3) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    ...

def echo_pair(arg0: AliasPair) -> AliasPair:
    """Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    ...

def event_choices(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def event_empty(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def event_first(arg0: Event) -> int:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo."""
    ...

def event_second(arg0: Event) -> int:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne."""
    ...

def event_value(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    ...

def first(arg0: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3."""
    ...

def group_values(arg0: int) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    ...

def inspect_alias_pair(arg0: AliasPair) -> int:
    """Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3."""
    ...

def list_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    ...

def nested(arg0: Pair) -> int:
    """Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3."""
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

def plain_fin(arg0: int) -> int:
    """Checked Lean Fin bounds: arg0 < 3."""
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

def second(arg0: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3."""
    ...

