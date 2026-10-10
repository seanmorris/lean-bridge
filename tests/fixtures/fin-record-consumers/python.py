import lean_finrecords as api
from lean_finrecords import Some, Ok, Err, Tile, Nest, Late, Slot, ShapeCircle, ShapeLabel, ShapeEmpty, GateClosed, GateNever

checks = 0
def check(value, label):
    global checks
    if not value:
        raise AssertionError('failed: ' + label)
    checks += 1
def rejected(call, parameter, bound):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == parameter + ' is not below its Fin ' + bound + ' bound'
    return False

# Tile: the digit is Fin 5; any count is valid. Each rejected input is compared with an
# independently built copy before the caller changes it back.
for d in range(5):
    check(api.tile_sum(Tile(d, 10)) == d + 10, 'tile valid')
check(api.tile_sum(Tile(3, 2**100)) == 2**100 + 3, 'tile unbounded count')
tile = Tile(5, 2**100)
check(rejected(lambda: api.tile_sum(tile), 'arg0.digit', '5') and tile == Tile(5, 2**100), 'tile at bound')
tile = Tile(2**70, 2**100)
check(rejected(lambda: api.tile_sum(tile), 'arg0.digit', '5') and tile == Tile(2**70, 2**100), 'tile beyond 64 bits')
# Nest: the inner record's own bound and the outer bound are both checked.
check(api.nest_sum(Nest(Tile(4, 6), 2)) == 210, 'nest valid')
nest = Nest(Tile(5, 6), 2)
check(rejected(lambda: api.nest_sum(nest), 'arg0.inner.digit', '5') and nest == Nest(Tile(5, 6), 2), 'nest inner at bound')
nest = Nest(Tile(4, 6), 3)
check(rejected(lambda: api.nest_sum(nest), 'arg0.tag', '3') and nest == Nest(Tile(4, 6), 3), 'nest tag at bound')
check(api.nest_sum(Nest(Tile(4, 6), 2)) == 210, 'nest recovery')
# Late: heap fields precede the bound; a rejection leaves them as the caller built them.
items = [1, 2]
check(api.late_sum(Late('ab', items, 4)) == 4005, 'late valid')
late = Late('ab', items, 5)
check(rejected(lambda: api.late_sum(late), 'arg0.digit', '5') and late == Late('ab', [1, 2], 5) and items == [1, 2], 'late at bound')
check(api.late_sum(Late('ab', items, 4)) == 4005, 'late recovery')
# Slot: Option (Fin 0) is valid only when absent.
check(api.slot_count(Slot(None, 8)) == 8, 'slot absent')
slot = Slot(Some(0), 8)
check(rejected(lambda: api.slot_count(slot), 'arg0.maybe?', '0') and slot == Slot(Some(0), 8), 'slot present')
# Shape: only the active case is checked.
check(api.shape_size(ShapeCircle(9)) == 9, 'circle valid')
shape = ShapeCircle(10)
check(rejected(lambda: api.shape_size(shape), 'arg0.circle.radius', '10') and shape == ShapeCircle(10), 'circle at bound')
check(api.shape_size(ShapeLabel('abc')) == 1003, 'label')
check(api.shape_size(ShapeEmpty()) == 7, 'empty')
# Gate: the never case holds Fin 0, so it is always rejected; the closed case is always valid.
check(api.gate_open(GateClosed()) == 1, 'gate closed')
gate = GateNever(0)
check(rejected(lambda: api.gate_open(gate), 'arg0.never.value', '0') and gate == GateNever(0), 'gate never')
# Array Tile: every element; the empty array is valid.
def fresh():
    return [Tile(0, 1), Tile(4, 2), Tile(1, 0)]
row = fresh()
check(api.tiles([]) == 0, 'tiles empty')
check(api.tiles(row) == 8, 'tiles valid')
for k in range(3):
    kept = row[k]
    row[k] = Tile(5, kept.count)
    before = fresh()
    before[k] = Tile(5, before[k].count)
    check(rejected(lambda: api.tiles(row), f"arg0[{k}].digit", '5') and row == before, 'tiles element ' + str(k))
    row[k] = kept
check(api.tiles(row) == 8, 'tiles recovery')
# Option Shape: absent, a valid present circle, then an invalid one.
check(api.maybe_shape(None) == 99, 'maybe absent')
check(api.maybe_shape(Some(ShapeCircle(3))) == 3, 'maybe present')
maybe = Some(ShapeCircle(10))
check(rejected(lambda: api.maybe_shape(maybe), 'arg0?.circle.radius', '10') and maybe == Some(ShapeCircle(10)), 'maybe at bound')
# List Tile: every element's fields; a rejected list is unchanged before the caller restores it.
check(api.tile_list([]) == 0, 'tile list empty')
check(api.tile_list(row) == 8, 'tile list valid')
for k in range(3):
    kept = row[k]
    row[k] = Tile(5, kept.count)
    before = fresh()
    before[k] = Tile(5, before[k].count)
    check(rejected(lambda: api.tile_list(row), f"arg0[{k}].digit", '5') and row == before, 'tile list element ' + str(k))
    row[k] = kept
check(api.tile_list(row) == 8, 'tile list recovery')
# Tile × Shape: both components; the inactive circle of a label is never read.
check(api.tile_pair((Tile(4, 6), ShapeCircle(9))) == 19, 'pair valid')
pair = (Tile(5, 6), ShapeCircle(9))
check(rejected(lambda: api.tile_pair(pair), 'arg0.0.digit', '5') and pair == (Tile(5, 6), ShapeCircle(9)), 'pair tile at bound')
pair = (Tile(4, 6), ShapeCircle(10))
check(rejected(lambda: api.tile_pair(pair), 'arg0.1.circle.radius', '10') and pair == (Tile(4, 6), ShapeCircle(10)), 'pair shape at bound')
check(api.tile_pair((Tile(4, 6), ShapeCircle(9))) == 19, 'pair recovery')
check(api.tile_pair((Tile(1, 1), ShapeLabel('ab'))) == 1004, 'pair label')
# Except Shape Tile: the ok record or the error variant, only the active branch.
check(api.tile_except(Ok(Tile(3, 4))) == 7, 'except ok')
except_value = Ok(Tile(5, 4))
check(rejected(lambda: api.tile_except(except_value), 'arg0.ok.digit', '5') and except_value == Ok(Tile(5, 4)), 'except ok at bound')
check(api.tile_except(Err(ShapeCircle(9))) == 509, 'except error')
except_value = Err(ShapeCircle(10))
check(rejected(lambda: api.tile_except(except_value), 'arg0.error.circle.radius', '10') and except_value == Err(ShapeCircle(10)), 'except error at bound')
check(api.tile_except(Err(ShapeLabel('x'))) == 1501, 'except label')
check(api.tile_except(Ok(Tile(3, 4))) == 7, 'except recovery')
# Results carrying bounds are produced by Lean and arrive below them.
check(api.bump(Tile(4, 9)) == Tile(0, 10), 'bump')
tile = Tile(5, 9)
check(rejected(lambda: api.bump(tile), 'arg0.digit', '5') and tile == Tile(5, 9), 'bump at bound')
check(api.make_shape(4) == ShapeCircle(4), 'make circle')
check(api.make_shape(23) == ShapeLabel('23'), 'make label')
for i in range(1000):
    check(api.tile_sum(Tile(i % 5, i)) == i % 5 + i, 'round')
    tile = Tile(5 + i, i)
    check(rejected(lambda: api.tile_sum(tile), 'arg0.digit', '5') and tile == Tile(5 + i, i), 'rejection round')
print(f'fin-record-ok:{checks}')
