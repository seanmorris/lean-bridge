import lean_checkedrecords as api

checks = 0
def check(value):
    global checks
    if not value:
        raise AssertionError("checked-record assertion failed")
    checks += 1

# BEGIN CHECKED INPUT HELPERS
def rejected(call, message):
    try:
        call()
    except api.LeanBridgeError as error:
        return error.status == 1 and str(error) == message
    return False
# END CHECKED INPUT HELPERS

big = 2**100
# BEGIN CHECKED INPUT CASES
good = api.Interval(3, 10)
bad = api.Interval(9, 3)
values = [9, 2, 4]
triple = api.Triple(values)
check(api.width(good) == 7)
check(api.width(api.Interval(1, 1)) == 0)
check(api.width(api.Interval(big, big + 9)) == 9)
check(api.span(good, api.Interval(5, 20)) == 17)
check(rejected(lambda: api.width(bad), "value0 was rejected by CheckedRecords.mkInterval"))
check(rejected(lambda: api.span(bad, good), "value0 was rejected by CheckedRecords.mkInterval"))
check(rejected(lambda: api.span(good, bad), "value1 was rejected by CheckedRecords.mkInterval"))
check(api.total(triple) == 15)
check(api.first_of(triple) == 9)
check(api.smallest(triple) == 2)
check(list(triple.data) == [9, 2, 4] and values == [9, 2, 4])
check(list(api.scale(3, triple).data) == [27, 6, 12])
check(list(triple.data) == [9, 2, 4] and values == [9, 2, 4])
check(rejected(lambda: api.total(api.Triple([])), "value0 was rejected by CheckedRecords.mkTriple"))
check(rejected(lambda: api.first_of(api.Triple([1, 2])), "value0 was rejected by CheckedRecords.mkTriple"))
check(rejected(lambda: api.smallest(api.Triple([4, 3, 2, 1])), "value0 was rejected by CheckedRecords.sortedTriple"))
check(rejected(lambda: api.scale(3, api.Triple([1, 2])), "value1 was rejected by CheckedRecords.mkTriple"))
check(api.complement(api.Percent(0)) == 100)
check(api.complement(api.Percent(100)) == 0)
check(rejected(lambda: api.complement(api.Percent(101)), "value0 was rejected by CheckedRecords.mkPercent"))
check(rejected(lambda: api.complement(api.Percent(big)), "value0 was rejected by CheckedRecords.mkPercent"))
for i in range(1000):
    check(rejected(lambda: api.width(api.Interval(i + 1, i)), "value0 was rejected by CheckedRecords.mkInterval"))
    check(api.width(api.Interval(i, i + 7)) == 7)
    check(rejected(lambda: api.total(api.Triple([1, 2])), "value0 was rejected by CheckedRecords.mkTriple"))
    check(api.total(triple) == 15)
    check(rejected(lambda: api.smallest(api.Triple([4, 3, 2, 1])), "value0 was rejected by CheckedRecords.sortedTriple"))
    check(api.smallest(triple) == 2)
    check(rejected(lambda: api.complement(api.Percent(101)), "value0 was rejected by CheckedRecords.mkPercent"))
    check(api.complement(api.Percent(100)) == 0)
check(list(triple.data) == [9, 2, 4] and values == [9, 2, 4] and good.lo == 3 and good.hi == 10 and bad.lo == 9 and bad.hi == 3)
# END CHECKED INPUT CASES

check(tuple(api.repeated(big).data) == (big, big, big))
first = api.repeated(7)
second = api.repeated(7)
check(first is not second and first.data is not second.data and tuple(second.data) == (7, 7, 7))
for i in range(1000):
    check(tuple(api.repeated(i).data) == (i, i, i))
print("checked-record-ok:" + str(checks))
