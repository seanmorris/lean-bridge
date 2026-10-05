<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bundle, Payload, Value, Bytes, Some, Ok, Err,
    TreeLeaf, TreeBranch, ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany};
use LeanOwnedAggregates\Internal\Native;
use function LeanOwnedAggregates\copy_value;

$functions = [];
function ticket(int $number = 17): Value { return owned_call('newTicket', [Big::of($number), "wasm\0🙂"]); }
function payload(): Payload { return new Payload(Big::of(-7), Bytes::fromString("\0\xff")); }
function bundle_value(): Value {
    $a = ticket(); $b = ticket(23);
    try { return copy_value(new Bundle($a->get(), new Some($b->get()), [$a->get(), $b->get()], [$b->get()], payload())); }
    finally { dispose([$a, $b]); }
}
function balanced(): void {
    gc_collect_cycles(); $stats = owned_transfer_stats();
    check($stats['nativeLive'] === 0 && $stats['identities'] === 0, 'native cleanup: ' . json_encode($stats));
    check($stats['scopes'] === 0 && $stats['depth'] === 0, 'call cleanup: ' . json_encode($stats));
}

$root = ticket(); $alias = $root->share(); $view = owned_call('retainTicket', [$root]);
$child = owned_call('retainTicket', [$view]); $raw = $child->get(); $kept = $view->retain(); $leaf = $raw->retain();
check($root->equals($kept) && $root->hashCode() === $kept->hashCode(), 'canonical resource equality');
$root->close(); check(!$view->closed(), 'shared root keeps descendants alive'); $alias->close();
check($view->closed() && $child->closed(), 'transitive expiry'); reject(fn() => $child->get(), 4);
reject(fn() => owned_call('serial', [$raw]), 4);
check((string) owned_call('serial', [$kept->get()]) === '17', 'independent whole retain');
check((string) owned_call('serial', [$leaf]) === '17', 'independent leaf retain');
dispose([$root, $alias, $view, $child, $raw, $kept, $leaf]); unset($root, $alias, $view, $child, $raw, $kept, $leaf); balanced();

foreach (['echoArray' => [], 'echoList' => [], 'echoOption' => null, 'echoNested' => [[], [null]]] as $name => $payload) {
    $root = copy_value($payload, resultOf: $model['functions'][$name]);
    $view = owned_call($name, [$root]); $child = owned_call($name, [$view]); $kept = $view->retain();
    check($view->get() === $payload); $root->close();
    check($view->closed() && $child->closed(), 'empty descendants expire'); reject(fn() => $child->get(), 4);
    check($kept->get() === $payload);
    dispose([$root, $view, $child, $kept]); unset($root, $view, $child, $kept); balanced();
}

$root = ticket(); $raw = $root->get(); $view = owned_call('retainTicket', [$root]);
unset($root); gc_collect_cycles(); check($view->closed(), 'raw views do not retain a public root');
reject(fn() => owned_call('serial', [$raw]), 4);
dispose([$view, $raw]); unset($view, $raw); balanced();

$shapes = [
    ['echoArray', fn($a, $b) => [$a, $b]], ['echoList', fn($a, $b) => [$a, $b]],
    ['echoOption', fn($a, $b) => new Some($a)],
    ['echoResult', fn($a, $b) => new Ok(new Bundle($a, new Some($b), [$a], [$b], payload()))],
    ['echoResult', fn($a, $b) => new Err($b)],
    ['echoRecord', fn($a, $b) => new Bundle($a, new Some($b), [$a, $b], [$b], payload())],
    ['echoAlias', fn($a, $b) => new Bundle($a, null, [], [], payload())],
    ['echoTuple', fn($a, $b) => [$a, [new Some($b), payload()]]],
    ['echoVariant', fn($a, $b) => new ChoiceEmpty()], ['echoVariant', fn($a, $b) => new ChoiceOne($a)],
    ['echoVariant', fn($a, $b) => new ChoicePair($a, $b)], ['echoVariant', fn($a, $b) => new ChoiceMany([$a, $b])],
    ['echoRow', fn($a, $b) => [null, new Some($a), new Some($b)]],
    ['echoRecursive', fn($a, $b) => new TreeBranch([new TreeLeaf($a), new TreeBranch([new TreeLeaf($b), new TreeBranch([])])])],
    ['echoRecursive', fn($a, $b) => new TreeBranch([])],
    ['echoNested', fn($a, $b) => [[null, new Some(new Ok(new Bundle($a, null, [], [], payload()))), new Some(new Err($b))], []]]
];
foreach ($shapes as [$name, $make]) {
    $a = ticket(); $b = ticket(23); $raw = $make($a->get(), $b->get()); $expected = semantic_value($raw);
    $root = copy_value($raw, resultOf: $model['functions'][$name]);
    dispose([$a, $b]); unset($a, $b, $raw);
    $view = owned_call($name, [$root]); $child = owned_call($name, [$view]); $kept = $child->retain();
    check(semantic_value($view->get()) === $expected, $name . ' payload');
    check($root->equals($view) && $view->equals($kept), $name . ' identity');
    check($root->hashCode() === $kept->hashCode(), $name . ' hash');
    $view->close(); check(!$root->closed() && $child->closed()); reject(fn() => $root->equals($child), 4);
    $root->close(); check(semantic_value($kept->get()) === $expected);
    dispose([$root, $view, $child, $kept]); unset($root, $view, $child, $kept); balanced();
}

