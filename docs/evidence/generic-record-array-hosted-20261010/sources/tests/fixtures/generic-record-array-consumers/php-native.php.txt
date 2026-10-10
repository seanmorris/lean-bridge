// Array fields and results: Array Nat inside ArrayBox, BoxRow as Array NatBox, and RowBox's Array NatBox field.
function array_raises(string $kind, callable $call): bool { try { $call(); } catch (\Throwable $error) { return get_class($error) === $kind; } return false; }
$arrayWide = BigInteger::of(2)->power(70);
$pushed = LeanGenericrecords\push_count(new LeanGenericrecords\ArrayBox([$n(1), $arrayWide, $n(3)], $n(3)));
check($pushed instanceof LeanGenericrecords\ArrayBox && $pushed->equals(new LeanGenericrecords\ArrayBox([$n(1), $arrayWide, $n(3), $n(3)], $n(4))));
check(LeanGenericrecords\push_count(new LeanGenericrecords\ArrayBox([], $n(0)))->equals(new LeanGenericrecords\ArrayBox([$n(0)], $n(1))));
$arrayInput = [$n(1), $arrayWide, $n(3)];
$arrayBox = new LeanGenericrecords\ArrayBox($arrayInput, $n(3));
check(LeanGenericrecords\push_count($arrayBox)->equals($pushed) && count($arrayInput) === 3 && $arrayInput[1]->isEqualTo($arrayWide) && $arrayBox->count->isEqualTo(3));
$row = [$natBox(2, 3), new NatBox($arrayWide, $n(1)), $natBox(0, 5)];
$rowExpected = $arrayWide->plus(6);
check(LeanGenericrecords\row_total($row)->isEqualTo($rowExpected) && LeanGenericrecords\row_total([])->isEqualTo(0));
check(count($row) === 3 && $row[1]->equals(new NatBox($arrayWide, $n(1))));
$made = LeanGenericrecords\row_of($n(3));
check(count($made) === 3 && $made[0]->equals($natBox(0, 3)) && $made[2]->equals($natBox(2, 3)) && LeanGenericrecords\row_of($n(0)) === [] && LeanGenericrecords\row_total($made)->isEqualTo(9));
check(LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($row, $n(4)))->isEqualTo($rowExpected) && LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox([], $n(9)))->isEqualTo(9) && LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($made, $n(0)))->isEqualTo(3));
// Invalid members at the first, middle and last position are the generated API's exact errors: ArrayBox's generated constructor
// checks each Array Nat member, row_total and RowBox's constructor check each row member. A negative NatBox cannot be constructed.
$arrayMembers = [[BigInteger::of(-1), 'ValueError'], [1, 'TypeError'], ['1', 'TypeError'], [1.0, 'TypeError']];
$rowMembers = [[new NatBoxAgain($n(1), $n(0)), 'TypeError'], [[1, 0], 'TypeError'], [1, 'TypeError'], [null, 'TypeError']];
for ($position = 0; $position < 3; ++$position) {
    foreach ($arrayMembers as [$member, $kind]) {
        $values = [$n(1), $arrayWide, $n(3)];
        $values[$position] = $member;
        check(array_raises($kind, fn() => new LeanGenericrecords\ArrayBox($values, $n(3))) && $values[$position] === $member && count($values) === 3);
        check(LeanGenericrecords\push_count(new LeanGenericrecords\ArrayBox([$n(1), $arrayWide, $n(3)], $n(3)))->equals($pushed));
    }
    foreach ($rowMembers as [$member, $kind]) {
        $broken = $row;
        $broken[$position] = $member;
        check(array_raises($kind, fn() => LeanGenericrecords\row_total($broken)) && $broken[$position] === $member && count($broken) === 3);
        check(array_raises($kind, fn() => new LeanGenericrecords\RowBox($broken, $n(4))) && $broken[$position] === $member);
        check(LeanGenericrecords\row_total($row)->isEqualTo($rowExpected) && LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($row, $n(4)))->isEqualTo($rowExpected));
    }
}
// Non-list Arrays, negative counts beside Array fields, a negative rowOf argument, wrong records and a missing field are refused too.
foreach ([
    [fn() => new LeanGenericrecords\ArrayBox(5, $n(1)), 'TypeError'],
    [fn() => new LeanGenericrecords\ArrayBox(['a' => $n(1)], $n(1)), 'TypeError'],
    [fn() => LeanGenericrecords\row_total($natBox(1, 0)), 'TypeError'],
    [fn() => LeanGenericrecords\row_total([1 => $natBox(1, 0)]), 'TypeError'],
    [fn() => new LeanGenericrecords\RowBox($natBox(1, 0), $n(1)), 'TypeError'],
    [fn() => new LeanGenericrecords\ArrayBox([$n(1)], BigInteger::of(-1)), 'ValueError'],
    [fn() => new LeanGenericrecords\RowBox($row, BigInteger::of(-1)), 'ValueError'],
    [fn() => LeanGenericrecords\row_of(BigInteger::of(-1)), 'ValueError'],
    [fn() => LeanGenericrecords\push_count(new LeanGenericrecords\RowBox($row, $n(1))), 'TypeError'],
    [fn() => LeanGenericrecords\row_box_sum(new LeanGenericrecords\ArrayBox([$n(1)], $n(1))), 'TypeError'],
    [fn() => new LeanGenericrecords\ArrayBox([$n(1)]), 'ArgumentCountError'],
] as [$call, $kind]) {
    check(array_raises($kind, $call));
    check(LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($row, $n(4)))->isEqualTo($rowExpected));
}
// One thousand Array rounds: a rejected member, then valid Array input and result calls.
for ($roundIndex = 0; $roundIndex < 1000; ++$roundIndex) {
    $position = $roundIndex % 3;
    $size = $roundIndex % 4;
    $values = [$n(1), $arrayWide, $n(3)];
    $values[$position] = BigInteger::of(-1);
    $rejectedMember = array_raises('ValueError', fn() => new LeanGenericrecords\ArrayBox($values, $n($roundIndex)));
    $values[$position] = [$n(1), $arrayWide, $n(3)][$position];
    $roundRow = LeanGenericrecords\row_of($n($size));
    $broken = $row;
    $broken[$position] = new NatBoxAgain($n(1), $n(0));
    $triangle = intdiv($size * max($size - 1, 0), 2);
    check($rejectedMember && LeanGenericrecords\push_count(new LeanGenericrecords\ArrayBox($values, $n($roundIndex)))->equals(new LeanGenericrecords\ArrayBox([$n(1), $arrayWide, $n(3), $n($roundIndex)], $n($roundIndex + 1)))
        && count($roundRow) === $size && LeanGenericrecords\row_total($roundRow)->isEqualTo($size * $triangle)
        && LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($roundRow, $n($roundIndex)))->isEqualTo($roundIndex + $triangle)
        && array_raises('TypeError', fn() => LeanGenericrecords\row_box_sum(new LeanGenericrecords\RowBox($broken, $n($roundIndex)))));
}
