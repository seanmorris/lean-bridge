"""Exercise the supplemental Python caller against the existing standalone caller oracle only.

No Lean or installed library executes. The oracle definitions are read from
nominal-primitive-subtype-python-model.py so both callers share one independent model.
"""
import copy
import json
import os
import sys


if len(sys.argv) != 2:
    raise ValueError('Expected the supplemental caller path')
model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'nominal-primitive-subtype-python-model.py')
with open(model_path, encoding='utf-8') as stream:
    model_source = stream.read()
definitions, separator, _ = model_source.partition('\nresults = []\n')
assert separator, 'Unexpected caller-oracle layout'
namespace = {'__name__': 'primitive_caller_oracle', '__file__': model_path}
exec(compile(definitions, model_path, 'exec'), namespace)  # noqa: S102 - repository-local oracle definitions
caller, oracle = namespace['caller'], namespace['oracle']

results = []
for prefix in ('arg', 'value'):
    results.append(dict(parameterPrefix=prefix, **caller.check_nominal_primitive_supplement(
        oracle(False, prefix), parameter_prefix=prefix)))


def relaxed_input(api):
    api.echo_a = copy.deepcopy


def strict_result(api):
    original = api.produce

    def produce(value):
        try:
            api.echo_a(api.Packet(**{field: getattr(value, field) for field in namespace['names']}))
        except api.LeanBridgeError:
            return None
        return original(value)
    api.produce = produce


def unchecked_box(api):
    original = api.echo_event_a
    api.echo_event_a = lambda value: copy.deepcopy(value) if type(value) is api.EventBox else original(value)


def wrong_constructor_name(api):
    original = api.echo_event_b

    def echo(value):
        try:
            return original(value)
        except api.LeanBridgeError as error:
            raise api.LeanBridgeError(str(error).replace('natB', 'natA')) from None
    api.echo_event_b = echo


mutations = []
for name, mutate in (('relaxed-input', relaxed_input), ('strict-result', strict_result),
                     ('unchecked-box', unchecked_box), ('wrong-constructor', wrong_constructor_name)):
    api = oracle()
    mutate(api)
    try:
        caller.check_nominal_primitive_supplement(api)
    except AssertionError:
        mutations.append(name)
    else:
        raise AssertionError('Supplemental caller accepted mutation: ' + name)
print(json.dumps(dict(results=results, rejectedMutations=mutations, installedAcceptance=False), sort_keys=True))