$a = ticket(); $peers = copy_value([], parameterOf: [$model['functions']['bundle'], 2]);
$record = owned_call('bundle', [$a->get(), null, $peers, [], payload()]); $primary = owned_call('primary', [$record]);
check(semantic_value(owned_call('payload', [$record->get()])) === semantic_value(payload()));
$a->close(); check(!$record->closed()); $peers->close(); check($record->closed() && $primary->closed());
dispose([$a, $peers, $record, $primary]); unset($a, $peers, $record, $primary); balanced();

foreach (['transferTicket' => fn() => ticket(), 'moveArray' => fn() => copy_value([], resultOf: 'echo_array')] as $name => $make) {
    $root = $make(); $alias = $root->share(); $view = owned_call($name === 'moveArray' ? 'echoArray' : 'retainTicket', [$root]);
    $kept = $root->retain(); $moved = owned_call($name, [$root]);
    check($root->closed() && $alias->closed() && $view->closed()); check($kept->equals($moved));
    dispose([$root, $alias, $view, $kept, $moved]); unset($root, $alias, $view, $kept, $moved); balanced();
}

$anchor = ticket(); $moved = ticket(29); $view = owned_call('retainTicket', [$moved]);
$result = owned_call('mixedTicket', [$anchor, $moved]); check($moved->closed() && $view->closed());
check((string) owned_call('serial', [$result->get()]) === '29'); $anchor->close(); check($result->closed());
dispose([$anchor, $moved, $view, $result]); unset($anchor, $moved, $view, $result); balanced();

foreach (['record', 'recursive'] as $shape) {
    $root = ticket(); $value = $shape === 'record' ? new Bundle($root->get(), null, [], [], payload()) : new TreeBranch([new TreeLeaf($root->get())]);
    $owner = copy_value($value); dispose($root); unset($root, $value);
    $escaped = null;
    $view = owned_call($shape === 'record' ? 'callbackRecord' : 'callbackRecursive', [$owner, static function($raw) use (&$escaped) { $escaped = $raw; return $raw; }]);
    check($view->equals($owner));
    $closure = owned_call($shape === 'record' ? 'makeRecord' : 'makeRecursive', [$owner]);
    $out = $closure(true, $owner->get()); check($out->equals($owner));
    if ($shape === 'record') {
        $moved = owned_call('moveRecord', [$owner, static fn($raw) => $raw]); check($owner->closed()); $moved->close(); unset($moved);
    } else $owner->close();
    check($view->closed() && $closure->closed()); reject(fn() => semantic_value($escaped), 4);
    dispose([$owner, $view, $closure, $out, $escaped]); unset($owner, $view, $closure, $out, $escaped); balanced();
}

$root = ticket(); $before = owned_transfer_stats()['handoffs'];
reject(fn() => owned_call('mixedTicket', [$root, $root]), 1);
$view = owned_call('retainTicket', [$root]);
reject(fn() => owned_call('transferTicket', [$view]), 1);
check(!$root->closed() && !$view->closed() && owned_transfer_stats()['handoffs'] === $before, 'invalid transfers preserve the original owner');
dispose([$root, $view]); unset($root, $view); balanced();

$owner = bundle_value(); $escaped = null; $callbackKept = null;
$view = owned_call('callbackRecord', [$owner, static function($raw) use (&$escaped, &$callbackKept) {
    $escaped = $raw; $callbackKept = copy_value($raw);
    $nested = owned_call('echoRecord', [$callbackKept]); check($nested->equals($callbackKept)); $nested->close();
    return $raw;
}]);
$owner->close(); check($view->closed() && !$callbackKept->closed()); reject(fn() => semantic_value($escaped), 4);
dispose([$owner, $view, $escaped, $callbackKept]); unset($owner, $view, $escaped, $callbackKept); balanced();

$errors = []; $sentinel = new RuntimeException('Original anchored PHP-Wasm callback failure');
foreach (['throw', 'close', 'consume'] as $action) {
    $owner = bundle_value(); $alias = $owner->share(); $kept = $owner->retain(); $escaped = null;
    $oldView = owned_call('echoRecord', [$owner]);
    $error = reject(static function() use ($owner, $alias, $action, $sentinel, &$escaped) {
        return owned_call('callbackRecord', [$owner, static function($raw) use ($owner, $alias, $action, $sentinel, &$escaped) {
            $escaped = $raw;
            if ($action === 'throw') throw $sentinel;
            if ($action === 'close') { $owner->close(); $alias->close(); }
            else {
                $moved = owned_call('moveRecord', [$owner, static function($borrow) use ($owner, $alias) {
                    check($owner->closed() && $alias->closed(), 'consumption precedes callback entry');
                    reject(fn() => owned_call('moveRecord', [$owner, fn($value) => $value]), 4);
                    return $borrow;
                }]);
                check((string) owned_call('serial', [$moved->get()->primary]) === '17'); $moved->close();
            }
            return $raw;
        }]);
    });
    check($action === 'throw' ? $error === $sentinel : $error->getCode() === 4, $action . ': ' . $error);
    check($owner->closed() === ($action !== 'throw') && $oldView->closed() === ($action !== 'throw'));
    check(!$kept->closed()); reject(fn() => semantic_value($escaped), 4); $errors[] = $error;
    dispose([$owner, $alias, $oldView, $kept, $escaped]); unset($owner, $alias, $oldView, $kept, $escaped, $error); balanced();
}

