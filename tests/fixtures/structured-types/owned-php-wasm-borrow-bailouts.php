<?php
declare(strict_types=1);
require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Payload, Bundle};
use function LeanOwnedAggregates\{new_ticket, callback_record, move_record, copy_value};

function abortBorrowRequest(int $mode, bool $consume): void {
    $GLOBALS['ticket'] = new_ticket(Big::of(77), 'abort');
    $raw = $GLOBALS['ticket']->get();
    $GLOBALS['owner'] = copy_value(new Bundle($raw, new Some($raw), [$raw], [],
        new Payload(Big::of(-1), Bytes::fromString('abort'))));
    $GLOBALS['view'] = callback_record($GLOBALS['owner'], static fn($value) => $value);
    $call = $consume ? move_record(...) : callback_record(...);
    if ($mode === 8) $GLOBALS['abortOwner'] = true;
    $GLOBALS['result'] = $call($GLOBALS['owner'], static function($value) use ($mode) {
        $GLOBALS['escaped'] = $value->primary;
        $GLOBALS['retained'] = $value->primary->retain();
        if ($mode === 0 || $mode === 8) return $value;
        if ($mode === 1) exit(0);
        if ($mode === 2) owned_transfer_bailout();
        if ($mode === 3) {
            $GLOBALS['innerOwner'] = copy_value($value);
            return callback_record($GLOBALS['innerOwner'], static function($inner) {
                $GLOBALS['inner'] = $inner; owned_transfer_bailout();
            });
        }
        if ($mode === 4 || $mode === 5) {
            $local = new class($value, $mode) {
                public function __construct(public Bundle $value, public int $mode) {}
                public function __destruct() {
                    if ($this->mode === 4) owned_transfer_bailout();
                    exit(0);
                }
            };
            return $value;
        }
        if ($mode === 7) {
            $shutdown = $GLOBALS['model']['transport'] . '\\shutdown'; $shutdown();
        }
        if ($mode === 6 || $mode === 7) {
            $GLOBALS['ticket']->close(); $GLOBALS['owner']->close();
            $GLOBALS['retained']->close(); $value->primary->close();
            owned_transfer_bailout();
        }
        throw new RuntimeException('Unknown borrowed-result abort mode');
    });
    if ($mode !== 0) throw new RuntimeException('Borrowed-result abort returned');
}
