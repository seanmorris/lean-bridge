<?php
declare(strict_types=0);

function abortOwnedRequest(int $mode): void {
    $GLOBALS['owner'] = owned_probe_new();
    $GLOBALS['retained'] = owned_probe_retain($GLOBALS['owner']);
    owned_probe_borrow($GLOBALS['owner'], function ($borrow) use ($mode) {
        $GLOBALS['escapedBorrow'] = $borrow;
        if ($mode === 0) return null; // Normal shutdown with unclosed wrappers.
        if ($mode === 1) exit(0);
        if ($mode === 2) owned_probe_bailout();
        if ($mode === 3) {
            owned_probe_borrow($borrow, function ($inner): void {
                $GLOBALS['inner'] = $inner;
                owned_probe_bailout();
            });
        }
        if ($mode === 4 || $mode === 5) return new class($borrow, $mode) {
            public function __construct(public mixed $borrow, public int $mode) {}
            public function __destruct() {
                try {
                    owned_probe_check($this->borrow);
                    throw new RuntimeException('destructor_saw_live_borrow');
                } catch (Exception $failure) {
                    if ($failure->getCode() !== 4) throw $failure;
                }
                if ($this->mode === 4) owned_probe_bailout();
                exit(0);
            }
        };
        if ($mode === 6) {
            owned_probe_shutdown();
            owned_probe_close($GLOBALS['owner']);
            owned_probe_close($GLOBALS['retained']);
            owned_probe_close($borrow);
            owned_probe_bailout();
        }
        throw new RuntimeException('unknown_abort_mode');
    });
    if ($mode !== 0) throw new RuntimeException('abort_returned');
}
