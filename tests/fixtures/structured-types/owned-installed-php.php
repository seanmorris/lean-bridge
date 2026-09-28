<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates as Api;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Ticket, Payload, Bundle, Mixed_, ChainStop, ChainLink, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, TreeLeaf, TreeBranch};

$checks = 0; $calls = [];
function check(bool $condition, string $message = ''): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException('Installed PHP: ' . $message);
}
function invoke(string $name, mixed ...$arguments): mixed {
    global $calls; $calls[$name] = true;
    return ('LeanOwnedAggregates\\' . $name)(...$arguments);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $error->getCode() === $code, $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error));
        return $error;
    }
    throw new RuntimeException('Expected rejection');
}
function dispose(mixed $value): void {
    $stack = [$value]; $seen = new SplObjectStorage();
    while ($stack) {
        $item = array_pop($stack);
        if (is_object($item)) {
            if ($seen->contains($item)) continue;
            $seen->attach($item);
            if ($item instanceof Ticket || (is_callable($item) && method_exists($item, 'close'))) { $item->close(); continue; }
            $item = get_object_vars($item);
        }
        if (is_array($item)) foreach ($item as $child) $stack[] = $child;
    }
}
function semantic(mixed $value): mixed {
    if ($value instanceof Ticket) return ['ticket', (string) invoke('serial', $value), invoke('label', $value)];
    if ($value instanceof Big) return ['integer', (string) $value];
    if ($value instanceof Bytes) return ['bytes', $value->toString()];
    if (is_float($value)) return ['float', is_nan($value) ? 'nan' : pack('e', $value)];
    if (is_object($value)) return [$value::class, array_map(semantic(...), get_object_vars($value))];
    if (is_array($value)) return array_map(semantic(...), $value);
    return $value;
}
function same_result(mixed $expected, callable $call): void {
    $actual = $call();
    try { check(semantic($actual) === semantic($expected), 'value and constructor identity'); }
    finally { dispose($actual); }
}

reject(fn() => invoke('new_ticket', 42, 'coercion'), null, TypeError::class);
reject(fn() => invoke('via_bool', fn($value) => $value, 1), null, TypeError::class);
check(!str_contains(file_get_contents('/proc/self/maps'), 'libleanshared.so'), 'cold validation stays lazy');
$first = invoke('new_ticket', Big::of('340282366920938463463374607431768211457'), "first\0雪");
$second = invoke('new_ticket', Big::of(2), 'second');
$payload = new Payload(Big::of('-340282366920938463463374607431768211457'), Bytes::fromString("\xff\0abc"));
$bundle = new Bundle($first, new Some($second), [$first, $second], [$second], $payload);
check($bundle->equals(new Bundle($first, new Some($second), [$first, $second], [$second], $payload)));
check($bundle->hashCode() === (new Bundle($first, new Some($second), [$first, $second], [$second], $payload))->hashCode());
same_result($first, fn() => invoke('retain_ticket', $first));
same_result($bundle, fn() => invoke('bundle', $first, new Some($second), [$first, $second], [$second], $payload));
same_result($first, fn() => invoke('primary', $bundle));
same_result($payload, fn() => invoke('payload', $bundle));
foreach (['echo_array', 'echo_list'] as $name) foreach ([[], [$first, $second, $first]] as $value)
    same_result($value, fn() => invoke($name, $value));
foreach ([null, new Some($first)] as $value) same_result($value, fn() => invoke('echo_option', $value));
foreach ([new Ok($bundle), new Err($second)] as $value) same_result($value, fn() => invoke('echo_result', $value));
$product = [$first, [new Some($second), $payload]];
same_result($product, fn() => invoke('echo_tuple', $product));
foreach (['echo_record', 'echo_alias'] as $name) same_result($bundle, fn() => invoke($name, $bundle));
foreach ([new ChoiceEmpty(), new ChoiceOne($first), new ChoicePair($first, $second), new ChoiceMany([]), new ChoiceMany([$first, $second])] as $value)
    same_result($value, fn() => invoke('echo_variant', $value));
