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

def echo_array(arg0: _Array2) -> tuple[Packet, ...]:
    """Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord; result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value."""
    ...

def first(arg0: Packet) -> int:
    """Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord."""
    ...

def in_array(arg0: _Array2) -> int:
    """Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.mkPacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.mkWord."""
    ...

def in_choice(arg0: Choice) -> int:
    """Checked Lean Fin bounds: arg0.packet.value checked by NestedCheckedRecords.mkPacket; arg0.packet.value.digit < 10; arg0.packet.value.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_except(arg0: Result[Packet, Packet]) -> int:
    """Checked Lean Fin bounds: arg0.ok checked by NestedCheckedRecords.normalizePacket; arg0.ok.digit < 10; arg0.ok.word checked by NestedCheckedRecords.mkWord; arg0.error checked by NestedCheckedRecords.mkPacket; arg0.error.digit < 10; arg0.error.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_holder(arg0: Holder) -> int:
    """Checked Lean Fin bounds: arg0.packet checked by NestedCheckedRecords.normalizePacket; arg0.packet.digit < 10; arg0.packet.word checked by NestedCheckedRecords.mkWord."""
    ...

def in_list(arg0: _Array6) -> int:
    """Checked Lean Fin bounds: arg0[*] checked by NestedCheckedRecords.normalizePacket; arg0[*].digit < 10; arg0[*].word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_option(arg0: Option[Packet]) -> int:
    """Checked Lean Fin bounds: arg0? checked by NestedCheckedRecords.mkPacket; arg0?.digit < 10; arg0?.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def in_product(arg0: tuple[Packet, Packet]) -> int:
    """Checked Lean Fin bounds: arg0.0 checked by NestedCheckedRecords.mkPacket; arg0.0.digit < 10; arg0.0.word checked by NestedCheckedRecords.mkWord; arg0.1 checked by NestedCheckedRecords.normalizePacket; arg0.1.digit < 10; arg0.1.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def pair(arg0: Packet, arg1: Packet) -> int:
    """Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.mkPacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.mkWord; arg1 checked by NestedCheckedRecords.normalizePacket; arg1.digit < 10; arg1.word checked by NestedCheckedRecords.normalizeWord."""
    ...

def produce_array(arg0: int) -> tuple[Packet, ...]:
    """Checked Lean Fin bounds: result[*] projects proof-backed record payload fields; result[*].digit < 10; result[*].word projects the Subtype base value."""
    ...

def produce_option(arg0: int) -> Option[Packet]:
    """Checked Lean Fin bounds: result? projects proof-backed record payload fields; result?.digit < 10; result?.word projects the Subtype base value."""
    ...

def second(arg0: Packet) -> int:
    """Checked Lean Fin bounds: arg0 checked by NestedCheckedRecords.normalizePacket; arg0.digit < 10; arg0.word checked by NestedCheckedRecords.normalizeWord."""
    ...

