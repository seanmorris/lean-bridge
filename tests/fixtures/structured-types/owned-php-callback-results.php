<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bundle, Bytes, Payload, Some, TreeBranch, TreeLeaf, Value};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\{copy_value, with_recovery};

function record_is(Value $value, string $message): void {
    $raw = $value->get();
    check((string) owned_call('serial', [$raw->primary]) === '63', $message);
    check((string) $raw->payload->count === '-17' && $raw->payload->bytes->toString() === "\0\xff\3", $message . ' payload');
}
function balanced(array $baseline, string $message): void {
    global $ffi;
    gc_collect_cycles();
    check([$ffi->owned_test_live(), $ffi->owned_test_identities()] === $baseline, $message . ' native cleanup');
}
function native_cases(Bundle $raw): void {
    $owner = owned_call('makeRecordCallback', [$raw]); $closure = $owner->get();
    $argument = $closure->copyArg(0, $raw); $reply = $owner->copyResult($raw);
    record_is($argument, 'callback-local argument copy'); record_is($reply, 'callback-local result copy');
    foreach ([-1, 1, '0', 0.0, null] as $index) reject(fn() => $closure->copyArg($index, $raw));
    $out = owned_call('callbackRecord', [$raw, $closure]); record_is($out, 'native callback parameter'); $out->close();
    $out = owned_call('callbackRecord', [$raw, $owner]); record_is($out, 'whole native callback parameter'); $out->close();
    $out = owned_call('applyTwice', [$raw, $closure, $owner]); record_is($out, 'mixed raw and whole native callbacks'); $out->close();
    $dispatch = owned_call('dispatch', [$raw]);
    $out = $dispatch($owner); record_is($out, 'whole native callback in returned higher-order closure'); $out->close();
    $original = owned_call('echoRecord', [$raw]); $originalAlias = $original->share();
    $view = $closure($original); $child = $owner($view); $alias = $child->share();
    $retained = $child->retain(); $copied = copy_value($child->get());
    $leaves = [$child->get()->primary, $child->get()->peers[0], $child->get()->spare->value];
    $original->close(); check(!$child->closed(), 'original shared owner remains active');
    $originalAlias->close();
    foreach ([$view, $child, $alias] as $expired) {
        check($expired->closed(), 'callback descendants inherit original argument expiration');
        reject(fn() => $expired->get(), 4);
    }
    foreach ($leaves as $leaf) reject(fn() => owned_call('serial', [$leaf]), 4);
    record_is($retained, 'independent retain survives original expiration');
    record_is($copied, 'independent copy survives original expiration');
    $again = $closure($argument); record_is($again, 'closure remains usable after argument expiration');
    $owner->close(); reject(fn() => $closure->copyArg(0, $raw), 4);
    reject(fn() => $owner->copyResult($raw), 4);
    record_is($argument, 'factory copy survives closure close');
    dispose([$owner, $closure, $argument, $reply, $dispatch, $original, $originalAlias,
        $view, $child, $alias, $retained, $copied, $again, $leaves]);

    $owner = owned_call('makeRecord', [$raw]); $argument = $owner->copyArg(1, $raw);
    reject(fn() => $owner->copyArg(0, false));
    $result = $owner(false, $argument); record_is($result, 'visible callback anchor excludes private closure parameter');
    $argument->close(); check($result->closed(), 'second visible argument anchors result');
    dispose([$owner, $argument, $result]);

    foreach ([new TreeBranch([]), new TreeBranch([new TreeLeaf($raw->primary)])] as $tree) {
        $owner = owned_call('makeTreeCallback', [$tree]);
        $argument = $owner->copyArg(0, $tree); $result = $owner($argument); $kept = $result->retain();
        check($result->get() instanceof TreeBranch, 'recursive callback value');
        $argument->close(); check($result->closed(), 'empty and populated callback owners expire');
        reject(fn() => $result->get(), 4);
        check($kept->get() instanceof TreeBranch, 'independent recursive retain survives');
        dispose([$owner, $argument, $result, $kept]);
    }
}
function host_cases(Bundle $raw): void {
    $escaped = null;
    $out = owned_call('callbackRecord', [$raw, static function($argument) use (&$escaped) {
        $escaped = $argument->primary; return $argument;
    }]);
    record_is($out, 'raw host reply'); reject(fn() => owned_call('serial', [$escaped]), 4);
    dispose([$out, $escaped]);
    $reply = owned_call('echoRecord', [$raw]);
    $out = owned_call('callbackRecord', [$raw, static fn($argument) => $reply]);
    $reply->close(); record_is($out, 'whole host reply copied before owner close');
    reject(fn() => owned_call('callbackRecord', [$raw, static fn($argument) => $reply]), 4);
    dispose([$reply, $out]);
    $out = owned_call('callbackRecord', [$raw, static fn($argument) => owned_call('echoRecord', [$argument])]);
    record_is($out, 'temporary whole host reply pinned through handoff'); $out->close();

    $native = owned_call('makeRecordCallback', [$raw]); $closure = $native->get();
    $host = static fn($argument) => $argument;
    foreach ([[$closure, $host], [$host, $native], [$host, $host]] as $callbacks) {
        $out = owned_call('applyTwice', [$raw, ...$callbacks]); record_is($out, 'mixed native and host callbacks'); $out->close();
    }
    $dispatch = owned_call('dispatch', [$raw]);
    $out = $dispatch($host); record_is($out, 'host argument in returned higher-order closure');
    dispose([$native, $closure, $dispatch, $out]);
    $expected = new RuntimeException('callback original exception');
    $throwing = static function($argument) use ($expected) { throw $expected; };
    check(reject(fn() => owned_call('callbackRecord', [$raw, $throwing])) === $expected, 'original callback exception identity');
    foreach ([$raw, owned_call('echoRecord', [$raw])] as $recovery) {
        check(reject(fn() => owned_call('callbackRecord', [$raw, with_recovery($throwing, $recovery)])) === $expected,
            'raw and whole recovery preserve original exception');
        if ($recovery instanceof Value) {
            $recovery->close(); $calls = 0;
            $callback = static function($argument) use (&$calls) { $calls++; return $argument; };
            reject(fn() => owned_call('callbackRecord', [$raw, with_recovery($callback, $recovery)]), 4);
            check($calls === 0, 'closed whole recovery rejected before callback entry');
        }
    }
    $tree = new TreeBranch([]); $reply = owned_call('echoRecursive', [$tree]);
    $out = owned_call('callbackRecursive', [$tree, static fn($argument) => $reply]);
    check($out->get() instanceof TreeBranch, 'empty whole host reply');
    $reply->close(); reject(fn() => owned_call('callbackRecursive', [$tree, static fn($argument) => $reply]), 4);
    dispose([$reply, $out]);
}
function combined_cases(Bundle $raw): void {
    global $ffi;
    $native = owned_call('makeRecordCallback', [$raw]); $closure = $native->get();
    $host = static fn($argument) => $argument;
    foreach ([[$host, $host], [$closure, $host], [$host, $native], [$closure, $closure]] as $callbacks) {
        $receiver = owned_call('echoRecord', [$raw]); $alias = $receiver->share();
        $view = $receiver->borrowRecord(); $retained = $receiver->retain();
        $before = $ffi->owned_test_handoffs(); $out = $receiver->moveTwice(...$callbacks);
        check($receiver->closed() && $alias->closed() && $view->closed(), 'consuming receiver expires aliases and borrowed result');
        check($ffi->owned_test_handoffs() === $before + 1, 'mixed callback receiver handed off exactly once');
        record_is($out, 'consuming mixed callback result'); record_is($retained, 'independent receiver retain survives');
        dispose([$receiver, $alias, $view, $retained, $out]);
    }
    $reply = owned_call('echoRecord', [$raw]); $receiver = owned_call('echoRecord', [$raw]);
    $out = $receiver->moveRecord(static fn($argument) => $reply);
    $reply->close(); check($receiver->closed(), 'whole host reply consumes receiver');
    record_is($out, 'consuming whole reply copied independently'); dispose([$reply, $receiver, $out]);

    $expected = new RuntimeException('post-handoff callback exception');
    $failing = owned_call('echoRecord', [$raw]); $alias = $failing->share(); $retained = $failing->retain();
    $before = $ffi->owned_test_handoffs();
    $throwing = static function($argument) use ($expected) { throw $expected; };
    check(reject(fn() => $failing->moveTwice($host, $throwing)) === $expected, 'original post-handoff exception');
    check($failing->closed() && $alias->closed(), 'post-handoff failure consumes aliases');
    check($ffi->owned_test_handoffs() === $before + 1, 'post-handoff failure recorded actual native handoff');
    record_is($retained, 'retained receiver survives failed handoff'); dispose([$failing, $alias, $retained]);

    $argument = owned_call('echoRecord', [$raw]); $expired = $native($argument); $argument->close();
    check($expired->closed(), 'whole recovery original owner expired');
    $calls = 0; $callback = with_recovery(static function($value) use (&$calls) { $calls++; return $value; }, $expired);
    foreach ([false, true] as $twice) {
        $receiver = owned_call('echoRecord', [$raw]); $alias = $receiver->share(); $before = $ffi->owned_test_handoffs();
        reject(fn() => $twice ? $receiver->moveTwice($host, $callback) : $receiver->moveRecord($callback), 4);
        check(!$receiver->closed() && !$alias->closed(), 'expired recovery fails before consuming receiver');
        check($calls === 0 && $ffi->owned_test_handoffs() === $before, 'expired recovery skips callback and handoff');
        record_is($receiver, 'receiver usable after recovery rejection'); dispose([$receiver, $alias]);
    }
    dispose([$native, $closure, $argument, $expired]);
}