foreach ([[], [null, new Some($first), new Some($second)]] as $value) same_result($value, fn() => invoke('echo_row', $value));
$tree = new TreeBranch([new TreeLeaf($first), new TreeBranch([]), new TreeLeaf($second)]);
same_result($tree, fn() => invoke('echo_recursive', $tree));
$deep = new TreeLeaf($first);
for ($index = 0; $index < 35; $index++) $deep = new TreeBranch([$deep]);
same_result($deep, fn() => invoke('echo_recursive', $deep));
$nested = [[], [null, new Some(new Ok($bundle)), new Some(new Err($second))]];
same_result($nested, fn() => invoke('echo_nested', $nested));
$chain = new ChainLink($first, new Some(new ChainLink($second, null)));
foreach ([new ChainStop(), $chain] as $value) same_result($value, fn() => invoke('echo_chain', $value));
foreach ([null, new Some(null)] as $unit) foreach ([new Ok($bundle), new Err($second)] as $result) {
    $mixed = new Mixed_($first, [null, new Some(null), new Some(new Some(false)), new Some(new Some(true))],
        $unit, $result, Big::of(-123), Big::of('18446744073709551616'), '🙂', -0.0, 1.5,
        Bytes::fromString("\0\xff"), [Big::of(0), Big::of('18446744073709551615')], $product, $chain);
    same_result($mixed, fn() => invoke('echo_mixed', $mixed));
}

$escaped = null; $retained = null;
same_result($bundle, static function() use ($bundle, &$escaped, &$retained) {
    return invoke('callback_record', $bundle, static function($value) use (&$escaped, &$retained) {
        $escaped = $value->primary; $retained = $value->primary->retain(); return $value;
    });
});
reject(fn() => invoke('serial', $escaped), 4);
check(semantic($retained) === semantic($first)); $retained->close();
same_result($tree, fn() => invoke('callback_recursive', $tree, fn($value) => $value));
$record = invoke('make_record', $bundle); same_result($bundle, fn() => $record(true, $bundle)); $record->close();
$recursive = invoke('make_recursive', $tree); same_result($tree, fn() => $recursive(false, $tree)); $recursive->close();
$identity = invoke('identity_closure', null);
$kept = invoke('retain_callback', $identity); $identity->close();
same_result($bundle, fn() => $kept($bundle)); $kept->close();
$expired = invoke('retain_callback', fn($value) => $value); reject(fn() => $expired($bundle), 10); $expired->close();
$sentinel = new RuntimeException('Original installed callback failure');
$fail = static function($value) use ($sentinel) { throw $sentinel; };
check(reject(fn() => invoke('callback_record', $bundle, $fail)) === $sentinel);
same_result($bundle, fn() => invoke('callback_record', $bundle, static function($value) use ($fail, $sentinel) {
    check(reject(fn() => invoke('callback_record', $value, $fail)) === $sentinel); return $value;
}));
$counter = 0;
$mutate = static function($value) use (&$counter) {
    return new Bundle($value->primary, $value->spare, $value->peers, $value->history, new Payload(Big::of(++$counter), Bytes::fromString('reply')));
};
$reply = invoke('twice', $bundle, $mutate); check((string) $reply->payload->count === '2'); dispose($reply); unset($reply);
same_result($bundle, fn() => invoke('repeatedly', $bundle, fn($value) => $value, Big::of(20)));
reject(fn() => invoke('factory', fn($unit) => $first), null, TypeError::class);
same_result($first, fn() => invoke('factory', Api\with_recovery(fn($unit) => $first, $first)));
check(reject(fn() => invoke('factory', Api\with_recovery($fail, $first))) === $sentinel);
same_result($bundle, fn() => invoke('construct', $first, fn($ticket) => new Bundle($ticket, $bundle->spare, $bundle->peers, $bundle->history, $payload)));
$dispatch = invoke('dispatch', $bundle); same_result($bundle, fn() => $dispatch(fn($value) => $value)); $dispatch->close();
$borrowedFunction = null; $savedFunction = null;
same_result($bundle, static function() use ($bundle, &$borrowedFunction, &$savedFunction) {
    return invoke('with_function', $bundle, static function($function, $value) use (&$borrowedFunction, &$savedFunction) {
        $borrowedFunction = $function; $savedFunction = $function->retain(); return $function($value);
    });
});
reject(fn() => $borrowedFunction($bundle), 4);
same_result($bundle, fn() => $savedFunction($bundle)); $savedFunction->close();

