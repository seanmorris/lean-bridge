from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Ok", "Err", "Result", "GenericNat", "Envelope", "Event", "EventEmpty", "EventBox", "EventChoices", "AliasPair", "Pair", "EnvelopeAlias", "echo_generic_first", "echo_generic_second", "generic_use", "aliases", "array_values", "branch", "combine", "echo", "echo_event", "echo_groups", "echo_pair", "event_choices", "event_empty", "event_first", "event_second", "event_value", "first", "group_values", "inspect_alias_pair", "list_values", "nested", "no_items", "optional", "pair_values", "plain_fin", "produce_envelope", "product", "scalar", "second",)

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

@_dataclass(frozen=True, slots=True)
class GenericNat:
    value: int
    marker: int

@_dataclass(frozen=True, slots=True)
class Envelope:
    payload: int
    digit: int

_Array4 = tuple[Option[Envelope], ...] | list[Option[Envelope]]

_Array5 = tuple[int, ...] | list[int]

_Array8 = tuple[Option[Result[int, int]], ...] | list[Option[Result[int, int]]]

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
    values: _Array8

Event: _TypeAlias = EventEmpty | EventBox | EventChoices

@_dataclass(frozen=True, slots=True)
class AliasPair:
    left: _Array4
    right: _Array4

_Array11 = tuple[int, ...] | list[int]

@_dataclass(frozen=True, slots=True)
class Pair:
    left: Envelope
    right: Envelope

from typing import TypeAlias as _TypeAlias

EnvelopeAlias: _TypeAlias = Envelope
def echo_generic_first(value0: GenericNat) -> GenericNat:
    """Checked Lean Fin bounds: value0.value checked by NominalSubtypes.plusOne; result.value projects the Subtype base value."""
    return _native._call0(value0)

def echo_generic_second(value0: GenericNat) -> GenericNat:
    """Checked Lean Fin bounds: value0.value checked by NominalSubtypes.plusTwo; result.value projects the Subtype base value."""
    return _native._call1(value0)

def generic_use(value0: GenericNat) -> int:
    """Checked Lean Fin bounds: value0.value checked by NominalSubtypes.plusOne."""
    return _native._call2(value0)

def aliases(value0: _Array4, value1: _Array4) -> int:
    """Checked Lean Fin bounds: value0[*]?.payload checked by NominalSubtypes.plusOne; value0[*]?.digit < 3; value1[*]?.payload checked by NominalSubtypes.plusTwo; value1[*]?.digit < 3."""
    return _native._call3(value0, value1)

def array_values(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call4(value0)

def branch(value0: int) -> Result[int, int]:
    """Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value."""
    return _native._call5(value0)

def combine(value0: Envelope, value1: Envelope) -> int:
    """Checked Lean Fin bounds: value0.payload checked by NominalSubtypes.plusOne; value0.digit < 3; value1.payload checked by NominalSubtypes.plusTwo; value1.digit < 3."""
    return _native._call6(value0, value1)

def echo(value0: Envelope) -> Envelope:
    """Checked Lean Fin bounds: value0.payload checked by NominalSubtypes.plusOne; value0.digit < 3; result.payload projects the Subtype base value; result.digit < 3."""
    return _native._call7(value0)

def echo_event(value0: Event) -> Event:
    """Checked Lean Fin bounds: value0.box.value.payload checked by NominalSubtypes.plusOne; value0.box.value.digit < 3; value0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; value0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call8(value0)

def echo_groups(value0: _Array4) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: value0[*]?.payload checked by NominalSubtypes.plusOne; value0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    return _native._call9(value0)

def echo_pair(value0: AliasPair) -> AliasPair:
    """Checked Lean Fin bounds: value0.left[*]?.payload checked by NominalSubtypes.plusOne; value0.left[*]?.digit < 3; value0.right[*]?.payload checked by NominalSubtypes.plusTwo; value0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    return _native._call10(value0)

def event_choices(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call11(value0)

def event_empty(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call12(value0)

def event_first(value0: Event) -> int:
    """Checked Lean Fin bounds: value0.box.value.payload checked by NominalSubtypes.plusOne; value0.box.value.digit < 3; value0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; value0.choices.values[*]?.error checked by NominalSubtypes.plusTwo."""
    return _native._call13(value0)

def event_second(value0: Event) -> int:
    """Checked Lean Fin bounds: value0.box.value.payload checked by NominalSubtypes.plusTwo; value0.box.value.digit < 3; value0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; value0.choices.values[*]?.error checked by NominalSubtypes.plusOne."""
    return _native._call14(value0)

def event_value(value0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call15(value0)

def first(value0: Envelope) -> int:
    """Checked Lean Fin bounds: value0.payload checked by NominalSubtypes.plusOne; value0.digit < 3."""
    return _native._call16(value0)

def group_values(value0: int) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    return _native._call17(value0)

def inspect_alias_pair(value0: AliasPair) -> int:
    """Checked Lean Fin bounds: value0.left[*]?.payload checked by NominalSubtypes.plusOne; value0.left[*]?.digit < 3; value0.right[*]?.payload checked by NominalSubtypes.plusTwo; value0.right[*]?.digit < 3."""
    return _native._call18(value0)

def list_values(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call19(value0)

def nested(value0: Pair) -> int:
    """Checked Lean Fin bounds: value0.left.payload checked by NominalSubtypes.plusOne; value0.left.digit < 3; value0.right.payload checked by NominalSubtypes.plusTwo; value0.right.digit < 3."""
    return _native._call20(value0)

def no_items(value0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call21(value0)

def optional(value0: int) -> Option[int]:
    """Checked Lean Fin bounds: result? projects the Subtype base value."""
    return _native._call22(value0)

def pair_values(value0: int) -> AliasPair:
    """Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    return _native._call23(value0)

def plain_fin(value0: int) -> int:
    """Checked Lean Fin bounds: value0 < 3."""
    return _native._call24(value0)

def produce_envelope(value0: int) -> Envelope:
    """Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3."""
    return _native._call25(value0)

def product(value0: int) -> tuple[int, int]:
    """Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value."""
    return _native._call26(value0)

def scalar(value0: int) -> int:
    """Checked Lean Fin bounds: result projects the Subtype base value."""
    return _native._call27(value0)

def second(value0: Envelope) -> int:
    """Checked Lean Fin bounds: value0.payload checked by NominalSubtypes.plusTwo; value0.digit < 3."""
    return _native._call28(value0)

from . import _native
