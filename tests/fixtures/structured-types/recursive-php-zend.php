use LeanRecursive\Internal\{GraphWire, GraphInvalidWire};

$manifest = json_decode(file_get_contents(__DIR__ . '/graph-zend-manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$functions = [];
foreach ($manifest['exports'] as $entry) $functions[substr($entry['function'], strlen('LeanRecursive\\'))] = $entry;
function graph_call(string $name, mixed ...$values): mixed {
    global $functions; return $functions[$name]['function'](...$values);
}
function private_call(string $name, mixed ...$values): mixed {
    global $functions; return $functions[$name]['transport'](...$values);
}
function type_id(string $name): int {
    foreach (GraphTypes::NODES as $index => $node)
        if (in_array('LeanRecursive\\' . $name, $node['classes'] ?? [], true)) return $index;
    throw new RuntimeException('No copied type for ' . $name);
}
function clean(): void {
    $stats = graph_probe_stats(); check($stats['live'] === 0 && $stats['owners'] === 0, 'Leaked native conversion allocation');
}

// Invalid public and private values must reject before initialization.
reject(fn() => graph_call('tree', 1));
reject(fn() => graph_call('tree', new ForeignTree()));
reject(fn() => graph_call('join_trees', $tree, new stdClass()));
reject(fn() => private_call('tree', [99, []]));
reject(fn() => private_call('tree', [true, []]));
reject(fn() => private_call('tree', ['0', []]));
reject(fn() => private_call('tree', []));
reject(fn() => private_call('tree', [0 => 0, 2 => []]));
check(graph_probe_stats()['inits'] === 0); clean();

$examples = ['tree' => $tree, 'envelope' => $envelope, 'scalars' => $scalars, 'left' => $left,
    'right' => new RightTreeMany([$left]), 'spine' => $spine, 'wide' => $wide,
    'marker' => new MarkerNext(new MarkerUnit(null)), 'empty_record' => new EmptyRecord(),
    'echo_link' => new LeanRecursive\Link(new Some(new LeanRecursive\Link(null))),
    'echo_result_link' => new LeanRecursive\ResultLink(new Ok(new LeanRecursive\ResultLink(new Err('tail'))))];
foreach ($examples as $name => $input) {
    $copy = graph_call($name, $input); check($copy !== $input && $copy->equals($input), $name);
    check($copy->hashCode() === $input->hashCode()); clean();
}
check(graph_call('inspect', $scalars) === true);
check(graph_call('word_max', Big::of('4294967295')) === true);
check(graph_call('word_max', Big::of('4294967294')) === false);
check(graph_call('signed_min', -2147483647 - 1) === true);
check(graph_call('signed_min', 0) === false);
check(graph_call('empty_')->equals(new TreeBranch([])));
check(graph_call('units', [null, null]) === [null, null]);
check(graph_call('forest', []) === []);
$copies = graph_call('forest', [$tree, $tree]);
check($copies[0] !== $tree && $copies[0] !== $copies[1]); check($copies[0]->equals($copies[1]));
foreach ([null, new Some(null), new Some(new Some(null))] as $mark) foreach ([new Ok([$tree, $tree]), new Err("error\0🌱")] as $outcome) {
    $input = new Envelope($tree, [[], [$tree]], new Some($tree), $outcome, $mark);
    check(graph_call('envelope', $input)->equals($input));
}
foreach ([NAN, INF, -INF, -0.0, 0.0, 1.234567890123] as $number) {
    $values = $fields; $values['f32'] = $number; $values['f64'] = $number;
    $copy = graph_call('scalars', new Scalars(...$values));
    check(is_nan($number) ? is_nan($copy->f32) : pack('f', $copy->f32) === pack('f', $number));
    check(is_nan($number) ? is_nan($copy->f64) : pack('E', $copy->f64) === pack('E', $number));
}

// Public cycles and private wire cycles reject. Shared acyclic inputs copy.
reject(fn() => graph_call('spine', $cycle), ValueError::class, 'Cyclic');
$wire = [0, []]; $wire[1][] = &$wire;
reject(fn() => private_call('spine', $wire), ValueError::class, 'Cyclic'); clean();
$wire = GraphWire::toWire(type_id('TreeLeaf'), $tree);
reject(fn() => GraphWire::fromWire(type_id('TreeLeaf'), [999, []]), GraphInvalidWire::class);
reject(fn() => GraphWire::fromWire(type_id('TreeLeaf'), [0, 'bad']), GraphInvalidWire::class);
reject(fn() => GraphWire::fromWire(type_id('SpineNext'), [0, [null]]), GraphInvalidWire::class);
$scalarWire = GraphWire::toWire(type_id('Scalars'), $scalars);
foreach ([0 => false, 1 => 1, 2 => '255', 3 => 65536, 4 => '4294967296', 5 => '18446744073709551616',
    6 => -129, 7 => -32769, 8 => 1.0, 9 => '-9223372036854775809', 10 => '-1', 11 => '+1',
    12 => 1, 13 => '1.0', 14 => "\xff", 15 => false, 16 => 'ab', 17 => '4294967296', 18 => '0'] as $index => $value) {
    $bad = array_replace($scalarWire, [$index => $value]);
    reject(fn() => private_call('scalars', $bad), in_array($index, [0, 1, 2, 8, 12, 13, 15, 18], true) ? TypeError::class : ValueError::class);
    reject(fn() => GraphWire::fromWire(type_id('Scalars'), $bad), GraphInvalidWire::class); clean();
}
foreach (['', '00', '-0', ' 1', '1 ', '1e3', '0x10', str_repeat('9', 16385)] as $text) {
    $bad = array_replace($scalarWire, [10 => $text]);
    reject(fn() => private_call('scalars', $bad), ValueError::class);
    reject(fn() => GraphWire::fromWire(type_id('Scalars'), $bad), GraphInvalidWire::class);
}
reject(fn() => private_call('units', array_fill(0, 262145, null)), ValueError::class, '262144');
$excessive = [0, [GraphWire::toWire(type_id('SpineNext'), $spine)]];
reject(fn() => private_call('spine', $excessive), ValueError::class, '128 levels');
$large = array_replace($scalarWire, [14 => str_repeat('a', 16 * 1024 * 1024)]);
reject(fn() => private_call('scalars', $large), ValueError::class, '16 MiB'); clean();

// Every scratch calloc failure releases native result owners and all C scratch.
$faults = [];
foreach (['tree', 'spine', 'wide', 'envelope', 'echo_link', 'echo_result_link'] as $name) {
    graph_probe_reset(0, 0); graph_call($name, $examples[$name]); $count = graph_probe_stats()['attempts'];
    for ($index = 1; $index <= $count; $index++) {
        graph_probe_reset(0, $index);
        reject(fn() => graph_call($name, $examples[$name]), $index === 1 ? Error::class : ValueError::class, 'allocation failed'); clean();
        check(graph_probe_stats()['retired'] === 0); graph_probe_reset(0, 0);
        check(graph_call($name, $examples[$name])->equals($examples[$name])); clean();
    }
    $faults[$name] = $count;
}

// Inject failure at every PHP conversion/construction checkpoint. A failure in
// result construction occurs after Zend has already released the native owner.
$wireFail = 0; $wireCheckpoints = 0;
$inputFailures = 0; $outputFailures = 0;
graph_call('tree', $tree); $phpFaults = $wireCheckpoints;
check($phpFaults > 0);
for ($index = 1; $index <= $phpFaults; $index++) {
    $wireFail = $index; $wireCheckpoints = 0; $before = graph_probe_stats()['calls'];
    reject(fn() => graph_call('tree', $tree), Error::class, 'PHP conversion fault');
    clean(); check(graph_probe_stats()['retired'] === 0);
    if (graph_probe_stats()['calls'] === $before) $inputFailures++; else $outputFailures++;
    $wireFail = 0; check(graph_call('tree', $tree)->equals($tree));
}
check($inputFailures > 0 && $outputFailures > 0);
foreach ([11, 12, 13, 15] as $mode) {
    graph_probe_reset($mode, 0); reject(fn() => graph_call('tree', $tree), LeanRecursive\LeanBridgeError::class);
    clean(); check(graph_probe_stats()['retired'] === 0); graph_probe_reset(0, 0); check(graph_call('tree', $tree)->equals($tree));
}
graph_probe_reset(8, 0); reject(fn() => graph_call('tree', $tree), ValueError::class, '262144');
check(graph_probe_stats()['retired'] === 0); clean(); graph_probe_reset(0, 0);
$held = graph_call('tree', $tree);

// One permanent-retirement scenario per fresh interpreter. Native cleanup must
// finish before the exception; already copied values remain usable afterward.
$scenario = SCENARIO;
graph_probe_reset($scenario, 0);
reject(fn() => graph_call(in_array($scenario, [3, 9], true) ? 'scalars' : 'tree', in_array($scenario, [3, 9], true) ? $scalars : $tree), LeanRecursive\LeanBridgeError::class);
clean(); check(graph_probe_stats()['retired'] === 1); check($held->equals($tree));
$before = graph_probe_stats()['calls']; graph_probe_reset(0, 0);
reject(fn() => graph_call('tree', $tree), LeanRecursive\LeanBridgeError::class);
check(graph_probe_stats()['calls'] === $before); clean();
