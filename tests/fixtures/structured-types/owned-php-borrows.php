<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bundle, Payload, Value, Bytes, Some, Ok, Err,
    TreeLeaf, TreeBranch, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\copy_value;

function ticket(int $serial = 17): Value { return owned_call('newTicket', [Big::of($serial), "anchor\0🙂"]); }
function payload(): Payload { return new Payload(Big::of(-7), Bytes::fromString("\0\xff")); }
function bundle_value(): Value {
    $first = ticket(); $second = ticket(23);
    try { return copy_value(new Bundle($first->get(), new Some($second->get()),
        [$first->get(), $second->get()], [$second->get()], payload())); }
    finally { dispose([$first, $second]); }
}
function balanced(int $sessions = 1): void {
    global $ffi;
    gc_collect_cycles();
    check($ffi->owned_test_live() === $sessions, 'only sessions retain allocations: ' . $ffi->owned_test_live());
    check($ffi->owned_test_identities() === $sessions, 'only sessions retain identities: ' . $ffi->owned_test_identities());
}

$root = ticket(); $shared = $root->share();
$view = owned_call('retainTicket', [$root]);
$child = owned_call('retainTicket', [$view]);
$raw = $child->get(); $independent = $view->retain(); $leaf = $raw->retain();
check($root instanceof Value && $view instanceof Value, 'checked whole owners');
check($root->get()->sameIdentity($raw), 'canonical identity across distinct views');
check($view->equals($independent), 'whole owner identity equality');
check($view->hashCode() === $independent->hashCode(), 'equal owners hash equally');
$root->close(); check(!$view->closed(), 'shared root keeps anchor open');
$shared->close();
foreach ([$view, $child] as $expired) {
    check($expired->closed(), 'transitive owner expiration');
    reject(fn() => $expired->get(), 4);
    reject(fn() => $expired->retain(), 4);
}
reject(fn() => owned_call('serial', [$raw]), 4);
reject(fn() => $raw->sameIdentity($raw), 4);
check((string) owned_call('serial', [$independent->get()]) === '17', 'independent whole retain');
check((string) owned_call('serial', [$leaf]) === '17', 'independent leaf retain');
dispose([$root, $shared, $view, $child, $independent, $raw, $leaf]);
unset($root, $shared, $view, $child, $independent, $raw, $leaf, $expired);
balanced();

foreach (['echoArray' => [], 'echoList' => [], 'echoOption' => null, 'echoNested' => [[], [null]]] as $name => $payload) {
    $resultName = $model['functions'][$name];
    $root = copy_value($payload, resultOf: $resultName);
    $view = owned_call($name, [$root]); $child = owned_call($name, [$view]);
    $retained = $view->retain();
    check($view->get() === $payload, 'empty and nested payloads preserved');
    $root->close(); check($view->closed() && $child->closed(), 'empty views remain owner-scoped');
    reject(fn() => $view->get(), 4);
    check($retained->get() === $payload, 'empty independent retain');
    dispose([$root, $view, $child, $retained]); unset($root, $view, $child, $retained);
    balanced();
}

$root = ticket(); $raw = $root->get(); $view = owned_call('retainTicket', [$root]);
unset($root); gc_collect_cycles();
check($view->closed(), 'raw views cannot keep a whole root alive');
reject(fn() => owned_call('serial', [$raw]), 4);
dispose([$view, $raw]); unset($view, $raw); balanced();

$ticket = ticket();
$payload = payload();
$owner = copy_value(new Bundle($ticket->get(), null, [], [], $payload));
$escaped = null;
$view = owned_call('callbackRecord', [$owner, static function($value) use (&$escaped) { $escaped = $value; return $value; }]);
check((string) owned_call('serial', [$view->get()->primary]) === '17', 'borrowed callback result');
reject(fn() => owned_call('serial', [$escaped->primary]), 4);
$closure = owned_call('makeRecord', [$owner]);
$out = $closure(true, $owner->get());
check((string) owned_call('serial', [$out->get()->primary]) === '17', 'returned closure retains whole result');
$owner->close(); check($view->closed() && $closure->closed(), 'closure follows original owner');
dispose([$ticket, $owner, $view, $closure, $out, $escaped]);
unset($ticket, $owner, $view, $closure, $out, $escaped); balanced();

