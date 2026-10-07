import lean_genericrecords as api
from lean_genericrecords import Some

checks = 0
def check(value):
    global checks
    assert value
    checks += 1
def rejected(call):
    try:
        call()
    except (TypeError, ValueError, OverflowError):
        return True
    return False

# Each alias is its own frozen dataclass with the structure's fields instantiated; Nat fields are exact integers.
box = api.NatBox(4, 1)
bumped = api.bump(box)
check(bumped == api.NatBox(5, 2) and box.value == 4 and bumped is not box)
check(api.again(api.NatBoxAgain(4, 1)) == api.NatBoxAgain(8, 1))
# Two aliases of one application are two distinct classes with the same layout; each call checks the exact class.
check(api.NatBox is not api.NatBoxAgain and api.NatBox(1, 2) != api.NatBoxAgain(1, 2))
check(rejected(lambda: api.bump(api.NatBoxAgain(1, 2))))
check(rejected(lambda: api.again(api.NatBox(1, 2))))
greeting = 'héllo \U0001F642'
check(api.shout(api.TextBox(greeting, 3)) == api.TextBox(greeting + '!', 3))
check(api.swap_named(api.WordPair('a', 1)) == api.WordPair('a!', 2))
# A parameter instantiated with Option Nat and a List of a named instantiation.
check(api.or_zero(api.MaybeBox(Some(5), 2)) == 7 and api.or_zero(api.MaybeBox(None, 2)) == 2)
boxes = [api.NatBox(1, 0), api.NatBox(2, 0), api.NatBox(2**70, 0)]
check(api.total(boxes) == 2**70 + 3 and api.total([]) == 0 and api.total(tuple(boxes)) == 2**70 + 3)
first = api.first_boxes(2)
check(first == Some((api.NatBox(0, 2), api.NatBox(1, 2))) and api.first_boxes(0) is None)
# A pair of two named instantiations.
check(api.unpair(api.BoxPair(api.NatBox(3, 0), api.TextBox('abcd', 0))) == 7)
# A universe-polymorphic structure instantiated at Type.
check(api.retag(api.TaggedNat('t', 1)) == api.TaggedNat('t#', 2))
# A phantom argument: the instantiation names Marker, which no field carries.
check(api.relabel(api.MarkerTag('m')) == api.MarkerTag('m?'))
# Field and shape checks stay exact: wrong field types, wrong records and missing fields are refused.
check(rejected(lambda: api.bump(api.NatBox('4', 1))))
check(rejected(lambda: api.bump(api.NatBox(-1, 1))))
check(rejected(lambda: api.bump((4, 1))))
check(rejected(lambda: api.unpair(api.BoxPair(api.NatBox(3, 0), api.NatBox(4, 0)))))
check(rejected(lambda: api.total([api.NatBox(1, 0), (1, 0)])))
check(rejected(lambda: api.NatBox(1)))
for i in range(1000):
    check(api.bump(api.NatBox(i, i)) == api.NatBox(i + 1, i + 1))
print(f'generic-records-ok:{checks}')
