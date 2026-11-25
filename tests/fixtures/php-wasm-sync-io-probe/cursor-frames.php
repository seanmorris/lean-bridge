<?php
declare(strict_types=1);
namespace __TRANSPORT__ {
    // Substitute only the private frame producer, not the generated PHP decoder.
    function call0() { return $GLOBALS['open'] ?? fopen('php://memory','r'); }
    function next0($h) { return $GLOBALS['frame']; }
    function close0($h) { fclose($h); ++$GLOBALS['closed']; return 0; }
    function retire() { ++$GLOBALS['retired']; }
}
namespace {
    require '/vendor/lean-bridge/ledger/bootstrap.php';
    $retired=$closed=$checks=0;
    $try=function($class,$run) use (&$checks) {
        try { $run(); } catch (\Throwable $e) {
            if (!$e instanceof $class) throw $e;
            ++$checks; return $e;
        }
        throw new \Exception('missing '.$class);
    };
    $open="\0\0"; // Successful open must return a Zend resource, never a value frame.
    $try(\LeanLedger\LeanBridgeError::class,fn()=>\LeanLedger\checked());
    $open="\3\0factory";
    $e=$try(\LeanLedger\CheckedError::class,fn()=>\LeanLedger\checked());
    if ($e->payload!=='factory' || $e->declaration!=='Lab.checked') throw new \Exception('open');
    unset($open);
    foreach (["\2\0x","\2\1","\4\0unexpected","\0\0bad"] as $frame) {
        $try(\LeanLedger\LeanBridgeError::class,fn()=>iterator_to_array(\LeanLedger\checked()));
    }
    $frame="\3\0step";
    $e=$try(\LeanLedger\CheckedStepError::class,fn()=>iterator_to_array(\LeanLedger\checked()));
    if ($e->payload!=='step' || $e->declaration!=='Lab.step') throw new \Exception('step');
    echo "frames:$checks;retired:$retired;closed:$closed";
}
