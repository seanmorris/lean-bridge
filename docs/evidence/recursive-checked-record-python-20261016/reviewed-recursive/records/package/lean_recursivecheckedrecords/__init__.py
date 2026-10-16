from __future__ import annotations
from dataclasses import dataclass as _dataclass
from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

try:
    from typing import TypeAliasType as _TypeAliasType
except ImportError:
    from typing_extensions import TypeAliasType as _TypeAliasType

__all__ = ("LeanBridgeError", "Some", "Option", "Packet", "PacketAlias", "echo", "echo_groups", "first", "groups", "produce", "second",)

from typing import Generic as _Generic, TypeVar as _TypeVar

_T = _TypeVar("_T", covariant=True)
_E = _TypeVar("_E", covariant=True)

@_dataclass(frozen=True)
class Some(_Generic[_T]):
    value: _T

Option = Some[_T] | None


@_dataclass(frozen=True, slots=True)
class Packet:
    value: int
    digit: int
    tail: _Input1

_Value1 = _TypeAliasType("_Value1", Option[Packet])
_Input1 = _TypeAliasType("_Input1", Option[Packet])
_Value0 = _TypeAliasType("_Value0", tuple[_Value1, ...])
_Input0 = _TypeAliasType("_Input0", tuple[_Input1, ...] | list[_Input1])
PacketAlias: _TypeAlias = Packet

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status

def echo(value0: Packet) -> Packet:
    return _GraphNative._call0(value0)

def echo_groups(value0: _Input0) -> _Value0:
    return _GraphNative._call1(value0)

def first(value0: Packet) -> int:
    return _GraphNative._call2(value0)

def groups(value0: _Input0) -> int:
    return _GraphNative._call3(value0)

def produce(value0: int) -> Packet:
    return _GraphNative._call4(value0)

def second(value0: Packet) -> int:
    return _GraphNative._call5(value0)

from . import _native as _GraphNative
