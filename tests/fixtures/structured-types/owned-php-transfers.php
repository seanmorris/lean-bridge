<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Payload, Bundle, TreeLeaf, TreeBranch,
    ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, ChainStop, ChainLink, Mixed_};
use LeanOwnedAggregates\Internal\{Native, Resource, ResourceAccess};

$visited = [];
function ticket(int $number = 17): Resource { return owned_call('newTicket', [Big::of($number), "native\0🙂"]); }
function payload(): Payload { return new Payload(Big::of(-7), Bytes::fromString("\0\x7f\xff")); }
function bundle(): Bundle {
    $first = ticket(); $second = ticket(23);
    return new Bundle($first, new Some($second), [$first, $second], [$second], payload());
}
function chain(int $depth = 30): ChainStop|ChainLink {
    $value = new ChainStop();
    for ($index = 0; $index < $depth; $index++) $value = new ChainLink(ticket($index), new Some($value));
    return $value;
}
function mixed_value(bool $error): Mixed_ {
    return new Mixed_(ticket(), [null, new Some(null), new Some(new Some(false)), new Some(new Some(true))],
        new Some(null), $error ? new Err(ticket(31)) : new Ok(bundle()),
        Big::of(2)->power(180)->negated(), Big::of(2)->power(200), '🙂', -0.0, 1.5,
        Bytes::fromString("\0\x7f\x80\xff"), [Big::of(0), Big::of('18446744073709551615')],
        [ticket(), [new Some(ticket(32)), payload()]], chain(3));
}
function leaves(mixed $value): array {
    if ($value instanceof Resource) return [$value];
    if ($value instanceof Big || $value instanceof Bytes) return [];
    if (is_object($value)) $value = get_object_vars($value);
    $out = [];
    if (is_array($value)) foreach ($value as $child) array_push($out, ...leaves($child));
    return $out;
}
function resource_closed(Resource $value): bool {
    try { ResourceAccess::binding($value); return false; }
    catch (LeanOwnedAggregates\LeanBridgeError $error) {
        if ($error->getCode() !== 4) throw $error;
        return true;
    }
}
function is_closed(mixed $value): bool {
    foreach (leaves($value) as $leaf) if (!resource_closed($leaf)) return false;
    return true;
}
function balanced(int $sessions = 1): void {
    global $ffi;
    check($ffi->owned_test_live() === $sessions, 'only open sessions retain native allocations: ' . $ffi->owned_test_live());
    check($ffi->owned_test_identities() === $sessions, 'only open sessions retain broker identities: ' . $ffi->owned_test_identities());
}

$first = ticket(); $alias = $first; $kept = $first->retain();
$result = owned_call('retainTicket', [$first]);
check(resource_closed($alias) && !resource_closed($kept), 'shared alias closes; independent retain survives');
check((string) owned_call('serial', [$result]) === '17');
check((string) owned_call('serial', [$kept]) === '17');
reject(fn() => owned_call('serial', [$alias]), 4);
dispose([$first, $alias, $kept, $result]); unset($first, $alias, $kept, $result); balanced();

$input = bundle();
reject(fn() => owned_call('callbackRecord', [$input, 42]), null, TypeError::class);
check(!resource_closed($input->primary), 'validation leaves owners open');
$kept = $input->primary->retain(); $escaped = null;
$result = owned_call('callbackRecord', [$input, static function($value) use ($input, &$escaped) {
    check(is_closed($input), 'native handoff is visible during callback reentry');
    $escaped = $value->primary;
    reject(fn() => owned_call('echoRecord', [$value]), 1);
    $independent = $value->primary->retain();
    $moved = owned_call('retainTicket', [$independent]);
    check(resource_closed($independent));
    check((string) owned_call('serial', [$moved]) === '17');
    $moved->close(); return $value;
}]);
check(is_closed($input) && !resource_closed($kept));
check(resource_closed($escaped), 'callback borrow expires');
check((string) owned_call('serial', [$result->spare->value]) === '23');
$primary = owned_call('primary', [$result]);
check((string) owned_call('serial', [$primary]) === '17'); $primary->close(); unset($primary);
check(semantic_value(owned_call('payload', [$result])) === semantic_value(payload()));
$sibling = $result->spare->value;
$moved = owned_call('retainTicket', [$result->primary]);
check(resource_closed($sibling), 'moving one leaf closes siblings sharing its result owner');
dispose([$input, $result, $kept, $moved]); unset($input, $result, $kept, $escaped, $sibling, $moved); balanced();

