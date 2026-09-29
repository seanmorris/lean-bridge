import copy
import dataclasses
import json
import math
import threading
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

def resources(value):
    if isinstance(value, api.Ticket):
        yield value
    elif dataclasses.is_dataclass(value):
        for field in dataclasses.fields(value):
            yield from resources(getattr(value, field.name))
    elif type(value) in (list, tuple):
        for item in value:
            yield from resources(item)

def close(value):
    for resource in resources(value):
        resource.close()

def semantic(value):
    if type(value) is api.Ticket:
        return ("Ticket", api.serial(value), api.label(value))
    if dataclasses.is_dataclass(value):
        return (type(value).__name__, tuple(semantic(getattr(value, field.name))
                                          for field in dataclasses.fields(value)))
    if type(value) in (list, tuple):
        return tuple(semantic(item) for item in value)
    return value

def ticket(number=17):
    return api.new_ticket(number, "native\0雪🙂")

def bundle():
    first, second = ticket(), ticket(23)
    return api.Bundle(first, api.Some(second), [first, second], (second,),
                      api.Payload(-(1 << 180), b"\x00\x7f\x80\xff"))

def chain(depth=30):
    value = api.ChainStop()
    for index in range(depth):
        value = api.ChainLink(ticket(index), api.Some(value))
    return value

def tree(depth=40):
    value = api.TreeLeaf(ticket())
    for _ in range(depth):
        value = api.TreeBranch((value,))
    return value

def mixed(error=False):
    first = ticket()
    return api.Mixed(first, (None, api.Some(None), api.Some(api.Some(False)),
                             api.Some(api.Some(True))), api.Some(None),
                     api.Err(ticket(31)) if error else api.Ok(bundle()),
                     -(1 << 180), 1 << 200, "🙂", -0.0, float("inf"),
                     b"\x00\x7f\x80\xff", (0, (1 << 64) - 1),
                     (first, (api.Some(ticket(32)), api.Payload(-2, b"tuple"))),
                     chain(3))

