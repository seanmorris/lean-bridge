<?php
declare(strict_types=1);
namespace LeanStructured\Internal;
use Brick\Math\BigInteger;
use LeanStructured\{Bytes, Some, Ok, Err, Payload, PacketPayload, PacketCounts};
require 'vendor/autoload.php';

// Evaluate an instrumented copy in memory. Never edit the installed package.
final class StructuredFaults {
    public static bool $active = false;
    public static int $count = 0, $target = 0, $checks = 0, $faults = 0, $clears = 0, $closes = 0;
    public static array $owners = [], $scopes = [];
    public static ?\Closure $deferred = null;
    public static \Throwable $marker;
    public static function tick(): void {
        if (self::$active && ++self::$count === self::$target) throw self::$marker;
    }
    public static function owner(\FFI\CData $value): void {
        if (self::$active) self::$owners[] = \WeakReference::create($value);
        self::tick();
    }
    public static function scope(object $value): void {
        if (self::$active) self::$scopes[] = \WeakReference::create($value);
    }
    public static function close(object $scope): void {
        if (self::$active) { ensure($scope->owners === []); ++self::$closes; }
    }
    public static function clear(\FFI $ffi, \FFI\CData $out): void {
        if (!self::$active) return;
        ++self::$clears;
        ensure(\FFI::string($ffi->cast('char *', \FFI::addr($out)), \FFI::sizeof($out)) === str_repeat("\0", \FFI::sizeof($out)));
    }
    public static function step(): void {
        if (self::$deferred !== null) { $action = self::$deferred; self::$deferred = null; $action(); }
        self::tick();
    }
}
function ensure(bool $condition): void {
    if (!$condition) throw new \RuntimeException('Structured PHP fault check ' . (StructuredFaults::$checks + 1));
    ++StructuredFaults::$checks;
}
$request = json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR);
$root = realpath('vendor/' . $request['package'] . '/src/Internal');
$native = file_get_contents($root . '/Native.php'); ensure(str_starts_with($native, '<?php')); $native = substr($native, 5);
// Public LeanClosure requires the real Lease type. Exercise its unchanged body.
$native = preg_replace('~\nfinal class Lease\n\{.*?\n\}\n~s', "\n", $native, -1, $count); ensure($count === 1);
foreach (['Budget', 'Scope', 'ScalarCodec', 'IntegerCodec', 'Values', 'CallFrame', 'Checks', 'Native'] as $name) {
    $native = preg_replace('~\b' . $name . '\b~', 'StructuredProbe' . $name, $native, -1, $count); ensure($count > 0);
}
$native = str_replace('__DIR__', var_export($root, true), $native, $count); ensure($count === 2);
$native = str_replace('$this->remaining -= $count * $width;', '$this->remaining -= $count * $width; StructuredFaults::tick();', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners[] = $memory;', '$this->owners[] = $memory; StructuredFaults::owner($memory);', $native, $count); ensure($count === 1);
$native = str_replace('$this->budget = new StructuredProbeBudget();', '$this->budget = new StructuredProbeBudget(); StructuredFaults::scope($this);', $native, $count); ensure($count === 1);
$native = str_replace('$this->owners = [];', '$this->owners = []; StructuredFaults::close($this);', $native, $count); ensure($count === 1);
$native = preg_replace('~(\$ffi->[a-zA-Z0-9_]+_(?:clear|dispose)\(\\\\FFI::addr\(\$out\)\);)~', '{ $1 StructuredFaults::clear($ffi, $out); }', $native, -1, $count); ensure($count === 40);
$native = preg_replace('~(private static function (?:to|from|own)\d+\([^\n]*\): [^\n]+ \{)~', '$1 StructuredFaults::tick();', $native, -1, $conversions); ensure($conversions === 64);
$native = str_replace('return $out;', 'StructuredFaults::tick(); return $out;', $native, $count); ensure($count >= 25);
$native = str_replace('return (self::$wrap)($lease);', 'StructuredFaults::tick(); $wrapped = (self::$wrap)($lease); StructuredFaults::tick(); return $wrapped;', $native, $count); ensure($count === 14);
$native = str_replace('$out->cdata = $value ? 1 : 0;', 'StructuredFaults::step(); $out->cdata = $value ? 1 : 0;', $native, $count); ensure($count === 1);
eval($native); unset($native);
$ffi = (new \ReflectionMethod(StructuredProbeNative::class, 'load'))->invoke(null);
$broker = \FFI::cdef('typedef struct { uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities; uint64_t runtime_instance_id, identity_domain_id; } Snapshot; void lean_bridge_native_snapshot_read(Snapshot *);', $root . '/../../native/linux-x64/liblean_bridge_native.so');
function live(): int {
    global $broker;
    $snapshot = $broker->new('Snapshot'); $broker->lean_bridge_native_snapshot_read(\FFI::addr($snapshot));
    return $snapshot->live_identities;
}
function exercise(callable $operation, mixed $expected, int $target = 0, string $kind = \RuntimeException::class): int {
    $baseline = live();
    StructuredFaults::$owners = StructuredFaults::$scopes = [];
    StructuredFaults::$count = 0; StructuredFaults::$target = $target;
    StructuredFaults::$marker = new $kind('injected structured conversion failure');
    StructuredFaults::$active = true; $failed = false;
    try { ensure($operation() == $expected); }
    catch (\Throwable $error) { ensure($error === StructuredFaults::$marker); $failed = true; ++StructuredFaults::$faults; }
    finally { StructuredFaults::$active = false; }
    unset($error); gc_collect_cycles();
    ensure($failed === ($target !== 0));
    foreach ([...StructuredFaults::$owners, ...StructuredFaults::$scopes] as $owner) ensure($owner->get() === null);
    ensure((new \ReflectionProperty(StructuredProbeNative::class, 'contexts'))->getValue() === []);
    ensure(live() === $baseline);
    return StructuredFaults::$count;
}
$big = fn($value) => BigInteger::of((string) $value);
$rows = [null, new Some(''), new Some("copied\0λ😀")];
$record = new Payload("record\0λ", $rows, $big(str_repeat('9', 100)), new Some(new Ok([$big('18446744073709551615'), null])));
$otherRecord = new Payload('other', [new Some('x')], $big(42), new Some(new Err("error\0λ")));
$cases = [
    'array' => [$rows, [new Some("other\0λ"), null]],
    'list' => [[new Ok([4294967295, "ok\0λ"]), new Err('error')], [new Err("other\0λ"), new Ok([0, ''])]],
    'option' => [new Some(new Some(null)), new Some(null)],
    'result' => [new Err(["error\0λ", '']), new Ok(new Some(4294967295))],
    'tuple' => [["tuple\0λ", [Bytes::fromString("\0\xff"), $big(str_repeat('8', 128))]], ['other', [Bytes::fromString("\x80"), $big(1)]]],
    'record' => [$record, $otherRecord],
    'variant' => [new PacketPayload("packet\0λ", $rows), new PacketCounts($big(str_repeat('9', 100)), $big('-' . str_repeat('8', 100)))],
    'alias' => [$record, $otherRecord]
];
$baseline = live(); $reports = [];
foreach ($cases as $shape => [$value, $other]) {
    $call = $request['functions']['call_' . $shape];
    $twice = $request['functions']['twice_' . $shape];
    $make = $request['functions']['make_' . $shape];
    $paths = []; $before = StructuredFaults::$faults;
    $held = StructuredProbeNative::$make($other);
    try {
        $operations = [
            'callback' => fn() => StructuredProbeNative::$call($value, fn($item) => $other),
            'repeated' => fn() => StructuredProbeNative::$twice($value, fn($item) => $other),
            'create' => function () use ($make, $other) { $closure = StructuredProbeNative::$make($other); try { return $other; } finally { $closure->close(); } },
            'create-call' => function () use ($make, $value, $other) { $closure = StructuredProbeNative::$make($other); try { return $closure(true, $value); } finally { $closure->close(); } },
            'held-call' => fn() => $held(true, $value)
        ];
        foreach ($operations as $name => $operation) {
            $count = exercise($operation, $other); ensure($count > 0); $paths[$name] = $count;
            foreach ([\RuntimeException::class, \Error::class] as $kind) for ($target = 1; $target <= $count; ++$target) {
                exercise($operation, $other, $target, $kind);
                ensure(StructuredProbeNative::$call($value, fn($item) => $other) == $other);
            }
            ensure(exercise($operation, $other) === $count);
        }
    } finally { $held->close(); }
    unset($held, $operations, $operation); gc_collect_cycles(); ensure(live() === $baseline);
    $closure = StructuredProbeNative::$make($value);
    StructuredFaults::$deferred = function () use ($closure, $baseline) {
        $closure->close(); ensure($closure->isClosed() && live() === $baseline + 1);
    };
    ensure($closure(true, $other) == $value);
    ensure($closure->isClosed() && live() === $baseline && StructuredFaults::$deferred === null);
    unset($closure);
    $reports[] = ['shape' => $shape, 'paths' => $paths, 'faults' => StructuredFaults::$faults - $before];
}
// Synthetic headers reach only private decoders, never a native release routine.
$malformed = 0;
foreach ($request['invalid'] as $layout) {
    $patterns = match ($layout['kind']) {
        'variant' => ['kind' => 4294967295], 'option' => ['has_value' => 2], 'result' => ['is_ok' => 2],
        'sequence' => ['length' => 1], default => throw new \RuntimeException('Unexpected layout')
    };
    $convert = new \ReflectionMethod(StructuredProbeNative::class, 'from' . $layout['index']);
    foreach ($patterns as $field => $marker) {
        $value = $ffi->new($layout['ctype']); $value->$field = $marker; $scope = new StructuredProbeScope($ffi); $caught = false;
        try { $convert->invoke(null, $value, $scope); }
        catch (\RuntimeException|\ValueError $expected) { $caught = true; }
        finally { $scope->close(); }
        ensure($caught); ++$malformed;
        if ($layout['kind'] === 'sequence') {
            $value->length = PHP_INT_MAX; $value->data = $ffi->cast('void *', 1); $scope = new StructuredProbeScope($ffi); $caught = false;
            try { $convert->invoke(null, $value, $scope); }
            catch (\ValueError $expected) { $caught = true; }
            finally { $scope->close(); }
            ensure($caught); ++$malformed;
        }
    }
}
ensure($malformed >= 10 && live() === $baseline);
ensure(StructuredFaults::$faults === array_sum(array_column($reports, 'faults')));
echo json_encode(['checks' => StructuredFaults::$checks, 'faults' => StructuredFaults::$faults,
    'clears' => StructuredFaults::$clears, 'closes' => StructuredFaults::$closes, 'malformed' => $malformed,
    'conversionMethods' => $conversions, 'shapes' => $reports], JSON_THROW_ON_ERROR), "\n";
