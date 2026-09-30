import copy
import gc
import json
import pickle
import threading
import lean_owned_aggregates as api

checks = 0

def check(value):
    global checks
    if not value:
        raise AssertionError("installed Python borrow check failed")
    checks += 1

def rejected(kind, action, status=None):
    try:
        action()
    except kind as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError("Expected " + str(kind))

def ticket(number=17):
    return api.new_ticket(number, "owner\0🙂")

def payload():
    return api.Payload(-(1 << 1024) - 37, b"\0\xff\x13")

def sample():
    first, second = ticket(7).get(), ticket(9).get()
    return api.Bundle(first, api.Some(second), (first, second, first), (second, first), payload())

def owners():
    root = ticket()
    alias, kept = copy.copy(root), root.retain()
    view = api.retain_ticket(root)
    child = api.retain_ticket(view)
    check(root == kept and child == kept)
    check(root.get().same_identity(kept.get()))
    independent, leaf = child.retain(), child.get()
    root.close()
    check(not view.is_closed and api.serial(alias.get()) == 17)
    alias.close()
    check(view.is_closed and child.is_closed and leaf.is_closed)
    rejected(api.LeanBridgeError, view.get, 4)
    rejected(api.LeanBridgeError, view.retain, 4)
    rejected(api.LeanBridgeError, lambda: view == kept, 4)
    rejected(api.LeanBridgeError, lambda: leaf.same_identity(kept.get()), 4)
    check(api.serial(kept.get()) == api.serial(independent.get()) == 17)
    for number in range(64):
        with ticket(number) as fresh:
            check(api.serial(fresh.get()) == number and view.is_closed)
    rejected(TypeError, lambda: api.Value())
    rejected(TypeError, lambda: api.retain_ticket(kept.get()))
    rejected(TypeError, lambda: copy.deepcopy(kept))
    rejected(TypeError, lambda: pickle.dumps(kept))
    # Public resource aliases keep their original owning lease, not a hidden copy.
    root = ticket(19)
    raw, borrowed = root.get(), api.retain_ticket(root)
    root.close()
    check(not borrowed.is_closed and api.serial(raw) == 19)
    raw.close()
    check(borrowed.is_closed)

def shape(raw, function):
    root = api.copy_value(raw, result_of=function)
    view = function(root)
    independent, child = view.retain(), function(view)
    check(root == view == independent and not root.is_closed)
    root.close()
    check(view.is_closed and child.is_closed)
    rejected(api.LeanBridgeError, view.get, 4)
    check(not independent.is_closed)

def shapes():
    value = sample()
    item = value.primary
    for raw, function in [
        ([], api.echo_array), ([item, item], api.echo_array),
        ([], api.echo_list), ([item], api.echo_list),
        (None, api.echo_option), (api.Some(item), api.echo_option),
        (api.Ok(value), api.echo_result), (api.Err(item), api.echo_result),
        ((item, (api.Some(item), payload())), api.echo_tuple),
        (value, api.echo_record), (value, api.echo_alias),
        ((), api.echo_row), ((None, api.Some(item)), api.echo_row),
        ((), api.echo_nested),
        (((), (None, api.Some(api.Ok(value)), api.Some(api.Err(item)))), api.echo_nested),
        (api.TreeBranch(()), api.echo_recursive),
    ]:
        shape(raw, function)
    for branch in [api.ChoiceEmpty(), api.ChoiceOne(item), api.ChoicePair(item, item),
                   api.ChoiceMany((item, item)), api.ChoiceMany(())]:
        shape(branch, api.echo_variant)
    tree = api.TreeLeaf(item)
    for _ in range(35):
        tree = api.TreeBranch((tree,))
    shape(tree, api.echo_recursive)
    root = api.copy_value(value)
    check(root.get() == value)
    peers = api.copy_value([], parameter_of=(api.bundle, "arg2"))
    borrowed = api.bundle(item, None, peers, (), payload())
    check(borrowed.get().primary == item)
    peers.close()
    check(borrowed.is_closed)
    rejected(TypeError, lambda: api.copy_value([]))
    rejected(TypeError, lambda: api.copy_value([], result_of=api.serial))
    rejected(TypeError, lambda: api.copy_value([], parameter_of=(api.bundle, "missing")))
    rejected(TypeError, lambda: api.copy_value([], result_of=api.echo_array,
                                             parameter_of=(api.bundle, "arg2")))
    rejected(TypeError, lambda: api.copy_value([1], result_of=api.echo_array))
    check(not root.is_closed)

