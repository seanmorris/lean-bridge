// Original consumer assertions run unchanged before this supplement, in weak and strict caller modes.
$edgeBefore = $checks;
check(\LeanFincontainers\empty_array([]) === [], 'Fin 0 array round trip');
check(\LeanFincontainers\empty_list([]) === [], 'Fin 0 list round trip');
check(\LeanFincontainers\empty_option(null) === null, 'Fin 0 none round trip');
foreach ([n(0), n(1), $huge] as $value) {
    $input = [$value];
    $option = new Some($value);
    check(rejected(fn() => \LeanFincontainers\empty_array($input), "arg0[0]", '0'), 'Fin 0 nonempty array');
    check(rejected(fn() => \LeanFincontainers\empty_list($input), "arg0[0]", '0'), 'Fin 0 nonempty list');
    check(rejected(fn() => \LeanFincontainers\empty_option($option), "arg0?", '0'), 'Fin 0 some');
    check($input === [$value] && $option->value === $value, 'Fin 0 inputs unchanged');
}
check(\LeanFincontainers\optional_digits(null) === null, 'optional list absent');
$edgeEmpty = \LeanFincontainers\optional_digits(new Some([]));
check($edgeEmpty instanceof Some && $edgeEmpty->value === [], 'optional list present empty');
check(texts(\LeanFincontainers\optional_digits(new Some([n(0), n(9)]))->value) === ['0', '9'], 'optional list endpoints');
for ($position = 0; $position < 3; ++$position) {
    $values = [n(1), n(2), n(3)];
    $values[$position] = n(10);
    $snapshot = texts($values);
    $options = array_map(fn($value) => new Some($value), $values);
    check(rejected(fn() => present($options), "arg0[{$position}]?", '10'), 'nested option invalid position');
    check(array_map(fn($value) => (string)$value->value, $options) === $snapshot, 'nested options unchanged');
    check(rejected(fn() => \LeanFincontainers\optional_digits(new Some($values)), "arg0?[{$position}]", '10'), 'optional list invalid position');
    check(texts($values) === $snapshot, 'optional list unchanged');
    for ($column = 0; $column < 3; ++$column) {
        $table = [[n(1), n(2), n(3)], [n(4), n(5), n(6)], [n(7), n(8), n(9)]];
        $table[$position][$column] = n(10);
        $before = array_map('texts', $table);
        check(rejected(fn() => flatten($table), "arg0[{$position}][{$column}]", '10'), 'nested row and member positions');
        check(array_map('texts', $table) === $before, 'nested rows unchanged');
    }
}
check(present([null, null, null]) === [], 'absent options');
$edgeRows = flatten([[], [], []]);
check($edgeRows instanceof Some && $edgeRows->value === [], 'present empty rows');
check(throwsType(TypeError::class, fn() => \LeanFincontainers\empty_option(0)), 'unwrapped Option');
check(throwsType(TypeError::class, fn() => \LeanFincontainers\empty_list(null)), 'non-Array List');
check(throwsType(TypeError::class, fn() => \LeanFincontainers\optional_digits(new Some([n(1), 2, n(3)]))), 'nested wrong member type');
// Nat's ValueError is distinct from a Fin-bound LeanBridgeError.
$edgeNegative = static function (callable $call): bool {
    try { $call(); } catch (ValueError $error) { return get_class($error) === ValueError::class; }
    return false;
};
check($edgeNegative(fn() => \LeanFincontainers\empty_array([n(-1)])), 'negative Fin 0 Array is Nat error');
check($edgeNegative(fn() => \LeanFincontainers\empty_list([n(-1)])), 'negative Fin 0 List is Nat error');
check($edgeNegative(fn() => \LeanFincontainers\empty_option(new Some(n(-1)))), 'negative Fin 0 Option is Nat error');
for ($position = 0; $position < 3; ++$position) {
    $values = [n(1), n(2), n(3)];
    $values[$position] = n(-1);
    $before = texts($values);
    check($edgeNegative(fn() => \LeanFincontainers\optional_digits(new Some($values))), 'negative nested Nat');
    check(texts($values) === $before, 'negative input unchanged');
}
for ($cycle = 0; $cycle < 1000; ++$cycle) {
    check(rejected(fn() => \LeanFincontainers\empty_array([n(0)]), "arg0[0]", '0'), 'cycle invalid Array');
    check(\LeanFincontainers\empty_array([]) === [], 'cycle valid Array');
    check(rejected(fn() => \LeanFincontainers\empty_list([n(0)]), "arg0[0]", '0'), 'cycle invalid List');
    check(\LeanFincontainers\empty_list([]) === [], 'cycle valid List');
    check(rejected(fn() => \LeanFincontainers\empty_option(new Some(n(0))), "arg0?", '0'), 'cycle invalid Option');
    check(\LeanFincontainers\empty_option(null) === null, 'cycle valid Option');
    check(rejected(fn() => present([new Some(n(1)), new Some(n(10)), null]), "arg0[1]?", '10'), 'cycle invalid nested option');
    check(texts(present([new Some(n(1)), null, new Some(n(9))])) === ['1', '9'], 'cycle valid nested option');
    check(rejected(fn() => flatten([[n(1)], [n(10)], [n(9)]]), "arg0[1][0]", '10'), 'cycle invalid nested rows');
    check(texts(flatten([[n(1)], [], [n(9)]])->value) === ['1', '9'], 'cycle valid nested rows');
    check(rejected(fn() => \LeanFincontainers\optional_digits(new Some([n(1), n(10), n(9)])), "arg0?[1]", '10'), 'cycle invalid optional list');
    check(texts(\LeanFincontainers\optional_digits(new Some([n(1), n(9)]))->value) === ['1', '9'], 'cycle valid optional list');
}
check($checks - $edgeBefore === 12062, 'exact edge assertion coverage');
