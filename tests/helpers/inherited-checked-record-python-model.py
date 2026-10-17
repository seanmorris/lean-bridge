"""Independent source-only model for the inherited-record Python caller."""
import dataclasses
import importlib.util
import json
import sys
import types


class LeanBridgeError(RuntimeError):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


@dataclasses.dataclass(frozen=True, slots=True)
class Span:
    lo: int
    hi: int


@dataclasses.dataclass(frozen=True, slots=True)
class Ticket:
    to_span: Span
    word: int


@dataclasses.dataclass(frozen=True, slots=True)
class Stamped:
    to_ticket: Ticket
    mark: int


def nat(value):
    if type(value) is not int:
        raise TypeError('expected Nat')
    if value < 0:
        raise ValueError('expected nonnegative Nat')
    return value


def expect(value, kind):
    if type(value) is not kind:
        raise TypeError('unexpected public record class')
    return value


def refused(prefix, suffix, constructor):
    raise LeanBridgeError(
        1, prefix + suffix + ' was rejected by InheritedCheckedRecords.' + constructor
    )


def span(value, prefix, normalize=False):
    value = expect(value, Span)
    lo, hi = nat(value.lo), nat(value.hi)
    if normalize:
        return Span(0, lo + hi)
    if lo > hi:
        refused(prefix, '.toSpan', 'mkSpan')
    return Span(lo, hi)


def ticket(value, prefix, normalize_record=False, normalize_parent=False,
           normalize_word=False):
    value = expect(value, Ticket)
    parent = span(value.to_span, prefix, normalize_parent)
    word = nat(value.word)
    if normalize_word:
        word += 1
    elif word == 0:
        refused(prefix, '.word', 'mkWord')
    if normalize_record:
        word = parent.hi + 1
    elif parent.hi > word:
        refused(prefix, '', 'mkTicket')
    return Ticket(parent, word)


def build_api(result_only, prefix):
    api = types.SimpleNamespace(
        LeanBridgeError=LeanBridgeError, Span=Span, Ticket=Ticket, Stamped=Stamped
    )

    def produce(value):
        value = nat(value)
        return Ticket(Span(value, value), value + 1)

    def produce_stamped(value):
        value = nat(value)
        return Stamped(Ticket(Span(value, value), value + 1), 0)

    api.produce = produce
    api.produce_stamped = produce_stamped
    if result_only:
        return api

    def first(value):
        value = ticket(value, prefix)
        return value.to_span.lo + value.to_span.hi + value.word

    def normalized(value):
        value = ticket(value, prefix, True, True, True)
        return value.to_span.lo + value.to_span.hi + value.word

    def pair(left, right):
        left = ticket(left, prefix)
        right = ticket(right, prefix.replace('0', '1'), True, True, True)
        return left.word + right.word

    def aliased(value):
        value = ticket(value, prefix, False, True, True)
        return value.word

    def nested(value):
        value = expect(value, Stamped)
        child = ticket(value.to_ticket, prefix)
        mark = nat(value.mark)
        if mark >= 8:
            raise LeanBridgeError(
                1, prefix + '.mark is not below its Fin 8 bound'
            )
        if mark > child.word:
            refused(prefix, '', 'mkStamped')
        return child.word + mark

    def echo(value):
        value = ticket(value, prefix, True, False, True)
        return value

    api.first = first
    api.normalized = normalized
    api.pair = pair
    api.aliased = aliased
    api.nested = nested
    api.echo = echo
    return api


def main():
    if len(sys.argv) < 2:
        raise SystemExit('usage: model.py caller.py [--result-only] [--reviewed]')
    spec = importlib.util.spec_from_file_location('inherited_consumer', sys.argv[1])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    result_only = '--result-only' in sys.argv[2:]
    prefix = 'value0' if '--reviewed' in sys.argv[2:] else 'arg0'
    result = module.check_inherited_checked_records(
        build_api(result_only, prefix), result_only=result_only,
        parameter_prefix='value' if '--reviewed' in sys.argv[2:] else 'arg'
    )
    print(json.dumps(result, sort_keys=True))


if __name__ == '__main__':
    main()
