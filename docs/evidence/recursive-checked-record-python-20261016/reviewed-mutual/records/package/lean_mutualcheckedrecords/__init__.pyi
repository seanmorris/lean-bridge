from __future__ import annotations
from dataclasses import dataclass as _dataclass
from typing import ClassVar as _ClassVar, Literal as _Literal, TypeAlias as _TypeAlias

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
_Value1: _TypeAlias = Option[Envelope]
_Input1: _TypeAlias = Option[Envelope]
_Value0: _TypeAlias = tuple[_Value1, ...]
_Input0: _TypeAlias = tuple[_Input1, ...] | list[_Input1]
_Value2: _TypeAlias = Option[Step]
_Input2: _TypeAlias = Option[Step]
EnvelopeAlias: _TypeAlias = Envelope

class LeanBridgeError(RuntimeError):
    status: int
    def __init__(self, status: int, message: str):
        ...

def echo(value0: Envelope) -> Envelope:
    ...

def echo_groups(value0: _Input0) -> _Value0:
    ...

def first(value0: Envelope) -> int:
    ...

def groups(value0: _Input0) -> int:
    ...

def produce(value0: int) -> Envelope:
    ...

def second(value0: Envelope) -> int:
    ...