$sentinel = new RuntimeException('original transfer callback error'); $input = bundle();
check(reject(fn() => owned_call('callbackRecord', [$input, static function($value) use ($sentinel) { throw $sentinel; }])) === $sentinel);
check(is_closed($input), 'an exception after handoff does not restore owners');
dispose($input); unset($input); balanced();

$first = ticket();
reject(fn() => owned_call('bundle', [$first, null, [$first], [], payload()]), 1);
check(!resource_closed($first), 'one owner cannot be consumed by two parameters');
$second = ticket(29);
$result = owned_call('bundle', [$first, null, [$second], [], payload()]);
check(resource_closed($first) && resource_closed($second));
check((string) owned_call('serial', [$result->peers[0]]) === '29');
dispose([$first, $second, $result]); unset($first, $second, $result); balanced();

foreach ([['echoArray', fn() => [ticket(), ticket(2)]], ['echoArray', fn() => []],
    ['echoList', fn() => [ticket(), ticket(3)]], ['echoList', fn() => []],
    ['echoOption', fn() => new Some(ticket())], ['echoOption', fn() => null],
    ['echoResult', fn() => new Ok(bundle())], ['echoResult', fn() => new Err(ticket())],
    ['echoRecord', fn() => bundle()], ['echoAlias', fn() => bundle()],
    ['echoTuple', fn() => [ticket(), [new Some(ticket(2)), payload()]]],
    ['echoVariant', fn() => new ChoiceEmpty()], ['echoVariant', fn() => new ChoiceOne(ticket())],
    ['echoVariant', fn() => new ChoicePair(ticket(), ticket(2))], ['echoVariant', fn() => new ChoiceMany([ticket(), ticket(3)])],
    ['echoRow', fn() => [null, new Some(ticket())]],
    ['echoRecursive', fn() => new TreeBranch([new TreeLeaf(ticket()), new TreeBranch([])])],
    ['echoNested', fn() => [[null, new Some(new Ok(bundle())), new Some(new Err(ticket()))], []]],
    ['echoChain', fn() => chain()], ['echoMixed', fn() => mixed_value(false)], ['echoMixed', fn() => mixed_value(true)]] as [$name, $make]) {
    $input = $make();
    $expected = semantic_value($input); $result = owned_call($name, [$input]);
    check(is_closed($input), $name . ' consumes leaves');
    check(semantic_value($result) === $expected, $name . ' preserves the value');
    dispose([$input, $result]);
    unset($input, $result); balanced();
}
unset($input, $result); balanced();

$input = new TreeBranch([new TreeLeaf(ticket()), new TreeBranch([])]); $expected = semantic_value($input);
$result = owned_call('callbackRecursive', [$input, fn($value) => $value]);
check(is_closed($input) && semantic_value($result) === $expected);
dispose([$input, $result]); unset($input, $result); balanced();
foreach (['makeRecord' => fn() => bundle(), 'makeRecursive' => fn() => new TreeLeaf(ticket())] as $name => $make) {
    $input = $make(); $expected = semantic_value($input);
    $closure = owned_call($name, [$input]); check(is_closed($input));
    $supplied = $make(); $result = $closure(true, $supplied);
    check(semantic_value($result) === $expected && !is_closed($supplied));
    dispose($result); $result = $closure(false, $supplied);
    check(semantic_value($result) === semantic_value($supplied));
    dispose([$input, $result, $closure, $supplied]); unset($input, $result, $closure, $supplied); balanced();
}

