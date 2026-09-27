import copy
import dataclasses
import gc
import json
import math
import pickle
import threading
import typing
import lean_owned_aggregates as api

checks = 0

def check(value):
    global checks
    assert value
    checks += 1

def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError("Expected " + str(kind))

def run():
    huge = (1 << 521) + (1 << 255) + 19
    with api.new_ticket(huge, "a\0雪🙂") as first, api.new_ticket(27, "second") as second:
        check(api.serial(first) == huge)
        check(api.label(first) == "a\0雪🙂")
        check(api.BundleAlias is api.Bundle)
        for cls in (api.Bundle, api.Mixed, api.ChainLink, api.TreeLeaf):
            check(bool(typing.get_type_hints(cls)))
        check(typing.get_type_hints(api.Ticket.retain)["return"] is api.Ticket)
        payload = api.Payload(-huge, b"\0\xffpayload")
        bundle = api.Bundle(first, api.Some(second), (first, second), (second, first), payload)
        tree = api.TreeBranch((api.TreeLeaf(first), api.TreeBranch((api.TreeLeaf(second),))))
        chain = api.ChainLink(first, api.Some(api.ChainLink(second, None)))
        mixed = api.Mixed(first, (None, api.Some(None), api.Some(api.Some(False)), api.Some(api.Some(True))),
                          api.Some(None), api.Ok(bundle), -huge, huge, "🙂", -0.0, 1.5,
                          b"\xff\0bytes", (0, (1 << 64) - 1), (second, (api.Some(first), payload)), chain)
        check(api.echo_record(bundle) == bundle)
        check(api.echo_alias(bundle) == bundle)
        check(api.bundle(first, api.Some(second), (first, second), (second, first), payload) == bundle)
        check(api.primary(bundle) == first)
        check(api.payload(bundle) == payload)
        check(api.echo_array([first, second]) == (first, second))
        check(api.echo_list([second, first]) == (second, first))
        check(api.echo_array([]) == ())
        check(api.echo_list([]) == ())
        check(api.echo_option(None) is None)
        check(api.echo_option(api.Some(first)) == api.Some(first))
        check(api.echo_result(api.Ok(bundle)) == api.Ok(bundle))
        check(api.echo_result(api.Err(second)) == api.Err(second))
        check(api.echo_tuple((first, (None, payload))) == (first, (None, payload)))
        for value in (api.ChoiceEmpty(), api.ChoiceOne(first), api.ChoicePair(first, second), api.ChoiceMany((first, second))):
            check(api.echo_variant(value) == value)
        check(api.echo_row((None, api.Some(first), api.Some(second))) == (None, api.Some(first), api.Some(second)))
        check(api.echo_recursive(tree) == tree)
        check(api.echo_chain(chain) == chain)
        check(api.echo_chain(api.ChainStop()) == api.ChainStop())
        nested = ((None, api.Some(api.Ok(bundle)), api.Some(api.Err(first))), ())
        check(api.echo_nested(nested) == nested)
        check(api.echo_mixed(mixed) == mixed)
        check(math.copysign(1.0, api.echo_mixed(mixed).precise) == -1.0)
        check(api.echo_mixed(dataclasses.replace(mixed, approximate=1.00000001)).approximate == 1.0)
        check(math.isnan(api.echo_mixed(dataclasses.replace(mixed, precise=math.nan)).precise))
        check(api.echo_mixed(dataclasses.replace(mixed, result=api.Err(first))).result == api.Err(first))

        for serial in (0, 1, (1 << 31) - 1, 1 << 31, (1 << 63) - 1, 1 << 63, 1 << 64, huge):
            with api.new_ticket(serial, str(serial)) as ticket:
                check(api.serial(ticket) == serial)
                check(api.label(ticket) == str(serial))
        for text in ("", "ascii", "\0", "\0middle\0", "é", "雪", "🙂", "\U0010ffff"):
            with api.new_ticket(1, text) as ticket:
                check(api.label(ticket) == text)

        copied = api.echo_record(bundle)
        check(copied is not bundle and copied.primary is not first)
        copied.primary.close()
        check(api.serial(first) == huge)
        shallow = copy.copy(first)
        check(shallow == first and shallow is not first)
        shallow.close()
        check(api.serial(first) == huge)
        with first.retain() as retained, api.retain_ticket(first) as retained_root:
            check(api.serial(retained) == huge)
            check(api.serial(retained_root) == huge)
        check(retained.is_closed and retained_root.is_closed)
        rejected(api.LeanBridgeError, lambda: api.serial(retained), 4)
        rejected(TypeError, lambda: copy.deepcopy(first))
        rejected(TypeError, lambda: pickle.dumps(first))
        rejected(TypeError, lambda: api.Ticket())
        rejected(dataclasses.FrozenInstanceError, lambda: setattr(bundle, "primary", second))

        with api.make_record(bundle) as chooser:
            check(chooser(True, dataclasses.replace(bundle, primary=second)) == bundle)
            check(chooser(False, dataclasses.replace(bundle, primary=second)).primary == second)
            kept = chooser.retain()
        check(kept(True, bundle) == bundle)
        kept.close()
        rejected(api.LeanBridgeError, lambda: kept(True, bundle), 4)
        with api.make_recursive(tree) as recursive:
            check(recursive(True, api.TreeBranch(())) == tree)
            check(recursive(False, api.TreeBranch(())) == api.TreeBranch(()))

        escaped, retained = [], []
        def borrow(value):
            escaped.append(value.primary)
            retained.append(value.primary.retain())
            return dataclasses.replace(value, primary=api.new_ticket(91, "callback-local"))
        result = api.callback_record(bundle, borrow)
        check(escaped[0].is_closed)
        rejected(api.LeanBridgeError, lambda: api.serial(escaped[0]), 4)
        check(api.serial(retained[0]) == huge)
        check(api.serial(result.primary) == 91)
        retained[0].close()
        check(api.callback_recursive(tree, lambda value: value) == tree)
        check(api.construct(first, lambda ticket: dataclasses.replace(bundle, primary=ticket)) == bundle)
        count = 0
        def mutable(value):
            nonlocal count
            count += 1
            return dataclasses.replace(value, payload=api.Payload(count, b"count"))
        check(api.twice(bundle, mutable).payload.count == 2)
        check(api.repeatedly(bundle, mutable, 3).payload.count == 5)
        with api.dispatch(bundle) as dispatcher, api.identity_closure(None) as identity:
            check(dispatcher(mutable).payload.count == 6)
            check(dispatcher(identity) == bundle)
            check(api.callback_record(bundle, identity) == bundle)
            with api.retain_callback(identity) as kept_callback:
                check(kept_callback(bundle) == bundle)
        with api.retain_callback(lambda value: value) as expired:
            rejected(api.LeanBridgeError, lambda: expired(bundle), 10)
        sentinel = ValueError("original callback exception")
        def fail(value):
            raise sentinel
        try:
            api.callback_record(bundle, fail)
        except ValueError as error:
            check(error is sentinel)
        else:
            raise AssertionError("Callback exception was swallowed")
        check(api.echo_record(bundle) == bundle)
        rejected(TypeError, lambda: api.factory(lambda unit: first))
        rejected(TypeError, lambda: api.factory(api.with_recovery(lambda unit: first, bundle)))
        with api.factory(api.with_recovery(lambda unit: api.new_ticket(92, "factory"), first)) as made:
            check(api.serial(made) == 92)
        try:
            api.factory(api.with_recovery(fail, first))
        except ValueError as error:
            check(error is sentinel)
        else:
            raise AssertionError("Recovery became a successful result")
        async def asynchronous(value):
            return value
        rejected(TypeError, lambda: api.callback_record(bundle, asynchronous))
        rejected(TypeError, lambda: api.callback_record(bundle, lambda value: asynchronous(value)))
        rejected(TypeError, lambda: api.callback_record(bundle, lambda value: value.primary))

        for action in (lambda: api.new_ticket(True, "bad"), lambda: api.new_ticket(-1, "bad"),
                       lambda: api.new_ticket(1, "\ud800"), lambda: api.echo_record({}),
                       lambda: api.echo_result(bundle), lambda: api.echo_option(first),
                       lambda: api.echo_tuple((first,)), lambda: api.serial(kept),
                       lambda: api.echo_mixed(dataclasses.replace(mixed, scalar="ab")),
                       lambda: api.echo_mixed(dataclasses.replace(mixed, precise=1)),
                       lambda: api.echo_mixed(dataclasses.replace(mixed, words=(1 << 64,)))):
            rejected((TypeError, ValueError), action)
        cyclic = api.ChainLink(first, None)
        object.__setattr__(cyclic, "next", api.Some(cyclic))
        rejected(ValueError, lambda: api.echo_chain(cyclic))
        deep = api.ChainStop()
        for _ in range(130):
            deep = api.ChainLink(first, api.Some(deep))
        rejected(api.LeanBridgeError, lambda: api.echo_chain(deep), 2)
        rejected(api.LeanBridgeError, lambda: api.echo_array([first] * 262145), 2)

        thread_errors, thread_results = [], []
        def worker():
            try:
                rejected(api.LeanBridgeError, lambda: api.serial(first), 5)
                with api.new_ticket(3, "thread") as local:
                    check(api.serial(local) == 3)
                thread_results.append(api.new_ticket(4, "escaped thread"))
            except BaseException as error:
                thread_errors.append(error)
        thread = threading.Thread(target=worker)
        thread.start()
        thread.join()
        check(not thread_errors)
        check(len(thread_results) == 1 and thread_results[0].is_closed)
        check(api.serial(first) == huge)
    check(first.is_closed and second.is_closed)

run()
gc.collect()
print(json.dumps({"checks": checks, "ordinaryImport": True}))
