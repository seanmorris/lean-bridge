from __future__ import annotations
from dataclasses import dataclass as _dataclass
from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

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

_Value1: _TypeAlias = Option[Packet]
_Input1: _TypeAlias = Option[Packet]
_Value0: _TypeAlias = tuple[_Value1, ...]
_Input0: _TypeAlias = tuple[_Input1, ...] | list[_Input1]
PacketAlias: _TypeAlias = Packet

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...

def echo(value0: Packet) -> Packet:
    ...

def echo_groups(value0: _Input0) -> _Value0:
    ...

def first(value0: Packet) -> int:
    ...

def groups(value0: _Input0) -> int:
    ...

def produce(value0: int) -> Packet:
    ...

def second(value0: Packet) -> int:
    ...

