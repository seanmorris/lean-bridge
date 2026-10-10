import lean_finrecordzero as api
from lean_finrecordzero import Fields, Zero

checks = 0
def check(value, label):
    global checks
    if not value:
        raise AssertionError(label)
    checks += 1

def refused(call, build, path):
    value, before = build(), build()
    try:
        call(value)
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == path + ' is not below its Fin 0 bound' and value == before
    return False

def fields(member=None, digit=0):
    return Fields('kept', [7, 2**100], [digit] if member == 'array' else [], [digit] if member == 'list' else [])

for call in (api.array_records, api.list_records):
    check(call([]) == [], 'empty record collection')
    for digit in (0, 1, 2**100):
        check(refused(call, lambda: [Zero(digit)], 'arg0[0].digit'), 'populated record collection')
    check(call([]) == [], 'record collection recovery')

check(api.field_collections(fields()) == fields(), 'empty fields and result')
for member in ('array', 'list'):
    for digit in (0, 1, 2**100):
        check(refused(api.field_collections, lambda: fields(member, digit), f'arg0.{member}[0]'), 'populated field')
check(api.field_collections(fields()) == fields(), 'field recovery')

for call in (api.array_fields, api.list_fields):
    check(call([]) == [], 'empty outer collection')
    check(call([fields() for _ in range(3)]) == [fields() for _ in range(3)], 'populated outer collection of empty fields')
    for index in range(3):
        for member in ('array', 'list'):
            def build():
                return [fields(member, 0) if k == index else fields() for k in range(3)]
            check(refused(call, build, f'arg0[{index}].{member}[0]'), 'nested field rejection')
            check(call([fields() for _ in range(3)]) == [fields() for _ in range(3)], 'nested field recovery')

for index in range(1000):
    check(api.field_collections(fields()) == fields(), 'round valid')
    member = 'array' if index % 2 == 0 else 'list'
    check(refused(api.field_collections, lambda: fields(member, index), f'arg0.{member}[0]'), 'round rejection')
print(f'fin-record-zero-ok:{checks}')
