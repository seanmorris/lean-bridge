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
def echo_generic_first(arg0: GenericNat) -> GenericNat:
    """Checked Lean Fin bounds: arg0.value checked by NominalSubtypes.plusOne; result.value projects the Subtype base value."""
    return _native._call0(arg0)

def echo_generic_second(arg0: GenericNat) -> GenericNat:
    """Checked Lean Fin bounds: arg0.value checked by NominalSubtypes.plusTwo; result.value projects the Subtype base value."""
    return _native._call1(arg0)

def generic_use(arg0: GenericNat) -> int:
    """Checked Lean Fin bounds: arg0.value checked by NominalSubtypes.plusOne."""
    return _native._call2(arg0)

def aliases(arg0: _Array4, arg1: _Array4) -> int:
    """Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; arg1[*]?.payload checked by NominalSubtypes.plusTwo; arg1[*]?.digit < 3."""
    return _native._call3(arg0, arg1)

def array_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call4(arg0)

def branch(arg0: int) -> Result[int, int]:
    """Checked Lean Fin bounds: result.ok projects the Subtype base value; result.error projects the Subtype base value."""
    return _native._call5(arg0)

def combine(arg0: Envelope, arg1: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; arg1.payload checked by NominalSubtypes.plusTwo; arg1.digit < 3."""
    return _native._call6(arg0, arg1)

def echo(arg0: Envelope) -> Envelope:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3; result.payload projects the Subtype base value; result.digit < 3."""
    return _native._call7(arg0)

def echo_event(arg0: Event) -> Event:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo; result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call8(arg0)

def echo_groups(arg0: _Array4) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: arg0[*]?.payload checked by NominalSubtypes.plusOne; arg0[*]?.digit < 3; result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    return _native._call9(arg0)

def echo_pair(arg0: AliasPair) -> AliasPair:
    """Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3; result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    return _native._call10(arg0)

def event_choices(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call11(arg0)

def event_empty(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call12(arg0)

def event_first(arg0: Event) -> int:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusOne; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusOne; arg0.choices.values[*]?.error checked by NominalSubtypes.plusTwo."""
    return _native._call13(arg0)

def event_second(arg0: Event) -> int:
    """Checked Lean Fin bounds: arg0.box.value.payload checked by NominalSubtypes.plusTwo; arg0.box.value.digit < 3; arg0.choices.values[*]?.ok checked by NominalSubtypes.plusTwo; arg0.choices.values[*]?.error checked by NominalSubtypes.plusOne."""
    return _native._call14(arg0)

def event_value(arg0: int) -> Event:
    """Checked Lean Fin bounds: result.box.value.payload projects the Subtype base value; result.box.value.digit < 3; result.choices.values[*]?.ok projects the Subtype base value; result.choices.values[*]?.error projects the Subtype base value."""
    return _native._call15(arg0)

def first(arg0: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusOne; arg0.digit < 3."""
    return _native._call16(arg0)

def group_values(arg0: int) -> tuple[Option[Envelope], ...]:
    """Checked Lean Fin bounds: result[*]?.payload projects the Subtype base value; result[*]?.digit < 3."""
    return _native._call17(arg0)

def inspect_alias_pair(arg0: AliasPair) -> int:
    """Checked Lean Fin bounds: arg0.left[*]?.payload checked by NominalSubtypes.plusOne; arg0.left[*]?.digit < 3; arg0.right[*]?.payload checked by NominalSubtypes.plusTwo; arg0.right[*]?.digit < 3."""
    return _native._call18(arg0)

def list_values(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call19(arg0)

def nested(arg0: Pair) -> int:
    """Checked Lean Fin bounds: arg0.left.payload checked by NominalSubtypes.plusOne; arg0.left.digit < 3; arg0.right.payload checked by NominalSubtypes.plusTwo; arg0.right.digit < 3."""
    return _native._call20(arg0)

def no_items(arg0: int) -> tuple[int, ...]:
    """Checked Lean Fin bounds: result[*] projects the Subtype base value."""
    return _native._call21(arg0)

def optional(arg0: int) -> Option[int]:
    """Checked Lean Fin bounds: result? projects the Subtype base value."""
    return _native._call22(arg0)

def pair_values(arg0: int) -> AliasPair:
    """Checked Lean Fin bounds: result.left[*]?.payload projects the Subtype base value; result.left[*]?.digit < 3; result.right[*]?.payload projects the Subtype base value; result.right[*]?.digit < 3."""
    return _native._call23(arg0)

def plain_fin(arg0: int) -> int:
    """Checked Lean Fin bounds: arg0 < 3."""
    return _native._call24(arg0)

def produce_envelope(arg0: int) -> Envelope:
    """Checked Lean Fin bounds: result.payload projects the Subtype base value; result.digit < 3."""
    return _native._call25(arg0)

def product(arg0: int) -> tuple[int, int]:
    """Checked Lean Fin bounds: result.0 projects the Subtype base value; result.1 projects the Subtype base value."""
    return _native._call26(arg0)

def scalar(arg0: int) -> int:
    """Checked Lean Fin bounds: result projects the Subtype base value."""
    return _native._call27(arg0)

def second(arg0: Envelope) -> int:
    """Checked Lean Fin bounds: arg0.payload checked by NominalSubtypes.plusTwo; arg0.digit < 3."""
    return _native._call28(arg0)

from . import _native
