import lean_checkedrecords as api

checks = 0
def check(value):
    global checks
    if not value:
        raise AssertionError("checked-record assertion failed")
    checks += 1


big = 2**100

check(tuple(api.repeated(big).data) == (big, big, big))
first = api.repeated(7)
second = api.repeated(7)
check(first is not second and first.data is not second.data and tuple(second.data) == (7, 7, 7))
for i in range(1000):
    check(tuple(api.repeated(i).data) == (i, i, i))
print("checked-record-ok:" + str(checks))
