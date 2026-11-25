<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';
use Amp\Future;
use LeanWorkshop\PullStream;
use function LeanWorkshop\withHosts;

final class Box {
    public function __construct(public int $level) {}
    public function read(): int { return $this->level; }
    public function identity(): self { return $this; }
}
function check(bool $ok, string $phase): void { if (!$ok) throw new LogicException($phase); }
$api = withHosts(['Box' => Box::class]);
try {
    check($api->read(new Box(41)) === 41, 'host binding');
    check($api->read_boot() === 'from-app', 'startup');
    putenv('LEAN_BRIDGE_EFFECT_BOOT=after-init');
    check($api->read_boot() === 'from-app', 'initializer ran again');
    $file = 'state';
    file_put_contents($file, 'open');
    check($api->observe($file) === 37, 'synchronous IO');
    $task = $api->worker($file);
    check($task instanceof Future && $task->await() === 37, 'Amp future');
    $stream = $api->walk($file);
    check($stream instanceof PullStream, 'stream type');
    $pulls = 0;
    foreach ($stream as $value) {
        if (++$pulls === 1) {
            check($value === 37 && file_get_contents($file) === 'open', 'first pull');
            file_put_contents($file, 'changed');
        } else {
            check($value === 0 && file_get_contents($file) === 'changed', 'second pull');
            break;
        }
    }
    check($pulls === 2 && file_get_contents($file) === 'closed', 'early-break finalizer');
    file_put_contents($file, 'after-close');
    $stream->close();
    foreach ($stream as $_) throw new LogicException('closed stream yielded');
    check(file_get_contents($file) === 'after-close', 'repeated close changed the file');
} finally { $api->close(); }
echo "PHP startup, sync IO, Amp future, independent pulls and early-break close passed\n";
