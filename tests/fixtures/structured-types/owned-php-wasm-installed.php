<?php
declare(strict_types=1);

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Payload, Bundle, TreeLeaf, TreeBranch, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, ChainStop, ChainLink, Mixed_};
use LeanOwnedAggregates\Internal\Resource;

$checks = 0;
function check(bool $value, string $message = ''): void {
    global $checks; $checks++;
    if (!$value) throw new RuntimeException('Installed owned PHP-Wasm: ' . $message);
}
function call_value(string $name, array $arguments): mixed {
    $fn = 'LeanOwnedAggregates\\' . $name; return $fn(...$arguments);
}
function reject(callable $call, ?int $code = null, ?string $class = null): Throwable {
    try { $call(); } catch (Throwable $error) {
        check($code === null || $code === $error->getCode(), get_class($error) . ': ' . $error->getMessage());
        check($class === null || $error instanceof $class, get_class($error) . ': ' . $error->getMessage()); return $error;
    }
    throw new RuntimeException('Missing installed rejection');
}
function dispose(mixed $value): void {
    $stack = [$value]; $seen = new SplObjectStorage();
    while ($stack) {
        $item = array_pop($stack);
        if (is_object($item)) {
            if ($seen->contains($item)) continue;
            $seen->attach($item);
            if ($item instanceof Resource) { $item->close(); continue; }
            $item = get_object_vars($item);
        }
        if (is_array($item)) foreach ($item as $child) $stack[] = $child;
    }
}
function semantic(mixed $value): mixed {
    if ($value instanceof LeanOwnedAggregates\Ticket) return ['ticket', (string) call_value('serial', [$value]), call_value('label', [$value])];
    if ($value instanceof Big) return ['integer', (string) $value];
    if ($value instanceof Bytes) return ['bytes', $value->toString()];
    if (is_float($value)) return ['float', is_nan($value) ? 'nan' : pack('e', $value)];
    if (is_object($value)) return [$value::class, array_map(semantic(...), get_object_vars($value))];
    if (is_array($value)) return array_map(semantic(...), $value);
    return $value;
}
function same_result(mixed $expected, callable $call): void {
    $value = $call();
    try { check(semantic($value) === semantic($expected), 'typed roundtrip'); }
    finally { dispose($value); }
}

$first = call_value('new_ticket', [Big::of('340282366920938463463374607431768211457'), "first\0雪🙂"]);
$second = call_value('new_ticket', [Big::of(42), 'second']);
$payload = new Payload(Big::of('-340282366920938463463374607431768211457'), Bytes::fromString("\xff\0bytes"));
$bundle = new Bundle($first, new Some($second), [$first, $second], [$second, $first], $payload);
$tree = new TreeBranch([new TreeLeaf($first), new TreeBranch([new TreeLeaf($second)])]);
$chain = new ChainLink($first, new Some(new ChainLink($second, new Some(new ChainStop()))));
$mixed = new Mixed_($first, [null, new Some(null), new Some(new Some(false)), new Some(new Some(true))],
    new Some(null), new Ok($bundle), Big::of('-99999999999999999999'), Big::of('99999999999999999999'),
    '🙂', -0.0, 1.5, Bytes::fromString("\xff\0data"), [Big::of(0), Big::of('18446744073709551615')],
    [$second, [new Some($first), $payload]], $chain);
$structured = 0;
foreach ([
    ['echo_array', []], ['echo_list', []], ['echo_array', [$first, $second]], ['echo_list', [$second, $first]],
    ['echo_option', null], ['echo_option', new Some($first)], ['echo_result', new Ok($bundle)], ['echo_result', new Err($first)],
    ['echo_tuple', [$first, [new Some($second), $payload]]], ['echo_record', $bundle], ['echo_alias', $bundle],
    ['echo_variant', new ChoiceEmpty()], ['echo_variant', new ChoiceOne($first)], ['echo_variant', new ChoicePair($first, $second)],
    ['echo_variant', new ChoiceMany([])], ['echo_variant', new ChoiceMany([$first, $second])],
    ['echo_row', [null, new Some($first)]], ['echo_recursive', $tree], ['echo_recursive', new TreeBranch([])],
    ['echo_chain', $chain], ['echo_chain', new ChainStop()], ['echo_nested', [[null, new Some(new Ok($bundle)), new Some(new Err($first))], []]],
    ['echo_mixed', $mixed]
] as [$name, $input]) { same_result($input, fn() => call_value($name, [$input])); $structured++; }
unset($input);
$copy = call_value('echo_mixed', [$mixed]);
check($copy !== $mixed && $copy->ticket !== $first && $copy->chain !== $chain);
check($copy->markers[0] === null && $copy->markers[1]->value === null && $copy->markers[2]->value->value === false);
check($copy->unit instanceof Some && $copy->unit->value === null && $copy->result instanceof Ok);
check($copy->result->value->payload->equals($payload));
check(pack('e', $copy->precise) === pack('e', -0.0));
dispose($copy); unset($copy);
$deep = new TreeLeaf($first);
for ($i = 0; $i < 40; $i++) $deep = new TreeBranch([$deep]);
same_result($deep, fn() => call_value('echo_recursive', [$deep])); unset($deep);
$reflection = new ReflectionClass(TreeBranch::class);
$cycle = $reflection->newInstanceWithoutConstructor(); $reflection->getProperty('children')->setValue($cycle, [$cycle]);
reject(fn() => call_value('echo_recursive', [$cycle]), null, ValueError::class); unset($cycle); gc_collect_cycles();
$deep = new TreeLeaf($first);
for ($i = 0; $i < 130; $i++) {
    $parent = $reflection->newInstanceWithoutConstructor(); $reflection->getProperty('children')->setValue($parent, [$deep]); $deep = $parent;
}
reject(fn() => call_value('echo_recursive', [$deep]), null, ValueError::class); unset($parent, $deep);
reject(fn() => call_value('echo_record', [$payload]), null, TypeError::class);
reject(fn() => call_value('echo_array', [['bad key' => $first]]), null, TypeError::class);

