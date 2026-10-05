use function LeanRecursive\{tree, forest, envelope, scalars, left, right, never_, spine, grow, empty_, join_trees, inspect, wide, units, word_max, signed_min, marker, empty_record};

function native_clean(): void {
    $stats = lean_graph_stats(); check($stats['nativeLive'] === 0 && $stats['zendLive'] === 0, 'Leaked graph allocation');
}
reject(fn() => tree(1)); reject(fn() => never_(new stdClass()));
reject(fn() => join_trees($tree, new stdClass()));
reject(fn() => tree($objectCycle), ValueError::class);
check(lean_graph_stats()['runtimeInitializations'] === 0);
$magnitude = Big::of(2)->power(128)->plus(1);
$realFields = $fields;
$realFields['natural'] = $magnitude; $realFields['integer'] = $magnitude->negated();
$realFields['f32'] = 1.5; $realFields['f64'] = -2.25;
$realFields['text'] = "A\0🌱"; $realFields['bytes'] = Bytes::fromString("\x00\xff\x01"); $realFields['char'] = '🌱';
check(inspect(new Scalars(...$realFields)) === true);
check(word_max(Big::of('4294967295')) === true); check(word_max(Big::of(0)) === false);
check(signed_min(-2147483647 - 1) === true); check(signed_min(0) === false);
foreach ([$scalars, new Scalars(...$realFields)] as $value) {
    $copy = scalars($value); check($copy !== $value && $copy->equals($value)); native_clean();
}
$copy = tree($tree); check($copy !== $tree && $copy->equals($tree));
check(empty_()->equals(new TreeBranch([])));
check(join_trees($tree, $tree)->equals(new TreeBranch([$tree, $tree])));
$copies = forest(array_fill(0, 128, $tree));
foreach ($copies as $index => $value) {
    check($value !== $tree && $value->equals($tree));
    if ($index) check($value !== $copies[0]);
}
check(forest([]) === []);
foreach ([null, new Some(null), new Some(new Some(null))] as $mark) foreach ([new Ok([$tree, $tree]), new Err("error\0🌱")] as $outcome) {
    $input = new Envelope($tree, [[], [$tree]], new Some($tree), $outcome, $mark);
    $copy = envelope($input); check($copy->equals($input)); native_clean();
}
check(left($left)->equals($left)); $right = new RightTreeMany([$left]); check(right($right)->equals($right));
$a = $spine; $b = spine($spine);
for ($index = 0; $index < 127; $index++) { check($a !== $b); $a = $a->value; $b = $b->value; }
check($a->value->isEqualTo($b->value));
reject(fn() => grow($spine), LeanRecursive\LeanBridgeError::class); native_clean();
check(grow(new SpineLeaf(Big::of(7)))->equals(new SpineNext(new SpineLeaf(Big::of(7)))));
check(wide($wide)->equals($wide));
foreach ([new MarkerEmpty(), new MarkerUnit(null), new MarkerNext(new MarkerEmpty())] as $value) check(marker($value)->equals($value));
check(empty_record(new EmptyRecord())->equals(new EmptyRecord()));
check(units(array_fill(0, 123, null)) === array_fill(0, 123, null));
foreach ([NAN, INF, -INF, -0.0, 0.0, 1.234567890123] as $number) {
    $floats = $fields; $floats['f32'] = $number; $floats['f64'] = $number;
    $copy = scalars(new Scalars(...$floats));
    check(is_nan($number) ? is_nan($copy->f32) : pack('f', $copy->f32) === pack('f', $number));
    check(is_nan($number) ? is_nan($copy->f64) : pack('E', $copy->f64) === pack('E', $number));
}
native_clean();

$faults = [];
foreach (['tree' => $tree, 'spine' => $spine, 'envelope' => $envelope, 'wide' => $wide] as $name => $input) {
    $call = 'LeanRecursive\\' . $name;
    lean_graph_reset(0, 0, 0); $call($input); $stats = lean_graph_stats();
    foreach (['zendAttempts', 'nativeAttempts'] as $kind) {
        for ($index = 1; $index <= $stats[$kind]; $index++) {
            lean_graph_reset($kind === 'zendAttempts' ? $index : 0, $kind === 'nativeAttempts' ? $index : 0, 0);
            reject(fn() => $call($input), $kind === 'nativeAttempts' ? LeanRecursive\LeanBridgeError::class : ($index === 1 ? Error::class : ValueError::class));
            native_clean(); lean_graph_reset(0, 0, 0); check($call($input)->equals($input)); native_clean();
        }
        $faults[$name][$kind] = $stats[$kind];
    }
}
$held = tree($tree); $before = lean_graph_stats();
lean_graph_reset(0, 0, 1);
reject(fn() => tree($tree), LeanRecursive\LeanBridgeError::class); native_clean();
check($held->equals($tree));
$failed = lean_graph_stats(); check($failed['decodes'] > $before['decodes']);
lean_graph_reset(0, 0, 0);
reject(fn() => tree($tree), LeanRecursive\LeanBridgeError::class); native_clean();
$stats = lean_graph_stats();
check($stats['runtimeInitializations'] === 1 && $stats['componentInitializations'] === 1);
check($stats['decodes'] === $failed['decodes']);
