<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

$functions = [];

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Ok, Err, Payload, Bundle, TreeLeaf, TreeBranch,
    ChoiceEmpty, ChoiceOne, ChoicePair, ChoiceMany, ChainStop, ChainLink, Mixed_};
use LeanOwnedAggregates\Internal\{Native, Resource, ResourceAccess};

function ticket(int $number = 17): Resource { return owned_call('newTicket', [Big::of($number), "wasm\0🙂"]); }
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
function balanced(): void {
    $stats = owned_transfer_stats();
    check($stats['nativeLive'] === 0 && $stats['identities'] === 0, 'native cleanup: ' . json_encode($stats));
    check($stats['scopes'] === 0 && $stats['depth'] === 0, 'call cleanup: ' . json_encode($stats));
}

$first = ticket(); $alias = $first; $kept = $first->retain();
$result = owned_call('retainTicket', [$first]);
check(resource_closed($alias) && !resource_closed($kept), 'shared aliases close, independent retain survives');
check((string) owned_call('serial', [$result]) === '17');
check((string) owned_call('serial', [$kept]) === '17');
dispose([$first, $alias, $kept, $result]); unset($first, $alias, $kept, $result); balanced();

$input = bundle();
reject(fn() => owned_call('callbackRecord', [$input, 42]), null, TypeError::class);
check(!resource_closed($input->primary)); $escaped = null;
$result = owned_call('callbackRecord', [$input, static function($value) use ($input, &$escaped) {
    check(is_closed($input), 'handoff is visible during callback reentry'); $escaped = $value->primary;
    reject(fn() => owned_call('echoRecord', [$value]), null, TypeError::class);
    $retained = $value->primary->retain(); $moved = owned_call('retainTicket', [$retained]);
    check(resource_closed($retained)); check((string) owned_call('serial', [$moved]) === '17');
    $moved->close(); return $value;
}]);
check(is_closed($input) && resource_closed($escaped));
$sibling = $result->spare->value; $moved = owned_call('retainTicket', [$result->primary]);
check(resource_closed($sibling), 'moving one field closes siblings sharing its result lease');
dispose([$input, $result, $moved]); unset($input, $result, $escaped, $sibling, $moved); balanced();

$first = ticket();
reject(fn() => owned_call('bundle', [$first, null, [$first], [], payload()]), null, TypeError::class);
check(!resource_closed($first), 'duplicate consuming owner rejects before handoff');
$second = ticket(29); $result = owned_call('bundle', [$first, null, [$second], [], payload()]);
check(resource_closed($first) && resource_closed($second));
check((string) owned_call('serial', [$result->peers[0]]) === '29');
$primary = owned_call('primary', [$result]);
check((string) owned_call('serial', [$primary]) === '17');
check(semantic_value(owned_call('payload', [$result])) === semantic_value(payload()));
dispose([$first, $second, $result, $primary]); unset($first, $second, $result, $primary); balanced();

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
    $input = $make(); $expected = semantic_value($input); $result = owned_call($name, [$input]);
    check(is_closed($input), $name . ' consumes input leases');
    check(semantic_value($result) === $expected, $name . ' preserves values');
    dispose([$input, $result]); unset($input, $result); balanced();
}
$input = new TreeBranch([new TreeLeaf(ticket()), new TreeBranch([])]); $expected = semantic_value($input);
$result = owned_call('callbackRecursive', [$input, fn($value) => $value]);
check(is_closed($input) && semantic_value($result) === $expected);
dispose([$input, $result]); unset($input, $result); balanced();
foreach (['makeRecord' => fn() => bundle(), 'makeRecursive' => fn() => new TreeLeaf(ticket())] as $name => $make) {
    $input = $make(); $expected = semantic_value($input); $closure = owned_call($name, [$input]); check(is_closed($input));
    $supplied = $make(); $result = $closure(true, $supplied);
    check(semantic_value($result) === $expected && !is_closed($supplied)); dispose($result);
    $result = $closure(false, $supplied); check(semantic_value($result) === semantic_value($supplied));
    dispose([$input, $result, $closure, $supplied]); unset($input, $result, $closure, $supplied); balanced();
}
$closure = owned_call('newRecordCallback', []); $kept = $closure->retain();
$moved = owned_call('transferCallback', [$closure]); check(resource_closed($closure) && !resource_closed($kept));
$input = bundle(); same_result($input, fn() => $moved($input)); same_result($input, fn() => $kept($input));
dispose([$input, $closure, $kept, $moved]); unset($input, $closure, $kept, $moved); balanced();

$sentinel = new RuntimeException('original callback error'); $input = bundle();
check(reject(fn() => owned_call('callbackRecord', [$input, static function($value) use ($sentinel) { throw $sentinel; }])) === $sentinel);
check(is_closed($input)); dispose($input); unset($input); balanced();
$errors = []; $faults = [];
foreach (['single', 'multiple'] as $shape) {
    $counts = ['before' => 0, 'after' => 0]; $completed = false;
    for ($point = 1; $point < 2000; $point++) {
        $input = $shape === 'single' ? bundle() : [ticket(), ticket(29)];
        $arguments = $shape === 'single' ? [$input, fn($value) => $value] : [$input[0], null, [$input[1]], [], payload()];
        $before = owned_transfer_stats()['handoffs']; $result = null; $error = null;
        owned_transfer_fault($point);
        try { $result = owned_call($shape === 'single' ? 'callbackRecord' : 'bundle', $arguments); }
        catch (Throwable $caught) { $error = $caught; }
        finally { owned_transfer_fault(0); }
        $consumed = owned_transfer_stats()['handoffs'] !== $before;
        foreach (leaves($input) as $leaf) check(resource_closed($leaf) === $consumed, $shape . ' handoff at ' . $point);
        if ($error !== null) {
            check($error->getCode() === 3, $point . ': ' . $error->getMessage());
            $counts[$consumed ? 'after' : 'before']++; $errors[] = $error;
        } else { check($consumed); $completed = true; }
        dispose([$input, $result]); unset($input, $result, $arguments, $leaf, $error, $caught); balanced();
        if ($completed) break;
    }
    check($completed && $counts['before'] > 0 && $counts['after'] > 0); $faults[$shape] = $counts;
}
$heldErrors = count($errors); unset($errors, $sentinel); gc_collect_cycles(); balanced(); Native::close();
$stats = owned_transfer_stats(); check($stats['live'] === 0 && $stats['identities'] === 0, json_encode($stats));
$names = array_keys($functions); sort($names);
echo json_encode(['checks' => $checks, 'faults' => $faults, 'heldErrors' => $heldErrors,
    'phpBits' => $stats['phpBits'], 'live' => $stats['live'], 'identities' => $stats['identities'], 'functions' => $names]), "\n";