def run():
    check("Consume resource leases in arg0" in api.retain_ticket.__doc__)
    check(api.bundle.__doc__.splitlines()[0] ==
          "Consume resource leases in arg0, arg2 at the Lean call boundary.")
    first = ticket()
    alias, independent = copy.copy(first), first.retain()
    received = api.retain_ticket(first)
    check(first.is_closed and alias.is_closed)
    check(api.serial(received) == api.serial(independent) == 17)
    rejected(api.LeanBridgeError, lambda: api.serial(alias), 4)
    close((first, alias, received, independent))

    original = api.echo_record(bundle())
    sibling = copy.copy(original.spare.value)
    independent = sibling.retain()
    received = api.retain_ticket(original.primary)
    check(all(value.is_closed for value in resources(original)))
    check(sibling.is_closed and api.serial(independent) == 23)
    close((original, sibling, independent, received))

    cases = [
        (api.echo_array, lambda: [ticket(), ticket(2)]),
        (api.echo_array, lambda: []),
        (api.echo_list, lambda: [ticket(), ticket(2)]),
        (api.echo_list, lambda: ()),
        (api.echo_option, lambda: api.Some(ticket())),
        (api.echo_option, lambda: None),
        (api.echo_result, lambda: api.Ok(bundle())),
        (api.echo_result, lambda: api.Err(ticket())),
        (api.echo_tuple, lambda: (ticket(), (api.Some(ticket(2)), api.Payload(-1, b"p")))),
        (api.echo_record, bundle), (api.echo_alias, bundle),
        (api.echo_variant, lambda: api.ChoiceEmpty()),
        (api.echo_variant, lambda: api.ChoiceOne(ticket())),
        (api.echo_variant, lambda: api.ChoicePair(ticket(), ticket(2))),
        (api.echo_variant, lambda: api.ChoiceMany((ticket(), ticket(2)))),
        (api.echo_variant, lambda: api.ChoiceMany(())),
        (api.echo_row, lambda: (None, api.Some(ticket()), None)),
        (api.echo_recursive, tree),
        (api.echo_recursive, lambda: api.TreeBranch(())),
        (api.echo_nested, lambda: ((), (None, api.Some(api.Ok(bundle())),
                                       api.Some(api.Err(ticket()))))),
        (api.echo_chain, chain), (api.echo_chain, lambda: api.ChainStop()),
        (api.echo_chain, lambda: api.ChainLink(ticket(), None)),
        (api.echo_mixed, mixed), (api.echo_mixed, lambda: mixed(True)),
    ]
    for function, make in cases:
        value = make()
        before = semantic(value)
        leaves = tuple(resources(value))
        received = function(value)
        check(semantic(received) == before)
        check(all(leaf.is_closed for leaf in leaves))
        if function is api.echo_mixed:
            check(math.copysign(1, received.precise) == -1)
            check(math.isinf(received.approximate))
            check(received.markers == (None, api.Some(None), api.Some(api.Some(False)),
                                        api.Some(api.Some(True))))
            check(received.unit == api.Some(None))
        close((value, received))

    for number in (0, 1, (1 << 63) - 1, 1 << 64, (1 << 521) + 19):
        first = ticket(number)
        with api.retain_ticket(first) as received:
            check(first.is_closed and api.serial(received) == number)
    for text in ("", "\0", "é", "雪", "🙂", "\U0010ffff"):
        first = api.new_ticket(1, text)
        with api.retain_ticket(first) as received:
            check(first.is_closed and api.label(received) == text)

    value = ticket()
    received = api.echo_array([value, value, copy.copy(value)])
    check(value.is_closed and all(api.serial(item) == 17 for item in received))
    close(received)
    first, second = ticket(), ticket(29)
    received = api.bundle(first, None, [second], (), api.Payload(5, b"two"))
    check(first.is_closed and second.is_closed)
    check(api.serial(received.primary) == 17 and api.serial(received.peers[0]) == 29)
    close(received)

    first = ticket()
    rejected(api.LeanBridgeError, lambda: api.bundle(first, None, [first], (), api.Payload(0, b"")), 1)
    check(not first.is_closed and api.serial(first) == 17)
    rejected(TypeError, lambda: api.bundle(first, None, [], (), api.Payload(True, b"")))
    check(not first.is_closed and api.serial(first) == 17)
    rejected(TypeError, lambda: api.echo_array([first, None]))
    check(not first.is_closed)
    first.close()

    value = tree(130)
    rejected(api.LeanBridgeError, lambda: api.echo_recursive(value), 2)
    check(all(not item.is_closed for item in resources(value)))
    close(value)
    cyclic = []
    loop = api.TreeBranch(cyclic)
    cyclic.append(loop)
    rejected(ValueError, lambda: api.echo_recursive(loop))
    cyclic.clear()

    value = bundle()
    aliases = tuple(copy.copy(item) for item in resources(value))
    escaped, retained = [], []
    def callback(incoming):
        check(all(item.is_closed for item in aliases))
        check(api.serial(incoming.primary) == 17)
        escaped.append(copy.copy(incoming.primary))
        rejected(api.LeanBridgeError, lambda: api.retain_ticket(incoming.primary), 1)
        owned = incoming.primary.retain()
        retained.append(api.retain_ticket(owned))
        check(owned.is_closed)
        local = api.echo_record(bundle())
        check(api.serial(local.primary) == 17)
        close(local)
        return incoming
    received = api.callback_record(value, callback)
    check(escaped[0].is_closed and api.serial(retained[0]) == 17)
    close((value, aliases, escaped, retained, received))

    sentinel = ValueError("same exception object")
    value = bundle()
    def fail(incoming):
        check(value.primary.is_closed)
        raise sentinel
    try:
        api.callback_record(value, fail)
    except ValueError as error:
        check(error is sentinel and value.primary.is_closed)
    else:
        raise AssertionError("Callback exception was swallowed")
    close(value)
    sentinel.__traceback__ = None

    value = tree(3)
    received = api.callback_recursive(value, lambda item: item)
    check(all(item.is_closed for item in resources(value)))
    close(received)
    for create, make in [(api.make_record, bundle), (api.make_recursive, lambda: tree(3))]:
        value = make()
        expected = semantic(value)
        with create(value) as closure:
            check(all(item.is_closed for item in resources(value)))
            supplied = make()
            received = closure(True, supplied)
            check(semantic(received) == expected)
            check(all(not item.is_closed for item in resources(supplied)))
            close((value, supplied, received))

    closure = api.new_record_callback()
    alias, independent = copy.copy(closure), closure.retain()
    with api.transfer_callback(closure) as received:
        check(closure.is_closed and alias.is_closed and not independent.is_closed)
        value = bundle()
        result = received(value)
        check(semantic(result) == semantic(value))
        close((result, value))
    independent.close()
    value = ticket()
    thread_results = []
    def other_thread():
        try:
            api.retain_ticket(value)
        except api.LeanBridgeError as error:
            thread_results.append(error.status)
    thread = threading.Thread(target=other_thread)
    thread.start()
    thread.join()
    check(thread_results == [5] and not value.is_closed)
    value.close()

run()
print(json.dumps({"checks": checks, "ordinaryImport": True}))
