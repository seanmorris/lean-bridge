<?php
declare(strict_types=0);
require __DIR__ . '/dependencies/brick-math/autoload.php';
require __DIR__ . '/src/Api.php';
require __DIR__ . '/src/Internal/GraphNative.php';

use Brick\Math\BigInteger as Big;
use LeanRecursive\{Bytes, Some, Ok, Err, Scalars, TreeBranch, TreeLeaf, SpineLeaf, SpineNext, LeftTreeLeaf, LeftTreeNext, RightTreeMany, Envelope, MarkerEmpty, MarkerUnit, MarkerNext, EmptyRecord, WideNext, WideLeaf};
use LeanRecursive\Internal\{Values, GraphInvalidNative};

$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; ++$checks; if (!$value) throw new RuntimeException('PHP Lean graph assertion ' . $checks . ': ' . $message);
}
function reject(callable $call, string $class, ?int $status = null): void {
    try { $call(); } catch (Throwable $error) {
        check($error instanceof $class, $error::class . ': ' . $error->getMessage());
        if ($status !== null) check($error->getCode() === $status, $error->getMessage()); return;
    }
    throw new RuntimeException('Expected rejection: ' . $class);
}
final class InjectedGraphFailure extends RuntimeException {}
final class GraphFaults {
    public static int $fail = 0;
    public static int $count = 0;
    public static array $owners = [];
    public static function hit(): void { if (++self::$count === self::$fail) throw new InjectedGraphFailure('Injected PHP allocation failure'); }
    public static function allocated(FFI\CData $value): void { self::$owners[] = WeakReference::create($value); }
    public static function reset(int $fail = 0): void { self::$count = 0; self::$fail = $fail; self::$owners = []; }
    public static function released(): void {
        foreach (self::$owners as $owner) check($owner->get() === null, 'Scratch survived call'); self::$owners = [];
    }
}
require __DIR__ . '/caller.php';
function clean(int $retained = 0): void {
    global $ffi; GraphFaults::released(); check($ffi->graph_fixture_live() === $retained, 'Native allocations survived call');
}
function resetNative(int $fail = 0, int $bad = 0, int $mode = 0): void {
    global $ffi; $ffi->graph_fixture_reset($fail, $bad, $mode); GraphFaults::reset();
}
$magnitude = Big::of(2)->power(128)->plus(1);
$fields = [null, true, 255, 65535, 4294967295, Big::of('18446744073709551615'), -128, -32768, -2147483648, PHP_INT_MIN,
    $magnitude, $magnitude->negated(), 1.5, -2.25, "A\0🌱", Bytes::fromString("\x00\xff\x01"), '🌱', Big::of('4294967295'), -2147483648];