def transfers():
    root = ticket(23)
    alias, independent = copy.copy(root), root.retain()
    view = api.retain_ticket(root)
    child = api.retain_ticket(view)
    rejected(api.LeanBridgeError, lambda: api.transfer_ticket(view), 1)
    moved = api.transfer_ticket(root)
    check(root.is_closed and alias.is_closed and view.is_closed and child.is_closed)
    check(api.serial(moved.get()) == api.serial(independent.get()) == 23)
    other = ticket(0)
    other_alias = copy.copy(other)
    mixed = api.mixed_ticket(moved, other)
    check(other.is_closed and other_alias.is_closed and mixed == moved)
    rejected(api.LeanBridgeError, lambda: api.mixed_ticket(moved, moved), 1)
    rejected(api.LeanBridgeError, lambda: api.mixed_ticket(mixed, moved), 1)
    check(not moved.is_closed and not mixed.is_closed)
    moved.close()
    check(mixed.is_closed)
    empty = api.copy_value([], result_of=api.echo_array)
    alias = copy.copy(empty)
    view = api.echo_array(empty)
    child = api.echo_array(view)
    check(api.move_array(empty).get() == ())
    check(empty.is_closed and alias.is_closed and view.is_closed and child.is_closed)

def callbacks():
    root = api.copy_value(sample())
    escaped, retained = [], []
    def callback(value):
        escaped.append(value.primary)
        retained.append(value.primary.retain())
        owner = api.copy_value(value)
        check(api.echo_record(owner).get() == value)
        return value
    view = api.callback_record(root, callback)
    check(escaped[0].is_closed and not retained[0].is_closed and view == root)
    closure = api.make_record(root)
    independent = closure.retain()
    check(closure(True, sample()).get() == root.get())
    failure = RuntimeError("original callback failure")
    def throwing(value):
        raise failure
    try:
        api.callback_record(root, throwing)
    except RuntimeError as error:
        check(error is failure)
    else:
        raise AssertionError("Expected original exception")
    failure.__traceback__ = None
    root.close()
    check(view.is_closed and closure.is_closed)
    rejected(api.LeanBridgeError, lambda: closure(True, sample()), 4)
    check(not independent(True, sample()).is_closed)
    moving = api.copy_value(sample())
    alias, dependent = copy.copy(moving), api.echo_record(moving)
    def during_move(value):
        check(alias.is_closed and dependent.is_closed)
        return value
    check(not api.move_record(moving, during_move).is_closed)

def depth_and_affinity():
    root = ticket(33)
    independent = root.retain()
    chain = [copy.copy(root)]
    for _ in range(140):
        try:
            chain.append(api.retain_ticket(chain[-1]))
        except api.LeanBridgeError as error:
            check(error.status == 2 and len(chain) >= 100)
            break
    else:
        raise AssertionError("Expected bounded anchor depth")
    check(api.serial(chain[-1].get()) == 33)
    chain[48].close()
    check(not chain[47].is_closed and chain[49].is_closed and chain[-1].is_closed)
    root.close()
    chain[0].close()
    for item in chain[1:]:
        check(item.is_closed)
    check(api.serial(independent.get()) == 33)
    errors = []
    def foreign():
        try:
            independent.get()
        except api.LeanBridgeError as error:
            errors.append(error.status)
    thread = threading.Thread(target=foreign)
    thread.start()
    thread.join()
    check(errors == [5])

for operation in [owners, shapes, transfers, callbacks, depth_and_affinity]:
    operation()
    gc.collect()
print(json.dumps({"ordinaryImport": True, "checks": checks}))
