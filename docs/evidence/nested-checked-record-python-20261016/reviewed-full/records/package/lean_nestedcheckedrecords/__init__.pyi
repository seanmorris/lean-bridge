from __future__ import annotations
from dataclasses import dataclass as _dataclass

__all__ = ("LeanBridgeError", "Some", "Option", "Ok", "Err", "Result", "Packet", "Choice", "ChoiceEmpty", "ChoicePacket", "Holder", "echo_array", "first", "in_array", "in_choice", "in_except", "in_holder", "in_list", "in_option", "in_product", "pair", "produce_array", "produce_option", "second",)

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
class Packet:
    digit: int
    word: int

_Array2 = tuple[Packet, ...] | list[Packet]

@_dataclass(frozen=True, slots=True)
class ChoiceEmpty:
    kind: _ClassVar[_Literal["empty"]] = "empty"


@_dataclass(frozen=True, slots=True)
class ChoicePacket:
    kind: _ClassVar[_Literal["packet"]] = "packet"
    value: Packet

Choice: _TypeAlias = ChoiceEmpty | ChoicePacket

@_dataclass(frozen=True, slots=True)
class Holder:
    packet: Packet
    tag: int

_Array6 = tuple[Packet, ...] | list[Packet]

def echo_array(value0: _Array2) -> tuple[Packet, ...]:
    """Checked Lean Fin bounds: value0[*] checked by NestedCheckedRecords.mkPacket; value0[*].digit < 10; value0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value."""
    ...

def first(value0: Packet) -> int:
    """Checked Lean Fin bounds: value0 checked by NestedCheckedRecords.mkPacket; value0.digit < 10; value0.word checked by NestedCheckedRecords.mkWord."""
    ...

def in_array(value0: _Array2) -> int:
    """Checked Lean Fin bounds: value0[*] checked by NestedCheckedRecords.mkPacket; value0[*].digit < 10; value0[*].word checked by NestedCheckedRecords.mkWord."""
    ...

def in_choice(value0: Choice) -> int:
    """Checked Lean Fin bounds: value0.packet.value checked by NestedCheckedRecords.mkPacket; value0.packet.value.digit < 10; value0.packet.value.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_except(value0: Result[Packet, Packet]) -> int:
    """Checked Lean Fin bounds: value0.ok checked by NestedCheckedRecords.normalizePacket; value0.ok.digit < 10; value0.ok.word checked by NestedCheckedRecords.mkWord; value0.error checked by NestedCheckedRecords.mkPacket; value0.error.digit < 10; value0.error.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_holder(value0: Holder) -> int:
    """Checked Lean Fin bounds: value0.packet checked by NestedCheckedRecords.normalizePacket; value0.packet.digit < 10; value0.packet.word checked by NestedCheckedRecords.mkWord."""
    ...

def in_list(value0: _Array6) -> int:
    """Checked Lean Fin bounds: value0[*] checked by NestedCheckedRecords.normalizePacket; value0[*].digit < 10; value0[*].word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_option(value0: Option[Packet]) -> int:
    """Checked Lean Fin bounds: value0? checked by NestedCheckedRecords.mkPacket; value0?.digit < 10; value0?.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_product(value0: tuple[Packet, Packet]) -> int:
    """Checked Lean Fin bounds: value0.0 checked by NestedCheckedRecords.mkPacket; value0.0.digit < 10; value0.0.word checked by NestedCheckedRecords.mkWord; value0.1 checked by NestedCheckedRecords.normalizePacket; value0.1.digit < 10; value0.1.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def pair(value0: Packet, value1: Packet) -> int:
    """Checked Lean Fin bounds: value0 checked by NestedCheckedRecords.mkPacket; value0.digit < 10; value0.word checked by NestedCheckedRecords.mkWord; value1 checked by NestedCheckedRecords.normalizePacket; value1.digit < 10; value1.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def produce_array(value0: int) -> tuple[Packet, ...]:
    """Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value."""
    ...

def produce_option(value0: int) -> Option[Packet]:
    """Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value."""
    ...

def second(value0: Packet) -> int:
    """Checked Lean Fin bounds: value0 checked by NestedCheckedRecords.normalizePacket; value0.digit < 10; value0.word checked by NestedCheckedRecords.normalizeWord."""
    ...

