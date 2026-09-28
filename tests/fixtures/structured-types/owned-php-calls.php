<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Payload, Bundle, TreeLeaf, TreeBranch};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{new_ticket, callback_record, with_recovery};

reject(fn() => new_ticket(42, 'invalid'), null, TypeError::class);
reject(fn() => owned_call('viaBool', [fn($value) => $value, 1]), null, TypeError::class);
check($loads === 0, 'cold invalid calls do not load native code');
$first = new_ticket(Big::of(1), 'first'); $second = new_ticket(Big::of(2), 'second');
$payload = new Payload(Big::of(-3), Bytes::fromString('abc'));
$bundle = new Bundle($first, new Some($second), [$first, $second], [$second], $payload);
$escaped = []; $retained = []; $locals = [];
$result = callback_record($bundle, static function($value) use (&$escaped, &$retained, &$locals) {
    $escaped[] = $value->primary; $retained[] = $value->primary->retain();
    $local = new_ticket(Big::of(91), 'local'); $locals[] = $local;
    return replace_value($value, ['primary' => $local, 'payload' => new Payload(Big::of(7), Bytes::fromString('reply'))]);
});
reject(fn() => owned_call('serial', [$escaped[0]]), 4);
check((string) owned_call('serial', [$retained[0]]) === '1');
check((string) owned_call('serial', [$result->primary]) === '91');
check((string) $result->payload->count === '7' && $result->payload->bytes->toString() === 'reply');
dispose($result); dispose($retained); dispose($locals); unset($result, $retained, $locals);
same_result($bundle, fn() => callback_record($bundle, fn($value) => $value));

$sentinel = new RuntimeException('Original PHP callback failure');
$fail = static function($value) use ($sentinel, &$escaped) { $escaped[] = $value->primary; throw $sentinel; };
check(reject(fn() => callback_record($bundle, $fail)) === $sentinel);
$failedInvocations = 0;
$failOnce = static function($value) use ($sentinel, &$failedInvocations) { $failedInvocations++; throw $sentinel; };
check(reject(fn() => owned_call('twice', [$bundle, $failOnce])) === $sentinel);
check($failedInvocations === 1, 'skip later callbacks after the first failure');
reject(fn() => owned_call('serial', [$escaped[array_key_last($escaped)]]), 4);
same_result($bundle, fn() => owned_call('echoRecord', [$bundle]));
same_result($bundle, fn() => callback_record($bundle, static function($value) use ($fail, $sentinel) {
    check(reject(fn() => callback_record($value, $fail)) === $sentinel);
    return $value;
}));
$counter = 0;
$mutate = static function($value) use (&$counter) { return replace_value($value, ['payload' => new Payload(Big::of(++$counter), Bytes::fromString('count'))]); };
$result = owned_call('twice', [$bundle, $mutate]); check((string) $result->payload->count === '2'); dispose($result); unset($result);
$dispatch = owned_call('dispatch', [$bundle]);
$result = $dispatch($mutate); check((string) $result->payload->count === '3'); dispose($result); unset($result);
$identity = owned_call('identityClosure', [null]);
same_result($bundle, fn() => $dispatch($identity));
same_result($bundle, fn() => callback_record($bundle, $identity));
$kept = owned_call('retainCallback', [$identity]); $identity->close();
same_result($bundle, fn() => $kept($bundle)); $kept->close();
$expired = owned_call('retainCallback', [fn($value) => $value]);
reject(fn() => $expired($bundle), 10); $expired->close();
$recordClosure = owned_call('makeRecord', [$bundle]);
same_result($bundle, fn() => $recordClosure(true, $bundle));
$recordClosure->close(); unset($recordClosure);
same_result($bundle, fn() => $dispatch(static function($value) use ($dispatch) { $dispatch->close(); return $value; }));
reject(fn() => $dispatch(fn($value) => $value), 4);
unset($identity, $kept, $expired, $dispatch);

reject(fn() => owned_call('factory', [fn($unit) => $first]), null, TypeError::class);
reject(fn() => owned_call('factory', [with_recovery(fn($unit) => $first, $bundle)]), null, TypeError::class);
$made = owned_call('factory', [with_recovery(static function($unit) use ($first) { check($unit === null); return $first; }, $first)]);
check((string) owned_call('serial', [$made]) === '1'); $made->close(); unset($made);
check(reject(fn() => owned_call('factory', [with_recovery(static function($unit) use ($sentinel) { throw $sentinel; }, $first)])) === $sentinel);
same_result($bundle, fn() => owned_call('construct', [$first, fn($ticket) => replace_value($bundle, ['primary' => $ticket])]));
$tree = new TreeBranch([new TreeLeaf($first), new TreeLeaf($second)]);
same_result($tree, fn() => owned_call('callbackRecursive', [$tree, fn($value) => $value]));
$incoming = null; $saved = null;
same_result($bundle, static function() use ($bundle, &$incoming, &$saved) {
    return owned_call('withFunction', [$bundle, static function($function, $value) use (&$incoming, &$saved) {
        $incoming = $function; $saved = $function->retain(); return $function($value);
    }]);
});
reject(fn() => $incoming($bundle), 4);
same_result($bundle, fn() => $saved($bundle)); $saved->close(); unset($incoming, $saved);
$victim = new_ticket(Big::of(93), 'pinned');
$pinned = replace_value($bundle, ['primary' => $victim, 'spare' => null, 'peers' => [], 'history' => []]);
$result = callback_record($pinned, static function($value) use ($victim) { $victim->close(); return $value; });
check((string) owned_call('serial', [$result->primary]) === '93'); dispose($result); unset($result, $victim, $pinned);

