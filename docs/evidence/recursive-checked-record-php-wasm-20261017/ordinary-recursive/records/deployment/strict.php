<?php
declare(strict_types=1);
// Independent recursive and mutual checked-record caller; executions require an installed package.
// The installer derives a strict_types=1 copy, so both caller modes run unchanged checks.

use Brick\Math\BigInteger;

const RECURSIVE_CHECKED_RECORD_EXPORTS = ['first', 'second', 'echo', 'groups', 'echo_groups', 'produce'];
const RECURSIVE_CHECKED_RECORD_MODULES = [
    'recursive' => ['lean' => 'RecursiveCheckedRecords', 'namespace' => 'LeanRecursivecheckedrecords', 'record' => 'Packet',
        'fields' => ['value', 'digit', 'tail'], 'make' => 'mkPacket', 'link' => '.tail?'],
    'mutual' => ['lean' => 'MutualCheckedRecords', 'namespace' => 'LeanMutualcheckedrecords', 'record' => 'Envelope',
        'fields' => ['value', 'mode', 'next'], 'make' => 'mkEnvelope', 'link' => '.next?.more.packet'],
];
const RECURSIVE_CHECKED_RECORD_LEAN_DIAGNOSTIC = '/ (?:is not below its Fin [0-9]+ bound|was rejected by [A-Za-z]+\.[A-Za-z]+)$/D';

/** Preserve exact public values, including BigInteger text, keys, class identity and cycles. */
function recursive_checked_record_snapshot(mixed $value, array $active = []): array {
    if ($value instanceof BigInteger) return ['bigint', (string) $value];
    if (is_int($value) || is_bool($value) || is_float($value) || is_string($value) || $value === null) return [gettype($value), $value];
    if (is_array($value)) {
        $items = [];
        foreach ($value as $key => $item) $items[] = [gettype($key), $key, recursive_checked_record_snapshot($item, $active)];
        return ['array', $items];
    }
    if (is_object($value)) {
        if (in_array($value, $active, true)) return ['cycle'];
        $active[] = $value; $items = [];
        // Reflection also reads readonly properties left uninitialized by a malformed instance.
        foreach ((new ReflectionObject($value))->getProperties() as $property)
            $items[] = [$property->getName(), $property->isInitialized($value)
                ? recursive_checked_record_snapshot($property->getValue($value), $active) : ['uninitialized']];
        return [get_class($value), $items];
    }
    throw new RuntimeException('Unsupported recursive snapshot input: ' . get_debug_type($value));
}