$closure = owned_call('newRecordCallback', []); $alias = $closure; $kept = $closure->retain();
$moved = owned_call('transferCallback', [$closure]);
check(resource_closed($alias) && !resource_closed($kept));
$input = bundle(); same_result($input, fn() => $moved($input)); same_result($input, fn() => $kept($input));
dispose([$input, $closure, $kept, $moved]); unset($input, $closure, $alias, $kept, $moved); balanced();

$input = bundle(); $handoffs = $ffi->owned_test_handoffs();
foreach ([null, 42, static function(&$value) { return $value; }, static function($value) { yield $value; }] as $bad)
    reject(fn() => owned_call('callbackRecord', [$input, $bad]), null, TypeError::class);
reject(fn() => owned_call('transferCallback', [fn($value) => $value]), null, TypeError::class);
reject(fn() => owned_call('echoArray', [[1 => $input->primary]]), null, TypeError::class);
$cycle = []; $cycle[] = &$cycle;
reject(fn() => owned_call('echoNested', [$cycle]), null, ValueError::class); unset($cycle);
$fiber = new Fiber(static function() use ($input): void { reject(fn() => owned_call('echoRecord', [$input]), 5); });
$fiber->start(); check($fiber->isTerminated()); unset($fiber);
check(!resource_closed($input->primary) && $ffi->owned_test_handoffs() === $handoffs, 'invalid and foreign-context calls never consume');
if (!function_exists('pcntl_fork')) throw new RuntimeException('Transfer probe requires pcntl');
$pid = pcntl_fork(); if ($pid === -1) throw new RuntimeException('fork failed');
if ($pid === 0) {
    try { reject(fn() => owned_call('echoRecord', [$input]), 6); exit(0); }
    catch (Throwable $error) { fwrite(STDERR, (string) $error); exit(93); }
}
pcntl_waitpid($pid, $status); check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
check(!resource_closed($input->primary)); dispose($input); unset($input); balanced();

$errors = []; $faults = [];
foreach (['single', 'multiple'] as $shape) foreach (['php', 'native'] as $domain) {
    $counts = ['before' => 0, 'after' => 0]; $completed = false;
    for ($point = 0; $point < 1024; $point++) {
        $input = $shape === 'single' ? bundle() : [ticket(), ticket(29)];
        $arguments = $shape === 'single' ? [$input, fn($value) => $value] : [$input[0], null, [$input[1]], [], payload()];
        $before = $ffi->owned_test_handoffs(); $result = null; $error = null;
        if ($domain === 'php') $remaining = $point; else $ffi->owned_test_fail_after($point);
        try { $result = owned_call($shape === 'single' ? 'callbackRecord' : 'bundle', $arguments); }
        catch (Throwable $caught) { $error = $caught; }
        finally { $remaining = -1; $ffi->owned_test_fail_after(-1); }
        $consumed = $ffi->owned_test_handoffs() !== $before;
        foreach (leaves($input) as $leaf) check(resource_closed($leaf) === $consumed, $shape . '/' . $domain . ' handoff');
        if ($error !== null) {
            check($domain === 'php' ? $error === $injected : $error->getCode() === 3, $error->getMessage());
            $counts[$consumed ? 'after' : 'before']++; $errors[] = $error;
        } else { check($consumed); $completed = true; }
        dispose([$input, $result]); unset($input, $result, $arguments, $leaf, $error, $caught); balanced();
        if ($completed) break;
    }
    check($completed && $counts['before'] > 0 && $counts['after'] > 0, 'complete ' . $shape . '/' . $domain . ' fault sweep');
    $faults[$shape][$domain] = $counts;
}
gc_collect_cycles(); balanced(); Native::close(); balanced(0); $functions = array_keys($visited); sort($functions);
echo json_encode(['checks' => $checks, 'faults' => $faults, 'heldErrors' => count($errors),
    'functions' => $functions, 'live' => $ffi->owned_test_live(), 'identities' => $ffi->owned_test_identities()]), "\n";
