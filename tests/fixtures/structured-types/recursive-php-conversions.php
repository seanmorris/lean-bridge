<?php
declare(strict_types=0);

require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/src/Internal/GraphNative.php';

use Brick\Math\BigInteger as Big;
use LeanRecursive\{Bytes, Some, Ok, Err, Scalars, TreeBranch, TreeLeaf, SpineLeaf, SpineNext, LeftTreeLeaf, LeftTreeNext, RightTreeMany, Envelope, MarkerEmpty, MarkerUnit, MarkerNext, EmptyRecord, WideNext, WideLeaf, Link, ResultLink};
use LeanRecursive\Internal\{Values, GraphInvalidNative, GraphRuntime, GraphNativeTypes};

$checks = 0; $rejections = 0;
function check(bool $condition, string $message = ''): void {
    global $checks; ++$checks;
    if (!$condition) throw new RuntimeException('PHP recursive conversion: ' . $message);
}
function reject(callable $call, string $class, string $message = ''): void {
    global $rejections;
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $class, get_class($error) . ': ' . $error->getMessage());
        if ($message !== '') check(str_contains($error->getMessage(), $message), $error->getMessage());
        ++$rejections; return;
    }
    throw new RuntimeException('Missing PHP conversion rejection');
}
final class InjectedGraphFailure extends RuntimeException {}
final class GraphFaults {
    public static int $fail = 0;
    public static int $count = 0;
    public static array $owners = [];
    public static function hit(): void {
        if (++self::$count === self::$fail) throw new InjectedGraphFailure('Injected PHP conversion failure');
    }
    public static function allocated(FFI\CData $value): void { self::$owners[] = WeakReference::create($value); }
    public static function reset(int $fail = 0): void { self::$fail = $fail; self::$count = 0; self::$owners = []; }
    public static function released(): void {
        foreach (self::$owners as $owner) check($owner->get() === null, 'scratch allocation survived call');
    }
}
// A bad host input cannot resolve a loader, even on the first call in a process.
foreach (GraphNativeTypes::FUNCTIONS as $id => $fn) {
    if (count($fn['parameters']) === 1) {
        reject(fn() => GraphRuntime::call($id, fn() => throw new RuntimeException('loader ran'), [new stdClass()]), TypeError::class);
    }
}
require __DIR__ . '/caller.php';
function resetNative(int $mode = 0): void {
    global $ffi; $ffi->graph_fixture_reset($mode); $ffi->graph_fixture_reset_lifecycle(); GraphFaults::reset();
}
function cleaned(int $calls = 1, int $clears = 1): void {
    global $ffi; check($ffi->graph_fixture_calls() === $calls); check($ffi->graph_fixture_live() === 0);
    check($ffi->graph_fixture_clears() === $clears); GraphFaults::released();
}
$fields = [null, true, 255, 65535, 4294967295, Big::of('18446744073709551615'),
    -128, -32768, -2147483648, PHP_INT_MIN, Big::of(str_repeat('9', 1000)), Big::of('-' . str_repeat('8', 1000)),
    -0.0, NAN, "雪\0🌲", Bytes::fromString("\x00\xff"), '🌲', Big::of('18446744073709551615'), PHP_INT_MIN];
$scalars = new Scalars(...$fields); $leaf = new TreeLeaf($scalars); $branch = new TreeBranch([$leaf, new TreeBranch([])]);
$envelope = new Envelope($branch, [[$leaf, $branch], []], new Some($leaf), new Ok([$leaf, $branch]), new Some(new Some(null)));
resetNative(); graph('tree', [new TreeBranch([])]); cleaned();
resetNative(); graph('tree', [$leaf]); cleaned();
resetNative(); $copy = graph('scalars', [$scalars], 'echo_scalars');
check($copy !== $scalars && $copy->equals($scalars)); check($copy->bytes !== $scalars->bytes); cleaned();
resetNative(); $copy = graph('scalars', [$scalars]);
check($copy->u64->isEqualTo(Big::of('18446744073709551615'))); check($copy->i64 === PHP_INT_MIN);
check($copy->natural->isEqualTo(Big::of(2)->power(1000)->plus(7))); check($copy->integer->isEqualTo($copy->natural->negated()));
check($copy->text === "a\0🌿" && $copy->bytes->toString() === "\x00\xff\x80"); check($copy->char === '🌿');
check($copy->f32 === INF && pack('E', $copy->f64) === pack('E', -0.0)); cleaned();
foreach ([NAN, INF, -INF, -0.0, 0.0, 1.234567890123] as $number) {
    $floats = $fields; $floats[12] = $number; $floats[13] = $number;
    resetNative(); $copy = graph('scalars', [new Scalars(...$floats)], 'echo_scalars');
    check(is_nan($number) ? is_nan($copy->f32) : pack('g', $copy->f32) === pack('g', $number));
    check(is_nan($number) ? is_nan($copy->f64) : pack('E', $copy->f64) === pack('E', $number)); cleaned();
}
$spine = new SpineLeaf(4294967295); for ($i = 0; $i < 127; ++$i) $spine = new SpineNext($spine);
$wide = range(0, 254); $wide[] = new WideLeaf(4294967295); $wide = new WideNext(...$wide);
$linked = new Link(null); $resultLink = new ResultLink(new Err('finished'));
for ($i = 0; $i < 20; ++$i) { $linked = new Link(new Some($linked)); $resultLink = new ResultLink(new Ok($resultLink)); }
foreach ([['tree', $branch], ['envelope', $envelope], ['spine', $spine], ['wide', $wide], ['empty_record', new EmptyRecord()],
    ['marker', new MarkerEmpty()], ['marker', new MarkerUnit(null)], ['marker', new MarkerNext(new MarkerUnit(null))],
    ['echo_link', $linked], ['echo_result_link', $resultLink], ['left', new LeftTreeNext(new RightTreeMany([new LeftTreeLeaf(42)]))],
    ['right', new RightTreeMany([new LeftTreeLeaf(43)])]] as [$name, $input]) {
    resetNative(); $copy = graph($name, [$input]); check($copy !== $input); check($copy->equals($input), $name); cleaned();
}
foreach ([null, new Some(null), new Some(new Some(null))] as $marker) {
    resetNative(); $input = new Envelope($leaf, [], null, new Err('missing'), $marker);
    $copy = graph('envelope', [$input]); check($copy->equals($input)); cleaned();
}
resetNative(); $forest = [$leaf, $branch, $leaf]; $copy = graph('forest', [$forest]);
check(Values::equal($copy, $forest)); check($copy[0] !== $copy[2] && $copy[0] !== $leaf); cleaned();
resetNative(); check(graph('units', [[null, null, null]]) === [null, null, null]); cleaned();
resetNative(); check(graph('word_max', [Big::of('18446744073709551615')]) === true); cleaned(1, 0);
resetNative(); check(graph('signed_min', [PHP_INT_MIN]) === true); cleaned(1, 0);
resetNative(); check(graph('inspect', [$scalars]) === true); cleaned(1, 0);
resetNative(); check(graph('empty_', []) instanceof TreeBranch); cleaned();
resetNative(); check(graph('join_trees', [$leaf, $branch])->equals($leaf)); cleaned();