$root = copy_value([], resultOf: 'echo_array'); $shared = $root->share();
$view = owned_call('echoArray', [$root]); $kept = $root->retain();
$moved = owned_call('moveArray', [$root]);
check($root->closed() && $shared->closed() && $view->closed(), 'original empty slot consumed');
check($moved->get() === [] && $kept->get() === [], 'independent owners survive consumption');
dispose([$root, $shared, $view, $kept, $moved]); unset($root, $shared, $view, $kept, $moved); balanced();

$root = ticket(); $view = owned_call('retainTicket', [$root]);
reject(fn() => owned_call('transferTicket', [$view]), 1);
check(!$root->closed() && !$view->closed(), 'rejected borrowed transfer preserves roots');
dispose([$root, $view]); unset($root, $view); balanced();

$root = ticket(); $alias = $root->share(); $view = owned_call('retainTicket', [$root]);
$kept = $root->retain(); $moved = owned_call('transferTicket', [$root]);
check($root->closed() && $alias->closed() && $view->closed(), 'scalar transfer consumes the original owner');
check($moved->get()->sameIdentity($kept->get()), 'scalar transfer preserves the retained native identity');
dispose([$root, $alias, $view, $kept, $moved]); unset($root, $alias, $view, $kept, $moved); balanced();

$shapes = [
    ['echoArray', fn($first, $second) => [$first, $second]],
    ['echoList', fn($first, $second) => [$first, $second]],
    ['echoOption', fn($first, $second) => new Some($first)],
    ['echoResult', fn($first, $second) => new Ok(new Bundle($first, new Some($second), [$first], [$second], payload()))],
    ['echoResult', fn($first, $second) => new Err($second)],
    ['echoRecord', fn($first, $second) => new Bundle($first, new Some($second), [$first, $second], [$second], payload())],
    ['echoAlias', fn($first, $second) => new Bundle($first, null, [], [], payload())],
    ['echoTuple', fn($first, $second) => [$first, [new Some($second), payload()]]],
    ['echoVariant', fn($first, $second) => new ChoiceEmpty()],
    ['echoVariant', fn($first, $second) => new ChoiceOne($first)],
    ['echoVariant', fn($first, $second) => new ChoicePair($first, $second)],
    ['echoVariant', fn($first, $second) => new ChoiceMany([$first, $second])],
    ['echoRow', fn($first, $second) => [null, new Some($first), new Some($second)]],
    ['echoRecursive', fn($first, $second) => new TreeBranch([new TreeLeaf($first), new TreeBranch([new TreeLeaf($second), new TreeBranch([])])])],
    ['echoRecursive', fn($first, $second) => new TreeBranch([])],
    ['echoNested', fn($first, $second) => [[null, new Some(new Ok(new Bundle($first, null, [], [], payload()))), new Some(new Err($second))], []]]
];
foreach ($shapes as [$name, $make]) {
    $first = ticket(); $second = ticket(23); $raw = $make($first->get(), $second->get());
    $expected = semantic_value($raw);
    $root = copy_value($raw, resultOf: $model['functions'][$name]);
    dispose([$first, $second]); unset($first, $second, $raw);
    $view = owned_call($name, [$root]); $child = owned_call($name, [$view]); $kept = $child->retain();
    check(semantic_value($view->get()) === $expected, $name . ' preserves constructors and payloads');
    check($root->equals($view) && $view->equals($kept), $name . ' compares canonical identities');
    check($root->hashCode() === $kept->hashCode(), $name . ' equal values have equal hashes');
    $view->close(); check(!$root->closed() && $child->closed(), $name . ' closes descendants, not ancestors');
    reject(fn() => $child->get(), 4);
    reject(fn() => $child->hashCode(), 4);
    reject(fn() => $root->equals($child), 4);
    $root->close(); check(semantic_value($kept->get()) === $expected, $name . ' retained value survives both ancestors');
    dispose([$root, $view, $child, $kept]); unset($root, $view, $child, $kept); balanced();
}

