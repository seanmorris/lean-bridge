<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedOne as A;
use LeanOwnedTwo as B;
use LeanCopiedGraph as C;

$checks = 0; $callbacks = 0; $foreignRejections = 0;
function check(bool $condition): void {
    global $checks; $checks++;
    if (!$condition) throw new RuntimeException('Mixed installed PHP packages differ');
}
foreach (explode(',', $argv[1]) as $first) {
    check(match ($first) { 'one' => A\value() === 44, 'two' => B\value() === 45, 'graph' => C\value() === 41 });
}
for ($index = 0; $index < 32; $index++) {
    $number = Big::of('340282366920938463463374607431768211457')->plus($index);
    $one = A\ticket($number); $two = B\ticket($number->plus(1));
    $parcel = new A\Parcel($one, A\Bytes::fromString("\0\xffone"));
    $other = new B\Parcel($two, B\Bytes::fromString("\xff\0two"));
    $escaped = null; $retained = null;
    $result = A\through($parcel, static function($input) use ($other, &$callbacks, &$escaped, &$retained) {
        $callbacks++; $escaped = $input->ticket; $retained = $input->ticket->retain();
        $reply = B\through($other, static function($value) {
            $tree = C\echo_(new C\NodeNext(new C\NodeDone(91)));
            check($tree instanceof C\NodeNext && $tree->next instanceof C\NodeDone && $tree->next->value === 91);
            return $value;
        });
        check($reply->bytes->toString() === "\xff\0two"); $reply->ticket->close();
        return new A\Parcel($input->ticket, A\Bytes::fromString('reply'));
    });
    check((string) A\read($result->ticket) === (string) $number);
    check((string) A\read($retained) === (string) $number);
    check($result->bytes->toString() === 'reply');
    try { A\read($escaped); throw new RuntimeException('Expired callback borrow accepted'); }
    catch (A\LeanBridgeError $error) { check($error->getCode() === 4); }
    foreach ([fn() => A\read($two), fn() => B\read($one)] as $foreign) {
        try { $foreign(); throw new RuntimeException('Foreign component accepted'); }
        catch (TypeError $error) { $foreignRejections++; }
    }
    check((string) B\read($two) === (string) $number->plus(1));
    $retained->close(); $result->ticket->close(); $one->close(); $two->close();
}
gc_collect_cycles();
$roots = array_map(static fn(string $name): string => __DIR__ . '/vendor/lean-bridge/' . $name . '/native/linux-x64', ['owned-one', 'owned-two', 'copied-graph']);
$mappings = [];
foreach (explode("\n", file_get_contents('/proc/self/maps')) as $line) {
    if (preg_match('~\s(/[^\n]+/(lib(?:[^/]+_php|copied_graph|lean[^/]*|gmp-lean-bridge[^/]*|component_[^/]*)\.so(?:\.\d+)*))$~', $line, $match)) {
        check(count(array_filter($roots, static fn(string $root): bool => str_starts_with($match[1], $root . '/'))) === 1);
        $mappings[$match[2]][$match[1]] = true;
    }
}
check(count($mappings) === 9);
foreach ($mappings as $paths) check(count($paths) === 1);
$ffi = FFI::cdef('typedef struct {
    uint32_t abi_version, runtime_state, runtime_init_runs, component_init_runs, attached_components, live_identities;
    uint64_t runtime_instance_id, identity_domain_id;
} snapshot;
void lean_bridge_native_snapshot_read(snapshot *);', array_key_first($mappings['liblean_bridge_native.so']));
$snapshot = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($snapshot));
check($snapshot->runtime_init_runs === 1 && $snapshot->component_init_runs === 3);
check($snapshot->live_identities === 2); // One idle session per owned package.
$dl = FFI::cdef('void *dlopen(const char *, int); void *dlsym(void *, const char *);', 'libdl.so.2');
$gmp = $dl->dlopen(array_key_first($mappings['libgmp-lean-bridge.so.10']), 2 | 8 | 4096);
check($dl->dlsym($gmp, '__gmpz_init') != $dl->dlsym(null, '__gmpz_init'));
register_shutdown_function(static function() use ($ffi, $checks, $callbacks, $foreignRejections, $mappings): void {
    $snapshot = $ffi->new('snapshot'); $ffi->lean_bridge_native_snapshot_read(FFI::addr($snapshot));
    if ($snapshot->live_identities !== 0) throw new RuntimeException('Mixed-package automatic cleanup leaked');
    echo json_encode(['checks' => $checks, 'callbacks' => $callbacks, 'foreignRejections' => $foreignRejections,
        'runtimeInitializations' => $snapshot->runtime_init_runs, 'componentInitializations' => $snapshot->component_init_runs,
        'liveIdentities' => $snapshot->live_identities, 'mappings' => $mappings], JSON_THROW_ON_ERROR), "\n";
});
