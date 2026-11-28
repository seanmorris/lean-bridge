<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

/** A single-pass cursor; neither the pointer nor the pull operations leave the package. */
final class Cursor implements \IteratorAggregate {
    private bool $iterating=false;
    private bool $closed=false;
    private readonly int $pid;
    private function __construct(private readonly \Closure $take, private readonly \Closure $release) {
        $this->pid=getmypid();
    }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a Lean cursor'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean cursor'); }
    public function close(): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if (!$this->closed) { ($this->release)(); $this->closed=true; }
    }
    public function getIterator(): \Traversable {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if ($this->closed) return;
        if ($this->iterating) throw new \LogicException('A Lean cursor is already being iterated');
        $this->iterating=true;
        try {
            while (!$this->closed) {
                $item=($this->take)();
                if ($item===[]) break;
                yield $item[0];
            }
        } finally {
            $this->iterating=false;
            // A child must never enter the parent's Lean runtime, even when a
            // copied, half-consumed generator unwinds after a fork.
            if (getmypid()===$this->pid) $this->close();
        }
    }
    public function __destruct() { if (isset($this->pid) && getmypid()===$this->pid) $this->close(); }
}