$first = ticket(); $second = ticket();
check(!$first->get()->sameIdentity($second->get()), 'equal fields do not merge independent identities');
$peers = copy_value([], parameterOf: [$model['functions']['bundle'], 2]);
$record = owned_call('bundle', [$first->get(), null, $peers, [], payload()]);
$primary = owned_call('primary', [$record]);
check(semantic_value(owned_call('payload', [$record->get()])) === semantic_value(payload()), 'copied result needs no whole wrapper');
$first->close(); $second->close();
check(!$record->closed() && !$primary->closed(), 'nonfirst parameter determines the anchor');
check((string) owned_call('serial', [$primary->get()]) === '17');
$peers->close(); check($record->closed() && $primary->closed(), 'empty nonfirst anchor expires every descendant');
dispose([$first, $second, $peers, $record, $primary]); unset($first, $second, $peers, $record, $primary); balanced();

$anchor = ticket(); $consumed = ticket(29); $alias = $consumed->share(); $kept = $consumed->retain();
$oldView = owned_call('retainTicket', [$consumed]);
$mixed = owned_call('mixedTicket', [$anchor, $consumed]);
check(!$anchor->closed() && $consumed->closed() && $alias->closed() && $oldView->closed(), 'mixed call consumes only its transferred input');
check((string) owned_call('serial', [$mixed->get()]) === '29', 'borrowed result may contain the consumed identity');
check($mixed->get()->sameIdentity($kept->get()), 'mixed result preserves canonical identity');
$anchor->close(); check($mixed->closed() && !$kept->closed(), 'mixed result follows its declared anchor');
dispose([$anchor, $consumed, $alias, $kept, $oldView, $mixed]); unset($anchor, $consumed, $alias, $kept, $oldView, $mixed); balanced();

$root = ticket(); $before = $ffi->owned_test_handoffs();
reject(fn() => owned_call('mixedTicket', [$root, $root]), 1);
check(!$root->closed() && $ffi->owned_test_handoffs() === $before, 'one owner cannot be both borrowed anchor and consumed input');
dispose($root); unset($root); balanced();

$owner = bundle_value(); $escaped = null; $callbackKept = null;
$view = owned_call('callbackRecord', [$owner, static function($value) use (&$escaped, &$callbackKept) {
    $escaped = $value; $callbackKept = copy_value($value);
    $nested = owned_call('echoRecord', [$callbackKept]);
    check($nested->equals($callbackKept), 'callback reentry preserves values'); $nested->close();
    return $value;
}]);
reject(fn() => owned_call('serial', [$escaped->primary]), 4);
$owner->close(); check($view->closed() && !$callbackKept->closed(), 'callback copy is independent');
check((string) owned_call('serial', [$callbackKept->get()->primary]) === '17');
dispose([$owner, $view, $escaped, $callbackKept]); unset($owner, $view, $escaped, $callbackKept); balanced();

