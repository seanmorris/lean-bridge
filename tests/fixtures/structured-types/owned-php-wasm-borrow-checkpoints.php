<?php
declare(strict_types=1);

$remaining = -1; $injected = null; $abortOwner = false;
function owned_php_checkpoint(string $phase = 'wire'): void {
    global $remaining, $injected, $abortOwner;
    if ($abortOwner && $phase === 'owner') owned_transfer_bailout();
    if ($remaining === 0) { $injected = new RuntimeException('Injected PHP-Wasm construction failure'); throw $injected; }
    if ($remaining > 0) $remaining--;
}
