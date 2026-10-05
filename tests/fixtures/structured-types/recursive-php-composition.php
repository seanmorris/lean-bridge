<?php
declare(strict_types=1);
require __DIR__ . '/vendor/autoload.php';
$checks = 0;
function check(bool $value): void { global $checks; ++$checks; if (!$value) throw new RuntimeException('PHP composition assertion ' . $checks); }
$mode = $argv[1]; $request = json_decode(file_get_contents(__DIR__ . '/request.json'), true, 512, JSON_THROW_ON_ERROR);
$cedar = new LeanCedar\Parcel(new LeanCedar\VNext(new LeanCedar\VDone(7)));
$maple = new LeanMaple\Parcel(new LeanMaple\VNext(new LeanMaple\VDone(9)));
if ($mode === 'peer-first') { check(LeanStone\value() === 47); check(LeanMaple\echo_($maple)->equals($maple)); }
check(LeanCedar\echo_($cedar)->equals($cedar)); check(LeanCedar\value() === 41);
check(LeanMaple\echo_($maple)->equals($maple)); check(LeanMaple\value() === 43); check(LeanStone\value() === 47);
for ($i = 0; $i < 128; ++$i) {
    check(LeanCedar\echo_($cedar)->equals($cedar)); check(LeanMaple\echo_($maple)->equals($maple)); check(LeanStone\value() === 47);
}
$saved = LeanCedar\echo_($cedar);
$brokerPath = __DIR__ . '/vendor/lean-bridge/' . ($mode === 'peer-first' ? 'stone' : 'cedar') . '/native/linux-x64/liblean_bridge_native.so';
$broker = FFI::cdef('void lean_bridge_native_snapshot_read(void *); void lean_bridge_native_runtime_retire(void);', $brokerPath);
$snapshot = $broker->new('uint32_t[10]'); $broker->lean_bridge_native_snapshot_read(FFI::addr($snapshot));
check($snapshot[2] === 1 && $snapshot[3] === 3 && $snapshot[4] === 3);
$pid = pcntl_fork(); check($pid >= 0);
if ($pid === 0) {
    foreach ([fn() => LeanCedar\echo_($cedar), fn() => LeanMaple\echo_($maple), fn() => LeanStone\value()] as $call) {
        try { $call(); exit(1); } catch (RuntimeException $error) { if (!str_contains($error->getMessage(), 'fresh PHP process after fork')) exit(2); }
    }
    exit(0);
}
pcntl_waitpid($pid, $status); check($status === 0);
$paths = [];
foreach (explode("\n", file_get_contents('/proc/self/maps')) as $line) if (preg_match('~ (/[^\n]+/native/linux-x64/(lib[^/]+\.so))$~', $line, $match)) $paths[$match[2]][$match[1]] = true;
check(count($paths) === 8); $mappings = [];
foreach ($paths as $name => $locations) { check(count($locations) === 1); $mappings[$name] = hash_file('sha256', array_key_first($locations)); }
ksort($mappings);
$broker->lean_bridge_native_runtime_retire();
foreach ([fn() => LeanCedar\echo_($cedar), fn() => LeanMaple\echo_($maple), fn() => LeanStone\value()] as $call) {
    try { $call(); throw new RuntimeException('Missing retirement failure'); } catch (RuntimeException $error) { check($error->getCode() === 5); }
}
check($saved->equals($cedar)); check(getenv('PATH') === '/unavailable');
echo json_encode(['checks' => $checks, 'mode' => $mode, 'runtimeInitializations' => $snapshot[2], 'componentInitializations' => $snapshot[3],
    'forkRejected' => true, 'sharedRetirement' => true, 'mappings' => $mappings], JSON_THROW_ON_ERROR) . "\n";