$errors = []; $sentinel = new RuntimeException('Original anchored PHP callback failure');
foreach (['throw', 'close', 'consume'] as $action) {
    $owner = bundle_value(); $alias = $owner->share(); $kept = $owner->retain(); $escaped = null;
    $oldView = owned_call('echoRecord', [$owner]);
    $error = reject(static function() use ($owner, $alias, $action, $sentinel, &$escaped) { return owned_call('callbackRecord', [$owner,
        static function($value) use ($owner, $alias, $action, $sentinel, &$escaped) {
            $escaped = $value;
            if ($action === 'throw') throw $sentinel;
            if ($action === 'close') { $owner->close(); $alias->close(); }
            else {
                $moved = owned_call('moveRecord', [$owner, static function($borrow) use ($owner, $alias) {
                    check($owner->closed() && $alias->closed(), 'original slot is consumed before nested callback');
                    reject(fn() => owned_call('moveRecord', [$owner, fn($value) => $value]), 4);
                    return $borrow;
                }]);
                check((string) owned_call('serial', [$moved->get()->primary]) === '17'); $moved->close();
            }
            return $value;
        }]); });
    check($action === 'throw' ? $error === $sentinel : $error->getCode() === 4,
        'callback ' . $action . ': ' . (string) $error);
    check($owner->closed() === ($action !== 'throw') && $oldView->closed() === ($action !== 'throw'), 'reentrant close or consume is observable');
    check(!$kept->closed(), 'independent callback input copy survives');
    reject(fn() => owned_call('serial', [$escaped->primary]), 4);
    $errors[] = $error;
    dispose([$owner, $alias, $oldView, $kept, $escaped]); unset($owner, $alias, $oldView, $kept, $escaped, $error); balanced();
}

$first = ticket(); $tree = copy_value(new TreeBranch([new TreeLeaf($first->get()), new TreeBranch([])]));
$view = owned_call('callbackRecursive', [$tree, fn($value) => $value]);
$closure = owned_call('makeRecursive', [$tree]); $keptClosure = $closure->retain();
$out = $closure(true, $tree->get());
check($out->equals($tree) && $view->equals($tree), 'recursive callback and returned closure preserve trees');
$tree->close(); check($view->closed() && $closure->closed(), 'returned closure follows its anchor');
reject(fn() => $closure(true, new TreeBranch([])), 4);
$retainedOut = $keptClosure(true, new TreeBranch([]));
check($retainedOut->equals($out), 'retained closure survives the original root');
dispose([$first, $tree, $view, $closure, $keptClosure, $out, $retainedOut]);
unset($first, $tree, $view, $closure, $keptClosure, $out, $retainedOut); balanced();

$owner = bundle_value(); $before = $ffi->owned_test_handoffs();
foreach ([null, 42, static function(&$value) { return $value; }, static function($value) { yield $value; }] as $invalid)
    reject(fn() => owned_call('moveRecord', [$owner, $invalid]), null, TypeError::class);
reject(fn() => owned_call('moveRecord', [$owner, fn($value) => $value->primary]), null, TypeError::class);
check($owner->closed(), 'malformed callback result cannot undo native consumption');
dispose($owner); unset($owner); balanced();

