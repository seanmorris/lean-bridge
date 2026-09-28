<?php
declare(strict_types=1);

require __DIR__ . '/probe.php';

use Brick\Math\BigInteger as Big;
use LeanOwnedAggregates\{Bytes, Some, Payload, Bundle};
use function LeanOwnedAggregates\{new_ticket, callback_record};

function abortGeneratedRequest(int $mode): void {
    $GLOBALS['ticket'] = new_ticket(Big::of(77), 'abort');
    $GLOBALS['bundle'] = new Bundle($GLOBALS['ticket'], new Some($GLOBALS['ticket']), [$GLOBALS['ticket']], [],
        new Payload(Big::of(-1), Bytes::fromString('abort')));
    $GLOBALS['result'] = callback_record($GLOBALS['bundle'], static function($value) use ($mode) {
        $GLOBALS['escaped'] = $value->primary;
        $GLOBALS['retained'] = $value->primary->retain();
        if ($mode === 0) return $value;
        if ($mode === 1) exit(0);
        if ($mode === 2) owned_generated_bailout();
        if ($mode === 3) return callback_record($value, static function($inner) {
            $GLOBALS['inner'] = $inner; owned_generated_bailout();
        });
        if ($mode === 4 || $mode === 5) {
            $local = new class($value, $mode) {
                public function __construct(public Bundle $value, public int $mode) {}
                public function __destruct() {
                    if ($this->mode === 4) owned_generated_bailout();
                    exit(0);
                }
            };
            return $value;
        }
        if ($mode === 6) {
            $GLOBALS['ticket']->close(); $GLOBALS['retained']->close(); $value->primary->close();
            owned_generated_bailout();
        }
        if ($mode === 7) {
            // A hostile caller can reach private extension functions. Even
            // shutdown during an active public call must unwind its scopes.
            $shutdown = $GLOBALS['model']['transport'] . '\\shutdown'; $shutdown();
            $GLOBALS['ticket']->close(); $GLOBALS['retained']->close(); $value->primary->close();
            owned_generated_bailout();
        }
        throw new RuntimeException('Unknown generated abort mode');
    });
    if ($mode !== 0) throw new RuntimeException('Generated abort returned');
}