$variant = $argv[1] ?? '';
check(in_array($variant, ['no-host', 'host', 'combined'], true), 'known callback capability variant');
$seed = owned_call('newTicket', [Big::of(63), 'callback-result']);
$raw = new Bundle($seed->get(), new Some($seed->get()), [$seed->get()], [], new Payload(Big::of(-17), Bytes::fromString("\0\xff\3")));
$baseline = [$ffi->owned_test_live(), $ffi->owned_test_identities()]; $phases = [];
$start = $checks; native_cases($raw); balanced($baseline, 'native callbacks'); $phases['native'] = $checks - $start;
if ($variant !== 'no-host') {
    $start = $checks; host_cases($raw); balanced($baseline, 'host callbacks'); $phases['host'] = $checks - $start;
}
if ($variant === 'combined') {
    $start = $checks; combined_cases($raw); balanced($baseline, 'combined callbacks'); $phases['combined'] = $checks - $start;
}
dispose([$seed, $raw]); unset($seed, $raw); gc_collect_cycles(); Native::close();
check($ffi->owned_test_live() === 0 && $ffi->owned_test_identities() === 0, 'final native allocation and broker identity counters are zero');
echo json_encode(['checks' => $checks, 'phases' => $phases, 'variant' => $variant,
    'actualLean' => true, 'installedPackage' => false, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities(),
    'phpVersion' => PHP_VERSION, 'phpIntSize' => PHP_INT_SIZE, 'phpZts' => (bool) PHP_ZTS,
    'phpSapi' => PHP_SAPI, 'phpOs' => PHP_OS_FAMILY, 'machine' => php_uname('m'), 'ffi' => extension_loaded('FFI')], JSON_THROW_ON_ERROR), "\n";
