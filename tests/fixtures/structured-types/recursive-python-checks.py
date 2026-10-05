import ctypes as c
import dataclasses
import gc
import math
import weakref
import graph as lb

checks = 0


def check(condition):
    global checks
    assert condition
    checks += 1


def rejects(error_type, run, status=None):
    try:
        run()
    except error_type as error:
        check(status is None or error.status == status)
    else:
        raise AssertionError(f"Expected {error_type}")


def payload(**updates):
    value = lb.Scalars(None, True, 255, 65535, (1 << 32) - 1, (1 << 64) - 1,
                       -128, -32768, -(1 << 31), -(1 << 63), (1 << 128) + 1,
                       -((1 << 128) + 1), 1.5, -2.25, "A\0🌱", b"\0\xff\x01", "🌱",
                       (1 << 32) - 1, -(1 << 31))
    return dataclasses.replace(value, **updates)


def tree_value():
    return lb.TreeBranch((lb.TreeLeaf(payload()), lb.TreeBranch(())))


def envelope_value():
    tree = tree_value()
    return lb.Envelope(tree, ((), (tree,)), lb.Some(tree), lb.Ok((tree, tree)), lb.Some(lb.Some(None)))


def raw_type(name):
    return lb._types[name][2]


def input_value(name, value, scope):
    return lb._types[name][0](value, scope)


def output_value(name, value, scope):
    return lb._types[name][1](value, scope)


def roundtrip(name, value):
    scope = lb._GraphScope()
    try:
        return output_value(name, input_value(name, value, scope), scope)
    finally:
        scope.close()


def bind(library, name, params=(), result=c.c_size_t):
    fn = getattr(library, name)
    fn.argtypes = list(params)
    fn.restype = result
    return fn


def call_binding(library, name, symbol, lifecycle=None):
    inputs, result = lb._roots[name]
    fn = bind(library, symbol, [c.POINTER(raw) for raw in inputs] + [c.POINTER(result)], c.c_uint32)
    return lambda *args: getattr(lb, "_graph_call_" + name)(fn, *args, lifecycle=lifecycle)


class Interrupted(BaseException):
    pass


class Faults:
    def __init__(self):
        self.attempts = self.fail = 0
        self.error = MemoryError
        self.refs = []
        self.original_value = lb._GraphScope.value
        self.original_allocate = lb._GraphScope.allocate
        self.original_close = lb._GraphScope.close
        lb._graph_checkpoint = self.checkpoint
        owner = self

        def value(scope, *args):
            item = owner.original_value(scope, *args)
            if item is not None:
                owner.refs.append(weakref.ref(item))
            return item

        def allocate(scope, *args):
            item = owner.original_allocate(scope, *args)
            if item is not None:
                owner.refs.append(weakref.ref(item))
            return item

        def close(scope):
            owner.original_close(scope)
            check(not scope.active and not scope.owners)

        lb._GraphScope.value = value
        lb._GraphScope.allocate = allocate
        lb._GraphScope.close = close

    def checkpoint(self):
        self.attempts += 1
        if self.attempts == self.fail:
            raise self.error("injected graph conversion failure")

    def reset(self, fail=0, error=MemoryError):
        self.attempts, self.fail, self.error = 0, fail, error

    def clean(self):
        gc.collect()
        check(all(ref() is None for ref in self.refs))
        self.refs.clear()

    def restore(self):
        lb._GraphScope.value = self.original_value
        lb._GraphScope.allocate = self.original_allocate
        lb._GraphScope.close = self.original_close
        lb._graph_checkpoint = lambda: None