$owner = bundle_value(); $before = owned_transfer_stats()['handoffs'];
foreach ([null, 42, static function(&$raw) { return $raw; }, static function($raw) { yield $raw; }] as $invalid)
    reject(fn() => owned_call('moveRecord', [$owner, $invalid]), null, TypeError::class);
foreach ([fn() => copy_value([], resultOf: 'not_a_function'), fn() => copy_value([], parameterOf: ['echo_record']),
    fn() => copy_value([], resultOf: 'echo_record', parameterOf: ['echo_record', 0]), fn() => copy_value([], resultOf: 'serial'),
    fn() => copy_value([]), fn() => copy_value([], resultOf: 1), fn() => copy_value([], parameterOf: 'echo_record'),
    fn() => copy_value($owner, resultOf: 'echo_array'), fn() => owned_call('echoArray', [$owner]),
    fn() => owned_call('echoRecord', [$owner->get()])] as $invalid) reject($invalid, null, TypeError::class);
reject(fn() => serialize($owner), null, LogicException::class); reject(fn() => clone $owner, null, Error::class);
$cycle = []; $cycle[] = &$cycle; reject(fn() => copy_value($cycle, resultOf: 'echo_nested'), null, ValueError::class); unset($cycle);
check(!$owner->closed() && owned_transfer_stats()['handoffs'] === $before, 'invalid host values never consume the owner');
reject(fn() => owned_call('moveRecord', [$owner, fn($raw) => $raw->primary]), null, TypeError::class);
check($owner->closed(), 'malformed callback output cannot undo consumption');
dispose($owner); unset($owner, $invalid); balanced();

$faults = [];
foreach (['borrow', 'move', 'mixed', 'copy'] as $shape) foreach (['zend', 'php'] as $domain) {
    $counts = ['before' => 0, 'after' => 0]; $completed = false;
    for ($point = 1; $point < 2000; $point++) {
        $owner = $shape === 'mixed' ? ticket() : bundle_value();
        $consumed = $shape === 'mixed' ? ticket(29) : null;
        $alias = $owner->share(); $oldView = owned_call($shape === 'mixed' ? 'retainTicket' : 'echoRecord', [$owner]);
        $before = owned_transfer_stats()['handoffs']; $result = null; $error = null;
        if ($domain === 'php') $remaining = $point - 1; else owned_transfer_fault($point);
        try { $result = $shape === 'copy' ? $oldView->retain() : ($shape === 'mixed' ? owned_call('mixedTicket', [$owner, $consumed])
            : owned_call($shape === 'borrow' ? 'callbackRecord' : 'moveRecord', [$owner, fn($raw) => $raw])); }
        catch (Throwable $caught) { $error = $caught; }
        finally { $remaining = -1; owned_transfer_fault(0); }
        $moved = owned_transfer_stats()['handoffs'] !== $before;
        check($owner->closed() === ($shape === 'move' && $moved), $shape . ' original owner follows handoff');
        check($alias->closed() === $owner->closed() && $oldView->closed() === $owner->closed());
        if ($consumed !== null) check($consumed->closed() === $moved);
        if ($error !== null) {
            check($domain === 'php' ? $error === $injected : $error->getCode() === 3, $shape . '/' . $domain . ' allocation ' . $point . ': ' . $error);
            $counts[$moved ? 'after' : 'before']++; $errors[] = $error;
        } else { check(in_array($shape, ['borrow', 'copy'], true) || $moved); $completed = true; }
        dispose([$owner, $consumed, $alias, $oldView, $result]);
        unset($owner, $consumed, $alias, $oldView, $result, $error, $caught); balanced();
        if ($completed) break;
    }
    check($completed && $counts['before'] > 0 && (in_array($shape, ['borrow', 'copy'], true) || $counts['after'] > 0),
        $shape . '/' . $domain . ' full allocation sweep: ' . json_encode($counts));
    $faults[$shape][$domain] = $counts;
}
$heldErrors = count($errors); unset($errors, $sentinel, $injected); gc_collect_cycles(); balanced();
Native::close(); gc_collect_cycles(); $stats = owned_transfer_stats();
check($stats['live'] === 0 && $stats['identities'] === 0, 'final cleanup: ' . json_encode($stats));
$names = array_keys($functions); sort($names);
echo json_encode(['checks' => $checks, 'heldErrors' => $heldErrors, 'faults' => $faults,
    'phpBits' => $stats['phpBits'], 'live' => $stats['live'], 'identities' => $stats['identities'], 'functions' => $names]);