foreach ([null, 7] as $bad) reject(fn() => callback_record($bundle, $bad), null, TypeError::class);
reject(fn() => callback_record($bundle, fn($value) => $value->primary), null, TypeError::class);
reject(fn() => callback_record($bundle, fn($value) => new Fiber(fn() => null)), null, TypeError::class);
reject(fn() => callback_record($bundle, static function(&$value) { return $value; }), null, TypeError::class);
reject(fn() => callback_record($bundle, static function($value) { yield $value; }), null, TypeError::class);
reject(fn() => callback_record($bundle, fn() => null), null, ArgumentCountError::class);
reject(fn() => callback_record($bundle, static function($value) { Fiber::suspend(); return $value; }), null, FiberError::class);
reject(fn() => callback_record($bundle, static function($value) { Native::close(); return $value; }), null, LogicException::class);
$fiber = new Fiber(static function() use ($bundle): void { reject(fn() => callback_record($bundle, fn($value) => $value), 5); });
$fiber->start(); check($fiber->isTerminated()); unset($fiber);
$reentries = 0; $recursive = null;
$recursive = static function($value) use (&$recursive, &$reentries) { $reentries++; return callback_record($value, $recursive); };
reject(fn() => callback_record($bundle, $recursive), 2);
check($reentries > 1 && $reentries <= 64, 'native scopes bound recursive callback reentry');
unset($recursive);
same_result($bundle, fn() => callback_record($bundle, fn($value) => $value));

$scalarCalls = 0;
$cases = [
    'Unit' => [null, null], 'Bool' => [true, false], 'Char' => ['🙂', "\0"],
    'Nat' => [Big::of('340282366920938463463374607431768211457'), Big::of(17)],
    'Int' => [Big::of('-340282366920938463463374607431768211457'), Big::of(19)],
    'U8' => [255, 0], 'U16' => [65535, 0], 'U32' => [4294967295, 0],
    'U64' => [Big::of('18446744073709551615'), Big::of(0)],
    'I8' => [-128, 127], 'I16' => [-32768, 32767], 'I32' => [-2147483648, 2147483647], 'I64' => [PHP_INT_MIN, PHP_INT_MAX],
    'Usize' => [Big::of('18446744073709551615'), Big::of(7)], 'Isize' => [PHP_INT_MIN, PHP_INT_MAX],
    'F32' => [-0.0, 1.5], 'F64' => [-0.0, -2.25],
    'String' => ["a\0雪🙂", "reply\0🌱"], 'Bytes' => [Bytes::fromString("\0\xff"), Bytes::fromString("\xff\0reply")]
];
foreach ($cases as $name => [$input, $replacement]) {
    $called = 0;
    $output = owned_call('via' . $name, [static function($value) use ($input, $replacement, &$called) {
        check(semantic_value($value) === semantic_value($input)); $called++; return $replacement;
    }, $input]);
    check($called === 1); check(semantic_value($output) === semantic_value($replacement), $name . ' reply'); $scalarCalls++;
    check(reject(fn() => owned_call('via' . $name, [static function($value) use ($sentinel) { throw $sentinel; }, $input])) === $sentinel);
    same_result($replacement, fn() => owned_call('via' . $name, [fn($value) => $replacement, $input]));
}
foreach (['F32', 'F64'] as $name) foreach ([INF, -INF, NAN] as $value)
    same_result($value, fn() => owned_call('via' . $name, [fn($number) => $number, $value]));

$count = 0;
reject(static function() use ($bundle, &$count) {
    return owned_call('repeatedly', [$bundle, static function($value) use (&$count) { $count++; return $value; }, Big::of(10000)]);
}, 2);
check($count > 1 && $count < 10000, 'bounded callbacks');
same_result($bundle, fn() => callback_record($bundle, fn($value) => $value));
[$phpFailures, $nativeFailures] = fault_sweep(fn() => callback_record($bundle, fn($value) => $value));
[$factoryPhpFailures, $factoryNativeFailures] = fault_sweep(fn() => owned_call('factory', [with_recovery(fn($unit) => $first, $first)]));
$phpFailures += $factoryPhpFailures; $nativeFailures += $factoryNativeFailures;
foreach ($escaped as $value) reject(fn() => owned_call('serial', [$value]), 4);
unset($escaped);
dispose($tree); dispose($bundle); $first->close(); $second->close();
unset($tree, $bundle, $first, $second); gc_collect_cycles(); Native::close();
check($loads === 1, 'one authenticated lazy load');
check($ffi->owned_test_live() === 0, 'final allocations'); check($ffi->owned_test_identities() === 0, 'final identities');
echo json_encode(['checks' => $checks, 'primitives' => 19, 'scalarCalls' => $scalarCalls, 'boundedInvocations' => $count, 'reentries' => $reentries,
    'phpFailures' => $phpFailures, 'nativeFailures' => $nativeFailures,
    'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]), "\n";