$cycle = (new ReflectionClass(SpineNext::class))->newInstanceWithoutConstructor();
(new ReflectionProperty(SpineNext::class, 'value'))->setValue($cycle, $cycle);
resetNative(); $before = $loads; reject(fn() => graph('spine', [$cycle]), ValueError::class, 'Cyclic');
check($loads === $before); cleaned(0, 0); check($ffi->graph_fixture_initialized() === 0);
resetNative(); reject(fn() => graph('units', [[false]]), TypeError::class); cleaned(0, 0);
resetNative(); reject(fn() => graph('units', [array_fill(0, 262144, null)]), ValueError::class, '262144'); cleaned(0, 0);
resetNative(); reject(fn() => graph('tree', [$leaf, $leaf]), ArgumentCountError::class); cleaned(0, 0);
// Large list native storage rejects before the authenticated target is loaded.
resetNative(); $before = $loads; reject(fn() => graph('forest', [array_fill(0, 100000, new TreeBranch([]))]), ValueError::class);
check($loads === $before); cleaned(0, 0);

foreach ([2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24, 25, 26] as $mode) {
    resetNative($mode); reject(fn() => graph('scalars', [$scalars], 'scalar_more'), GraphInvalidNative::class);
    cleaned(); check($ffi->graph_fixture_retired() === 1);
}
foreach ([12, 13] as $mode) {
    resetNative($mode); reject(fn() => graph('envelope', [$envelope]), GraphInvalidNative::class); cleaned();
    check($ffi->graph_fixture_retired() === 1);
}
foreach (['bad_tree', 'cycle_tree'] as $symbol) {
    resetNative(); reject(fn() => graph('tree', [$branch], $symbol), GraphInvalidNative::class); cleaned();
    check($ffi->graph_fixture_retired() === 1);
}
foreach ([101, 103, 105] as $mode) {
    resetNative($mode); reject(fn() => graph('scalars', [$scalars]), LeanRecursive\LeanBridgeError::class, 'status ' . ($mode - 100));
    cleaned(); check($ffi->graph_fixture_retired() === 0);
}
resetNative(); $ffi->graph_fixture_retire(); reject(fn() => graph('tree', [$leaf]), LeanRecursive\LeanBridgeError::class, 'status 5'); cleaned(0, 0);
resetNative(); reject(fn() => graph('tree', [$branch], 'during'), LeanRecursive\LeanBridgeError::class, 'status 5'); cleaned();

resetNative(); graph('envelope', [$envelope]); $checkpoints = GraphFaults::$count; cleaned();
$inputFailures = 0; $outputFailures = 0;
for ($failure = 1; $failure <= $checkpoints; ++$failure) {
    resetNative(); GraphFaults::reset($failure); $before = $loads;
    reject(fn() => graph('envelope', [$envelope]), InjectedGraphFailure::class);
    if ($ffi->graph_fixture_calls() === 0) { ++$inputFailures; check($loads === $before); cleaned(0, 0); }
    else { ++$outputFailures; cleaned(); }
    check($ffi->graph_fixture_retired() === 0);
}
resetNative(); check(graph('envelope', [$envelope])->equals($envelope)); cleaned();
echo json_encode(['checks' => $checks, 'rejections' => $rejections, 'layoutChecks' => count($layouts), 'checkpoints' => $checkpoints,
    'inputFailures' => $inputFailures, 'outputFailures' => $outputFailures, 'live' => $ffi->graph_fixture_live(),
    'actualPhpBits' => PHP_INT_SIZE * 8, 'phpVersion' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
