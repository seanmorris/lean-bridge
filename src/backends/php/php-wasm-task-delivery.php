<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

final class TaskCancelled extends \RuntimeException {}

/** One owning PHP object. Repeated awaits return the same value or throw the same error. */
abstract class Awaitable {
    private bool $observed=false;
    private bool $observing=false;
    private mixed $value=null;
    private ?\Throwable $failure=null;
    final protected function __construct(private ?object $owner, private readonly \Closure $decode) {}
    private function __clone() {}
    final public function __serialize(): array { throw new \LogicException('Cannot serialize an active Lean owner'); }
    final public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean owner'); }
    final public function cancel(): bool { return $this->owner?->cancel() ?? false; }
    final public function __destruct() { $this->cancel(); }
    final protected function take(): mixed {
        if ($this->observing) throw new \LogicException('Reentrant observation of the same Lean task');
        if (!$this->observed) {
            $this->observing=true;
            try { $this->value=($this->decode)(vrzno_await($this->owner->result())); }
            catch (\Throwable $error) { $this->failure=$error; }
            finally { $this->owner=null; $this->observing=false; $this->observed=true; }
        }
        if ($this->failure!==null) throw $this->failure;
        return $this->value;
    }
}

/** A one-pass, demand-driven sequence. Breaking a foreach closes its Lean cursor. */
final class PullStream implements \IteratorAggregate {
    private bool $started=false;
    private function __construct(private ?object $owner, private readonly \Closure $decode) {}
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a Lean cursor'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean cursor'); }
    public function close(): void {
        if ($this->owner===null) return;
        $owner=$this->owner; $this->owner=null;
        if (vrzno_await($owner->close())!=='["end"]') throw new LeanBridgeError('Failed to close Lean cursor');
    }
    public function __destruct() { $this->owner?->dispose(); }
    public function getIterator(): \Traversable {
        if ($this->started || $this->owner===null) throw new \LogicException('Lean cursor is closed or already in use');
        $this->started=true;
        try {
            while ($this->owner!==null) {
                $packet=vrzno_await($this->owner->next());
                if ($packet==='["end"]') break;
                yield ($this->decode)($packet);
            }
        } finally { $this->close(); }
    }
}