$scalars = new Scalars(...$fields); $leaf = new TreeLeaf($scalars); $tree = new TreeBranch([$leaf, new TreeBranch([])]);
$envelope = new Envelope($tree, [[], [$tree]], new Some($tree), new Ok([$tree, $tree]), new Some(new Some(null)));
resetNative(); check($ffi->graph_fixture_ready() === 0);
reject(fn() => graph('join_trees', [$tree, new stdClass()]), TypeError::class);
check($loads === 0 && $ffi->graph_fixture_ready() === 0 && $ffi->graph_fixture_decodes() === 0); clean();
check(graph('inspect', [$scalars]) === true); clean();
check(graph('word_max', [Big::of('18446744073709551615')]) === true); clean();
check(graph('signed_min', [PHP_INT_MIN]) === true); clean();
foreach ([$fields, array_replace($fields, [10 => Big::of(2)->power(1000)->plus(7), 11 => Big::of(2)->power(1000)->plus(7)->negated()]),
    array_replace($fields, [10 => Big::of(0), 11 => Big::of(0), 14 => '', 15 => Bytes::fromString('')]),
    array_replace($fields, [12 => -INF, 13 => INF]), array_replace($fields, [12 => NAN, 13 => -0.0])] as $values) {
    $input = new Scalars(...$values); $copy = graph('scalars', [$input]); check($copy !== $input && $copy->equals($input)); clean();
}
check(graph('tree', [$tree])->equals($tree)); clean();
check(graph('empty_', [])->equals(new TreeBranch([]))); clean();
check(graph('join_trees', [$tree, $tree])->equals(new TreeBranch([$tree, $tree]))); clean();
$forest = array_fill(0, 512, $tree); $copy = graph('forest', [$forest]); check(Values::equal($copy, $forest));
check($copy[0] !== $copy[1] && $copy[0] !== $tree); clean();
foreach ([null, new Some(null), new Some(new Some(null))] as $marker) foreach ([new Ok([$tree, $tree]), new Err("error\0🌱")] as $outcome) {
    $input = new Envelope($tree, [[], [$tree]], null, $outcome, $marker); check(graph('envelope', [$input])->equals($input)); clean();
}
$left = new LeftTreeNext(new RightTreeMany([new LeftTreeLeaf(9)]));
check(graph('left', [$left])->equals($left)); clean();
$right = new RightTreeMany([$left]); check(graph('right', [$right])->equals($right)); clean();
$spine = new SpineLeaf(41); for ($index = 0; $index < 127; ++$index) $spine = new SpineNext($spine);
$copy = graph('spine', [$spine]); $a = $spine; $b = $copy;
for ($index = 0; $index < 127; ++$index) { check($a !== $b); $a = $a->value; $b = $b->value; }
check($a->value === 41 && $b->value === 41); clean();
reject(fn() => graph('grow', [$spine]), LeanRecursive\LeanBridgeError::class, 2); clean();
check(graph('grow', [new SpineLeaf(7)])->equals(new SpineNext(new SpineLeaf(7)))); clean();
$wide = range(0, 254); $wide[] = new WideLeaf(17); $wide = new WideNext(...$wide);
check(graph('wide', [$wide])->equals($wide)); clean();
foreach ([new MarkerEmpty(), new MarkerUnit(null), new MarkerNext(new MarkerEmpty())] as $value) { check(graph('marker', [$value])->equals($value)); clean(); }
check(graph('empty_record', [new EmptyRecord()])->equals(new EmptyRecord())); clean();
check(graph('units', [array_fill(0, 123, null)]) === array_fill(0, 123, null)); clean();
reject(fn() => graph('never_', [new stdClass()]), TypeError::class); clean();

resetNative(); check(graph('envelope', [$envelope])->equals($envelope));
$nativeCount = $ffi->graph_fixture_attempts(); $managedCount = GraphFaults::$count; clean();
for ($fail = 1; $fail <= $nativeCount; ++$fail) {
    resetNative($fail); reject(fn() => graph('envelope', [$envelope]), LeanRecursive\LeanBridgeError::class, 3);
    clean(); check($ffi->graph_fixture_ready() === 1);
}
$inputFailures = 0; $outputFailures = 0;
for ($fail = 1; $fail <= $managedCount; ++$fail) {
    resetNative(); GraphFaults::reset($fail); $before = $loads;
    reject(fn() => graph('envelope', [$envelope]), InjectedGraphFailure::class);
    if ($ffi->graph_fixture_decodes() === 0) { ++$inputFailures; check($loads === $before); } else ++$outputFailures;
    clean(); check($ffi->graph_fixture_ready() === 1);
}
resetNative(); $saved = graph('envelope', [$envelope]); check($saved->equals($envelope)); clean();
check($ffi->graph_fixture_hold() === 0); $retained = $ffi->graph_fixture_live(); check($retained > 0);
$mode = $argv[2];
if ($mode === 'carrier') { resetNative(0, 1); reject(fn() => graph('tree', [$tree]), GraphInvalidNative::class, 4); }
elseif ($mode === 'raw' || $mode === 'cycle') { resetNative(0, 0, $mode === 'raw' ? 1 : 2); reject(fn() => graph('tree', [$tree]), GraphInvalidNative::class); }
elseif ($mode === 'during') { resetNative(0, 0, 3); reject(fn() => graph('tree', [$tree]), LeanRecursive\LeanBridgeError::class, 5); }
else throw new RuntimeException('Unknown retirement scenario');
check($ffi->graph_fixture_ready() === 0); clean($retained);
resetNative(); reject(fn() => graph('envelope', [$envelope]), LeanRecursive\LeanBridgeError::class, 5);
check($ffi->graph_fixture_decodes() === 0); clean($retained);
check($saved->equals($envelope));
$ffi->graph_fixture_release(); $ffi->graph_fixture_release(); $ffi->graph_fixture_detach(); clean();
echo json_encode(['checks' => $checks, 'nativeCheckpoints' => $nativeCount, 'managedCheckpoints' => $managedCount,
    'inputFailures' => $inputFailures, 'outputFailures' => $outputFailures, 'layoutChecks' => count($layouts),
    'live' => $ffi->graph_fixture_live(), 'compiledLean' => true, 'actualPhpBits' => PHP_INT_SIZE * 8, 'phpVersion' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
