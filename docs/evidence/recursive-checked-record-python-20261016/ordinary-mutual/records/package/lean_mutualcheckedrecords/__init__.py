from __future__ import annotations
from dataclasses import dataclass as _dataclass
from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

try:
    from typing import TypeAliasType as _TypeAliasType
except ImportError:
    from typing_extensions import TypeAliasType as _TypeAliasType

__all__ = ("LeanBridgeError", "Some", "Option", "Envelope", "EnvelopeAlias", "Step", "StepStop", "StepMore", "echo", "echo_groups", "first", "groups", "produce", "second",)

from typing import Generic as _Generic, TypeVar as _TypeVar

_T = _TypeVar("_T", covariant=True)
_E = _TypeVar("_E", covariant=True)

@_dataclass(frozen=True)
class Some(_Generic[_T]):
    value: _T

Option = Some[_T] | None


@_dataclass(frozen=True, slots=True)
class Envelope:
    value: int
    mode: int
    next: _Input2

@_dataclass(frozen=True, slots=True)
class StepStop:
    kind: _ClassVar[_Literal["stop"]] = "stop"

@_dataclass(frozen=True, slots=True)
class StepMore:
    kind: _ClassVar[_Literal["more"]] = "more"
    packet: Envelope

Step: _TypeAlias = StepStop | StepMore
_Value1 = _TypeAliasType("_Value1", Option[Envelope])
_Input1 = _TypeAliasType("_Input1", Option[Envelope])
_Value0 = _TypeAliasType("_Value0", tuple[_Value1, ...])
_Input0 = _TypeAliasType("_Input0", tuple[_Input1, ...] | list[_Input1])
_Value2 = _TypeAliasType("_Value2", Option[Step])
_Input2 = _TypeAliasType("_Input2", Option[Step])
EnvelopeAlias: _TypeAlias = Envelope

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status

def echo(arg0: Envelope) -> Envelope:
    return _GraphNative._call0(arg0)

def echo_groups(arg0: _Input0) -> _Value0:
    return _GraphNative._call1(arg0)

def first(arg0: Envelope) -> int:
    return _GraphNative._call2(arg0)

def groups(arg0: _Input0) -> int:
    return _GraphNative._call3(arg0)

def produce(arg0: int) -> Envelope:
    return _GraphNative._call4(arg0)

def second(arg0: Envelope) -> int:
    return _GraphNative._call5(arg0)

from . import _native as _GraphNative
