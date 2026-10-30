"""Independent HostNull consumer for an installed, source-free Python wheel."""
import json
import sys

import lean_host_null_demo as api
from lean_host_null_demo import LeanClosure, None_, Packet, Some

checks = 0


def check(condition, message=""):
    global checks
    checks += 1
    if not condition:
        raise AssertionError(f"HostNull check {checks}: {message}")


def rejects(kind, call):
    try:
        call()
    except kind as error:
        check(True)
        return error
    raise AssertionError(f"Expected {kind.__name__}")


check(api.echo(None) is None, "direct null")
check(api.echo(42) == 42, "direct value")
check(api.nullable_option(None) is None, "nullable Option outer null")
check(type(api.nullable_option(None_())) is None_, "nullable Option none")
check(api.nullable_option(Some(42)) == Some(42), "nullable Option value")
check(type(api.optional_nullable(None_())) is None_, "optional nullable none")
check(api.optional_nullable(Some(None)) == Some(None), "optional nullable null")
check(api.optional_nullable(Some(42)) == Some(42), "optional nullable value")
check(api.nullable_option(None) is None and type(api.nullable_option(None_())) is None_,
      "HostNull null differs from Option.none")
check(type(api.optional_nullable(None_())) is None_ and
      api.optional_nullable(Some(None)) == Some(None),
      "Option.none differs from Some HostNull.null")

packet = Packet(None, None_(), Some(None))
echoed = api.echo_packet(packet)
check(echoed == packet, "record equality")
check(echoed is not packet, "record copied")
check(echoed.direct is None, "record direct field")
check(type(echoed.nullable_option) is None_, "record nullable Option field")
check(echoed.optional_nullable == Some(None), "record optional nullable field")


def callback_none(value):
    check(value is None, "callback null parameter")
    return None_()


check(type(api.call_host(None, callback_none)) is None_, "callback tagged result")


def callback_value(value):
    check(value == 42, "callback value parameter")
    return Some(43)


check(api.call_host(42, callback_value) == Some(43), "callback value result")


def callback_outer_null(value):
    check(value == 0, "callback zero parameter")
    return None


check(api.call_host(0, callback_outer_null) is None, "callback outer null result")
marker = RuntimeError("host callback marker")


def raise_marker(_value):
    raise marker


check(rejects(RuntimeError, lambda: api.call_host(None, raise_marker)) is marker,
      "callback exception identity")

closure = api.make_closure(Some(77))
check(isinstance(closure, LeanClosure) and not closure.closed, "open closure")
check(closure(None) == Some(77), "closure null parameter")
check(closure(2) == Some(77), "closure value parameter")
alias = closure
check(alias is closure, "closure identity")
closure.close()
closure.close()
check(closure.closed, "idempotent closure close")
rejects(RuntimeError, lambda: alias(None))

rejects(TypeError, lambda: api.echo(False))
rejects(TypeError, lambda: api.nullable_option(Some(None)))
rejects(TypeError, lambda: api.optional_nullable(None))
rejects(TypeError, lambda: api.echo_packet(Packet(False, None_(), None_())))
rejects(TypeError, lambda: api.call_host(None, None))
rejects(TypeError, lambda: api.call_host(None, lambda _value: False))
rejects(TypeError, lambda: api.make_closure(Some(None)))

print(json.dumps({"checks": checks, "api": api.__file__, "python": sys.version.split()[0]},
                 sort_keys=True))