$escaped = null; $retained = null;
same_result($bundle, function() use ($bundle, &$escaped, &$retained) {
    return call_value('callback_record', [$bundle, function($value) use (&$escaped, &$retained) {
        $escaped = $value->primary; $retained = $value->primary->retain(); return $value;
    }]);
});
reject(fn() => call_value('serial', [$escaped]), 4);
check((string) call_value('serial', [$retained]) === '340282366920938463463374607431768211457');
$retained->close(); unset($escaped, $retained);
$sentinel = new RuntimeException('original installed callback failure');
check(reject(fn() => call_value('callback_record', [$bundle, function($value) use ($sentinel) { throw $sentinel; }])) === $sentinel);
$identity = call_value('identity_closure', [null]); $kept = $identity->retain(); $identity->close();
same_result($bundle, fn() => $kept($bundle)); $kept->close(); unset($identity, $kept);
$dispatch = call_value('dispatch', [$bundle]);
same_result($bundle, fn() => $dispatch(fn($value) => $value)); $dispatch->close(); unset($dispatch);
$expired = call_value('retain_callback', [fn($value) => $value]); reject(fn() => $expired($bundle), 10); $expired->close(); unset($expired);
$incoming = null; $saved = null;
same_result($bundle, function() use ($bundle, &$incoming, &$saved) {
    return call_value('with_function', [$bundle, function($fn, $value) use (&$incoming, &$saved) {
        $incoming = $fn; $saved = $fn->retain(); return $fn($value);
    }]);
});
reject(fn() => $incoming($bundle), 4); same_result($bundle, fn() => $saved($bundle)); $saved->close(); unset($incoming, $saved);
reject(fn() => call_value('factory', [fn($unit) => $first]), null, TypeError::class);
$made = call_value('factory', [LeanOwnedAggregates\with_recovery(fn($unit) => $first, $first)]);
check((string) call_value('serial', [$made]) === '340282366920938463463374607431768211457'); $made->close(); unset($made);
foreach ([null, 7, $first] as $bad) reject(fn() => call_value('callback_record', [$bundle, $bad]), null, TypeError::class);
unset($bad);
reject(fn() => call_value('callback_record', [$bundle, function(&$value) { return $value; }]), null, TypeError::class);
reject(fn() => call_value('callback_record', [$bundle, function($value) { yield $value; }]), null, TypeError::class);
reject(fn() => call_value('callback_record', [$bundle, fn() => null]), null, ArgumentCountError::class);

$scalars = 0;
$cases = [
    'unit' => [null, null], 'bool' => [true, false], 'char' => ['🙂', "\0"],
    'nat' => [Big::of('340282366920938463463374607431768211457'), Big::of(17)],
    'int' => [Big::of('-340282366920938463463374607431768211457'), Big::of(19)],
    'u8' => [255, 0], 'u16' => [65535, 0], 'u32' => [Big::of('4294967295'), Big::of(0)],
    'u64' => [Big::of('18446744073709551615'), Big::of(0)], 'i8' => [-128, 127], 'i16' => [-32768, 32767],
    'i32' => [PHP_INT_MIN, PHP_INT_MAX], 'i64' => [Big::of('-9223372036854775808'), Big::of('9223372036854775807')],
    'usize' => [Big::of('4294967295'), Big::of(7)], 'isize' => [PHP_INT_MIN, PHP_INT_MAX],
    'f32' => [-0.0, 1.5], 'f64' => [-0.0, -2.25], 'string' => ["a\0雪🙂", "reply\0🌱"],
    'bytes' => [Bytes::fromString("\0\xff"), Bytes::fromString("\xff\0reply")]
];
foreach ($cases as $name => [$input, $replacement]) {
    $called = 0;
    $output = call_value('via_' . $name, [function($value) use ($input, $replacement, &$called) {
        check(semantic($value) === semantic($input)); $called++; return $replacement;
    }, $input]);
    check($called === 1 && semantic($output) === semantic($replacement), $name . ' callback');
    check(reject(fn() => call_value('via_' . $name, [function($value) use ($sentinel) { throw $sentinel; }, $input])) === $sentinel);
    $scalars++;
}
foreach (['f32', 'f64'] as $name) foreach ([INF, -INF, NAN] as $value)
    same_result($value, fn() => call_value('via_' . $name, [fn($number) => $number, $value]));
dispose($mixed); dispose($chain); dispose($tree); dispose($bundle); $first->close(); $second->close();
unset($mixed, $chain, $tree, $bundle, $first, $second); gc_collect_cycles();
check(PHP_INT_SIZE === 4);
echo json_encode(['checks' => $checks, 'scalars' => $scalars, 'structured' => $structured, 'phpBits' => PHP_INT_SIZE * 8], JSON_THROW_ON_ERROR);