$owner = bundle_value(); $before = $ffi->owned_test_handoffs();
reject(fn() => copy_value([], resultOf: 'not_a_function'), null, TypeError::class);
reject(fn() => copy_value([], parameterOf: ['echo_record']), null, TypeError::class);
reject(fn() => copy_value([], resultOf: 'echo_record', parameterOf: ['echo_record', 0]), null, TypeError::class);
reject(fn() => copy_value([], resultOf: 'serial'), null, TypeError::class);
reject(fn() => copy_value([]), null, TypeError::class);
reject(fn() => copy_value($owner, resultOf: 'echo_array'), null, TypeError::class);
reject(fn() => owned_call('echoArray', [$owner]), null, TypeError::class);
reject(fn() => owned_call('echoRecord', [$owner->get()]), null, TypeError::class);
reject(fn() => serialize($owner), null, LogicException::class);
reject(fn() => clone $owner, null, Error::class);
$cycle = []; $cycle[] = &$cycle;
reject(fn() => copy_value($cycle, resultOf: 'echo_nested'), null, ValueError::class); unset($cycle);
$fiber = new Fiber(static function() use ($owner): void {
    reject(fn() => $owner->get(), 5); reject(fn() => $owner->close(), 5);
    reject(fn() => owned_call('moveRecord', [$owner, fn($value) => $value]), 5);
});
$fiber->start(); check($fiber->isTerminated()); unset($fiber);
check(!$owner->closed() && $ffi->owned_test_handoffs() === $before, 'invalid calls and Fibers preserve owners');
if (!function_exists('pcntl_fork')) throw new RuntimeException('Borrow probe requires pcntl');
$pid = pcntl_fork(); if ($pid === -1) throw new RuntimeException('fork failed');
if ($pid === 0) {
    try {
        reject(fn() => $owner->get(), 6); reject(fn() => $owner->close(), 6);
        reject(fn() => owned_call('moveRecord', [$owner, fn($value) => $value]), 6); exit(0);
    } catch (Throwable $error) { fwrite(STDERR, (string) $error); exit(93); }
}
pcntl_waitpid($pid, $status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
check(!$owner->closed()); dispose($owner); unset($owner); balanced();

$owner = copy_value([], resultOf: 'echo_array'); $view = owned_call('echoArray', [$owner]);
$fiber = new Fiber(static function() use (&$owner): void { $owner = null; gc_collect_cycles(); });
$fiber->start(); unset($fiber);
check($view->closed(), 'last root destruction in a Fiber expires even an empty view');
dispose($view); unset($view); balanced();

$faults = [];
foreach (['borrow', 'move', 'mixed'] as $shape) foreach (['php', 'native'] as $domain) {
    $counts = ['before' => 0, 'after' => 0]; $completed = false;
    for ($point = 0; $point < 1024; $point++) {
        $owner = $shape === 'mixed' ? ticket() : bundle_value();
        $consumed = $shape === 'mixed' ? ticket(29) : null;
        $alias = $owner->share(); $oldView = owned_call($shape === 'mixed' ? 'retainTicket' : 'echoRecord', [$owner]);
        $before = $ffi->owned_test_handoffs(); $result = null; $error = null;
        if ($domain === 'php') $remaining = $point; else $ffi->owned_test_fail_after($point);
        try { $result = $shape === 'mixed' ? owned_call('mixedTicket', [$owner, $consumed])
            : owned_call($shape === 'borrow' ? 'callbackRecord' : 'moveRecord', [$owner, fn($value) => $value]); }
        catch (Throwable $caught) { $error = $caught; }
        finally { $remaining = -1; $ffi->owned_test_fail_after(-1); }
        $moved = $ffi->owned_test_handoffs() !== $before;
        check($owner->closed() === ($shape === 'move' && $moved), $shape . '/' . $domain . ' original owner follows handoff');
        check($alias->closed() === $owner->closed() && $oldView->closed() === $owner->closed(), 'aliases and descendants agree');
        if ($consumed !== null) check($consumed->closed() === $moved, 'mixed owner follows original slot');
        if ($error !== null) {
            check($domain === 'php' ? $error === $injected : $error->getCode() === 3, $error->getMessage());
            $counts[$moved ? 'after' : 'before']++; $errors[] = $error;
        } else { check($shape === 'borrow' || $moved); $completed = true; }
        dispose([$owner, $consumed, $alias, $oldView, $result]);
        unset($owner, $consumed, $alias, $oldView, $result, $error, $caught); balanced();
        if ($completed) break;
    }
    check($completed && $counts['before'] > 0 && ($shape === 'borrow' || $counts['after'] > 0), 'complete ' . $shape . '/' . $domain . ' fault sweep');
    $faults[$shape][$domain] = $counts;
}
Native::close(); balanced(0);
$functions = array_keys($visited); sort($functions);
echo json_encode(['checks' => $checks, 'faults' => $faults, 'heldErrors' => count($errors), 'functions' => $functions, 'live' => $ffi->owned_test_live(),
    'identities' => $ffi->owned_test_identities()], JSON_THROW_ON_ERROR), "\n";