/** Exercise every recursive checked-record site without consulting generated metadata. */
function check_recursive_checked_records_php(array $api, string $module, int $rounds = 64): array {
    if (!isset(RECURSIVE_CHECKED_RECORD_MODULES[$module]) || $rounds < 1 || $rounds > 1000) throw new InvalidArgumentException('Invalid recursive caller options');
    $spec = RECURSIVE_CHECKED_RECORD_MODULES[$module]; $ns = $spec['namespace'];
    $packet = "$ns\\{$spec['record']}"; $some = "$ns\\Some"; $error = "$ns\\LeanBridgeError";
    [$valueName, $boundName, $linkName] = $spec['fields'];
    $mutual = $module === 'mutual';
    $stopClass = "$ns\\StepStop"; $moreClass = "$ns\\StepMore";
    $rejected = " was rejected by {$spec['lean']}.";
    $bound = ".$boundName is not below its Fin 3 bound";
    $link = $spec['link']; $make = $spec['make'];
    $checks = $rejections = $hostRejections = $recoveries = $snapshots = $snapshotControls = 0;
    $n = fn(int|string|BigInteger $value): BigInteger => BigInteger::of($value);
    $build = fn($value, $digit, $tail) => new $packet($value, $digit, $tail);
    // The only module difference is how a present child is carried.
    $node = function (int|BigInteger $value, int|BigInteger $digit, ?object $tail = null) use ($build, $n, $some, $mutual, $moreClass): object {
        if ($tail === null) return $build($n($value), $n($digit), null);
        return $build($n($value), $n($digit), new $some($mutual ? new $moreClass($tail) : $tail));
    };
    $stop = fn(int $value, int $digit) => $mutual ? $build($n($value), $n($digit), new $some(new $stopClass())) : $node($value, $digit);
    $chain = function (array $pairs) use ($node): ?object {
        $tail = null;
        foreach (array_reverse($pairs) as [$value, $digit]) $tail = $node($value, $digit, $tail);
        return $tail;
    };
    // first/echo/groups select plus-one checks; second/echo_groups plus-two.
    $normalized = function (mixed $value, int $plus) use (&$normalized, $build, $some, $mutual, $stopClass, $moreClass, $spec): mixed {
        if ($value === null) return null;
        if ($value instanceof $some) return new $some($normalized($value->value, $plus));
        if ($mutual && $value instanceof $stopClass) return new $stopClass();
        if ($mutual && $value instanceof $moreClass) return new $moreClass($normalized($value->packet, $plus));
        [$head, $digit, $tail] = array_map(fn($name) => $value->$name, $spec['fields']);
        if ($plus === 2 && !$mutual) return $build($digit->plus(1), $digit, $normalized($tail, $plus));
        return $build($head->plus($plus), $digit, $normalized($tail, $plus));
    };
    $check = function (bool $condition, string $label) use (&$checks): void {
        if (!$condition) throw new RuntimeException('failed: ' . $label);
        ++$checks;
    };
    $unchanged = function (string $name, array $args, array $before) use ($check, &$snapshots): void {
        ++$snapshots;
        $check(recursive_checked_record_snapshot($args) === $before, $name . ' inputs unchanged');
    };
    $outcome = function (callable $invoke, array $args): array {
        try { return [$invoke(...$args), null]; }
        catch (Throwable $failure) { return [null, $failure]; }
    };
    $call = function (string $name, array $args, mixed $expected) use ($api, $check, $unchanged, $outcome): mixed {
        $before = recursive_checked_record_snapshot($args);
        [$result, $failure] = $outcome($api[$name], $args);
        if ($failure !== null) throw new RuntimeException("failed: $name unexpectedly threw " . get_class($failure) . ': ' . $failure->getMessage());
        $check(recursive_checked_record_snapshot($result) === recursive_checked_record_snapshot($expected), "$name exact result");
        $unchanged($name, $args, $before);
        return $result;
    };
    $refuse = function (string $name, array $args, string $expected) use ($api, $check, $unchanged, $outcome, $error, &$rejections): void {
        $before = recursive_checked_record_snapshot($args);
        [, $failure] = $outcome($api[$name], $args);
        if ($failure === null) throw new RuntimeException('failed: accepted invalid input: ' . $expected);
        $check(get_class($failure) === $error && $failure->getCode() === 1 && $failure->getMessage() === $expected,
            "exact refusal: $expected (got " . get_class($failure) . ' ' . $failure->getCode() . ': ' . $failure->getMessage() . ')');
        $unchanged($name, $args, $before);
        ++$rejections;
    };
    // PHP conversion refusals precede the adapter and never use the bridge error class.
    $hostRefuse = function (callable $invoke, array $args, array $kinds, string $label, ?string $message = null) use ($check, $unchanged, $outcome, $error, &$hostRejections): void {
        $before = recursive_checked_record_snapshot($args);
        [, $failure] = $outcome($invoke, $args);
        if ($failure === null) throw new RuntimeException('failed: accepted malformed input: ' . $label);
        $check(in_array(get_class($failure), $kinds, true) && !$failure instanceof $error
            && preg_match(RECURSIVE_CHECKED_RECORD_LEAN_DIAGNOSTIC, $failure->getMessage()) !== 1,
            "host refusal class: $label (got " . get_class($failure) . ': ' . $failure->getMessage() . ')');
        $check($message === null || $failure->getMessage() === $message, "host refusal text: $label");
        $unchanged($label, $args, $before);
        ++$hostRejections;
    };
    // Reflection builds instances the constructors refuse: cycles, deep chains and missing fields.
    $raw = function (string $class, array $properties): object {
        $value = (new ReflectionClass($class))->newInstanceWithoutConstructor();
        foreach ($properties as $name => $item) (new ReflectionProperty($value, $name))->setValue($value, $item);
        return $value;
    };
    $rawNode = fn(BigInteger $value, BigInteger $digit, ?object $tail) => $raw($packet, [$valueName => $value, $boundName => $digit,
        $linkName => $tail === null ? null : $raw($some, ['value' => $mutual ? $raw($moreClass, ['packet' => $tail]) : $tail])]);

    foreach (RECURSIVE_CHECKED_RECORD_EXPORTS as $name) $check(isset($api[$name]) && is_callable($api[$name]), "export: $name");
    $check(!class_exists("$packet" . 'Alias', false), 'alias stays a contract name, not a class');
    $check(array_map(fn($property) => $property->getName(), (new ReflectionClass($packet))->getProperties()) === $spec['fields'], 'ordered record fields');
    $pairs = [[$n(0), 0], [$n(1), 1.0], [[$node(1, 0)], $node(1, 0)], [[1 => $node(1, 0)], [$node(1, 0)]],
        [$node(1, 0), $node(1, 1)], [$node(1, 0), $node(2, 0)],
        [$node(1, 0, $node(1, 0)), $node(1, 0)], [new $some($node(1, 0)), null],
        [$chain([[1, 0], [1, 0]]), $chain([[1, 0], [2, 0]])]];
    if ($mutual) $pairs = array_merge($pairs, [[$stop(1, 0), $node(1, 0)], [new $some(new $stopClass()), null],
        [new $moreClass($node(1, 0)), new $some($node(1, 0))]]);
    foreach ($pairs as [$left, $right]) {
        $check(recursive_checked_record_snapshot($left) !== recursive_checked_record_snapshot($right), 'independent snapshot mutation');
        ++$snapshotControls;
    }

    // Constructor-free results: two linked records, words one and two above the input.
    $huge = $n(2)->power(100);
    $values = [$n(0), $n(5)];
    for ($round = 0; $round < $rounds; ++$round) $values[] = $huge->plus($round);
    foreach ($values as $value) $call('produce', [$value], $build($value->plus(1), $n(1), new $some($mutual
        ? new $moreClass($build($value->plus(2), $n(2), null)) : $build($value->plus(2), $n(2), null))));
    $hostRefuse($api['produce'], [true], [TypeError::class], 'bool Nat');
    $hostRefuse($api['produce'], [1], [TypeError::class], 'int Nat');
    $hostRefuse($api['produce'], [$n(-1)], [ValueError::class], 'negative Nat');
    $hostRefuse($api['produce'], [1.0], [TypeError::class], 'float Nat');

    // Every linked record passes its selected constructors before the outer one.
    $root = $chain([[40, 2], [80, 1]]);
    $call('first', [$root], $n(41));
    $call('first', [$node(0, 1)], $n(1));
    $call('first', [$chain([[99, 2], [0, 0], [7, 1]])], $n(100));
    $call('second', [$root], $n($mutual ? 42 : 3));
    $call('second', [$chain([[89, 2], [0, 1]])], $n($mutual ? 91 : 3));
    $call('echo', [$root], $normalized($root, 1));
    $long = $chain([[1, 0], [2, 1], [3, 2], [4, 0]]);
    $call('echo', [$long], $normalized($long, 1));
    $deep = $chain(array_map(fn($index) => [$index % 90, $index % 3], range(0, 39)));
    $call('first', [$deep], $n(1));
    $call('echo', [$deep], $normalized($deep, 1));
    $call('second', [$deep], $n($mutual ? 2 : 1));
    $shared = $node(5, 1);
    $call('groups', [[new $some($shared), null, new $some($shared)]], $n(3));
    $call('groups', [[]], $n(0));
    $call('groups', [[null, new $some($root)]], $n(2));
    $call('echo_groups', [[new $some($root), null, new $some($shared)]],
        [$normalized(new $some($root), 2), null, $normalized(new $some($shared), 2)]);
    $call('echo_groups', [[]], []);
    if ($mutual) {
        $call('first', [$stop(40, 2)], $n(41));
        $call('echo', [$stop(40, 2)], $stop(41, 2));
        $call('echo', [$node(1, 0, $stop(2, 1))], $node(2, 0, $stop(3, 1)));
        $call('second', [$node(1, 0, $stop(2, 1))], $n(3));
    }

    // Exact late-field and constructor paths through the recursive carrier.
    $refuse('first', [$node(100, 0)], "arg0.value{$rejected}plusOne");
    $refuse('first', [$node($huge, 0)], "arg0.value{$rejected}plusOne");
    $refuse('first', [$chain([[40, 2], [100, 1]])], "arg0$link.value{$rejected}plusOne");
    $refuse('first', [$chain([[40, 2], [40, 2], [100, 1]])], "arg0$link$link.value{$rejected}plusOne");
    $refuse('first', [$node(40, 3)], "arg0$bound");
    $refuse('first', [$chain([[40, 2], [80, 3]])], "arg0$link$bound");
    $refuse('first', [$node(0, 2)], "arg0$rejected$make");
    $refuse('first', [$chain([[40, 2], [0, 2]])], "arg0$link$rejected$make");
    $refuse('echo', [$chain([[40, 2], [0, 2]])], "arg0$link$rejected$make");
    $refuse('second', [$node(90, 0)], "arg0.value{$rejected}plusTwo");
    $refuse('second', [$chain([[1, 0], [90, 0]])], "arg0$link.value{$rejected}plusTwo");
    $refuse('groups', [[null, new $some($node(100, 0))]], "arg0[1]?.value{$rejected}plusOne");
    $refuse('groups', [[new $some($root), new $some($node(0, 2))]], "arg0[1]?$rejected$make");
    $refuse('groups', [[new $some($node(1, 3))]], "arg0[0]?$bound");
    $refuse('echo_groups', [[new $some($node(90, 0))]], "arg0[0]?.value{$rejected}plusTwo");
    $refuse('echo_groups', [[null, new $some($chain([[1, 0], [95, 1]]))]], "arg0[1]?$link.value{$rejected}plusTwo");

    // Malformed PHP values are host refusals, distinct from adapter rejections. Generated
    // constructors check their fields, so most malformed records never reach a call.
    $hostRefuse($api['first'], [new $some($node(1, 0))], [TypeError::class], 'option as record');
    $hostRefuse($build, [true, $n(0), null], [TypeError::class], 'bool value');
    $hostRefuse($build, [1, $n(0), null], [TypeError::class], 'int value');
    $hostRefuse($build, [$n(1), $n(-1), null], [ValueError::class], 'negative digit');
    $hostRefuse($build, [1.0, $n(0), null], [TypeError::class], 'float value');
    $hostRefuse($build, [$n(1), $n(0), $node(1, 0)], [TypeError::class], 'bare child');
    if ($mutual) {
        $hostRefuse($build, [$n(1), $n(0), new $some($node(1, 0))], [TypeError::class], 'record as step');
        $hostRefuse($build, [$n(1), $n(0), new $stopClass()], [TypeError::class], 'bare step');
    }
    $hostRefuse($api['groups'], [$node(1, 0)], [TypeError::class], 'record as array');
    $hostRefuse($api['groups'], [[$node(1, 0)]], [TypeError::class], 'bare record as option');
    $hostRefuse($api['groups'], [[1 => new $some($node(1, 0))]], [TypeError::class], 'keyed group');
    $hostRefuse($api['echo_groups'], [[new $some(null)]], [TypeError::class], 'absent record');
    $hostRefuse($api['first'], [$raw($packet, [$valueName => $n(1)])], [TypeError::class], 'uninitialized record');
    // Reflection may initialize a readonly property once, so the link is set after its target exists.
    $cyclic = $raw($packet, [$valueName => $n(1), $boundName => $n(0)]);
    (new ReflectionProperty($cyclic, $linkName))->setValue($cyclic, $raw($some, ['value' => $mutual ? $raw($moreClass, ['packet' => $cyclic]) : $cyclic]));
    $hostRefuse($api['first'], [$cyclic], [ValueError::class], 'cycle', 'Cyclic copied value');
    $hostRefuse($api['groups'], [[new $some($cyclic)]], [ValueError::class], 'cycle in group', 'Cyclic copied value');
    $deepRaw = null;
    for ($index = 0; $index < 100; ++$index) $deepRaw = $rawNode($n(1), $n(0), $deepRaw);
    $hostRefuse($api['first'], [$deepRaw], [ValueError::class], 'depth', 'Copied value exceeds 128 levels');

    // Rejection never poisons later calls: each refusal is followed by a success.
    for ($round = 0; $round < $rounds; ++$round) {
        $value = $round % 90;
        $call('first', [$chain([[$value, $value % 3], [99 - $value, 0]])], $n($value + 1));
        $refuse('first', [$chain([[$value, $value % 3], [100 + $round, 0]])], "arg0$link.value{$rejected}plusOne");
        $call('second', [$node($value, $round % 3)], $n($mutual ? $value + 2 : $round % 3 + 1));
        $refuse('groups', [[new $some($node($value, 0)), new $some($node(0, 2))]], "arg0[1]?$rejected$make");
        $hostRefuse($api['first'], [$cyclic], [ValueError::class], 'cycle recovery', 'Cyclic copied value');
        $call('groups', [array_fill(0, $round % 4, new $some($node($value, 0)))], $n($round % 4));
        ++$recoveries;
    }
    return ['checks' => $checks, 'hostRejections' => $hostRejections, 'module' => $module, 'recoveries' => $recoveries,
        'rejections' => $rejections, 'rounds' => $rounds, 'snapshotControls' => $snapshotControls, 'snapshots' => $snapshots];
}

    // Each consumer installs exactly one package; its namespace selects the module.
    $installed = array_keys(array_filter(RECURSIVE_CHECKED_RECORD_MODULES, fn($spec) => function_exists($spec['namespace'] . '\\first')));
    if (count($installed) !== 1) throw new RuntimeException('Expected exactly one installed recursive checked-record package');
    $module = $installed[0]; $namespace = RECURSIVE_CHECKED_RECORD_MODULES[$module]['namespace'];
    // PHP reserves echo, so the generated function carries one trailing underscore.
    $api = [];
    foreach (RECURSIVE_CHECKED_RECORD_EXPORTS as $name) {
        $qualified = "$namespace\\" . ($name === 'echo' ? 'echo_' : $name);
        if (function_exists($qualified)) $api[$name] = $qualified;
    }
    $observed = check_recursive_checked_records_php($api, $module);
    echo json_encode([...$observed, 'word_bits' => PHP_INT_SIZE * 8, 'php' => PHP_VERSION], JSON_THROW_ON_ERROR) . "\n";