$scalars = [
    'unit' => [null, null], 'bool' => [true, false], 'char' => ['🙂', "\0"],
    'nat' => [Big::of('340282366920938463463374607431768211457'), Big::of(17)],
    'int' => [Big::of('-340282366920938463463374607431768211457'), Big::of(19)],
    'u8' => [255, 0], 'u16' => [65535, 0], 'u32' => [4294967295, 0], 'u64' => [Big::of('18446744073709551615'), Big::of(0)],
    'i8' => [-128, 127], 'i16' => [-32768, 32767], 'i32' => [-2147483648, 2147483647], 'i64' => [PHP_INT_MIN, PHP_INT_MAX],
    'usize' => [Big::of('18446744073709551615'), Big::of(7)], 'isize' => [PHP_INT_MIN, PHP_INT_MAX],
    'f32' => [-0.0, 1.5], 'f64' => [-0.0, -2.25], 'string' => ["a\0雪🙂", "reply\0🌱"],
    'bytes' => [Bytes::fromString("\0\xff"), Bytes::fromString("\xff\0reply")]
];
foreach ($scalars as $name => [$input, $replacement]) {
    $called = 0;
    $output = invoke('via_' . $name, static function($value) use ($input, $replacement, &$called) {
        check(semantic($value) === semantic($input)); $called++; return $replacement;
    }, $input);
    check($called === 1); check(semantic($output) === semantic($replacement));
    check(reject(fn() => invoke('via_' . $name, $fail, $input)) === $sentinel);
    same_result($replacement, fn() => invoke('via_' . $name, fn($value) => $replacement, $input));
}
foreach (['f32', 'f64'] as $name) foreach ([INF, -INF, NAN] as $value)
    same_result($value, fn() => invoke('via_' . $name, fn($number) => $number, $value));
foreach ([null, 7, fn() => null, static function(&$value) { return $value; }, static function($value) { yield $value; }] as $bad)
    reject(fn() => invoke('callback_record', $bundle, $bad));
reject(fn() => invoke('echo_array', [1 => $first]));
reject(fn() => invoke('echo_result', new Some($bundle)));
reject(fn() => invoke('echo_tuple', [$first, new Some($second), $payload]));
reject(fn() => invoke('via_nat', fn($value) => $value, Big::of(-1)));
reject(fn() => invoke('via_char', fn($value) => $value, 'two'));
reject(fn() => invoke('echo_record', (new ReflectionClass(Bundle::class))->newInstanceWithoutConstructor()));
reject(fn() => clone $first); reject(fn() => serialize($first));
$fiber = new Fiber(static function() use ($bundle) { reject(fn() => invoke('echo_record', $bundle), 5); });
$fiber->start(); check($fiber->isTerminated());
same_result($bundle, fn() => invoke('echo_record', $bundle));
$victim = invoke('new_ticket', Big::of(93), 'pinned');
$pinned = new Bundle($victim, null, [], [], $payload);
$reply = invoke('callback_record', $pinned, static function($value) use ($victim) { $victim->close(); return $value; });
check((string) invoke('serial', $reply->primary) === '93'); dispose($reply); unset($reply);
dispose([$mixed, $chain, $tree, $deep, $bundle]); $first->close(); $second->close(); gc_collect_cycles();
reject(fn() => invoke('serial', $first), 4);
ksort($calls);
echo json_encode(['checks' => $checks, 'primitives' => count($scalars), 'functions' => array_keys($calls),
    'ordinaryAutoload' => true, 'phpVersion' => PHP_VERSION, 'iniDisabled' => php_ini_loaded_file() === false], JSON_THROW_ON_ERROR), "\n";
