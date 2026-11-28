<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

/** A single-pass cursor in this PHP interpreter's Zend request. */
final class Cursor implements \IteratorAggregate {
    private bool $active=false;
    private bool $closed=false;
    private function __construct(private readonly \Closure $next, private readonly \Closure $release) {}
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a Lean cursor'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean cursor'); }
    public function close(): void {
        if (!$this->closed) {
            $this->closed=true;
            ($this->release)();
        }
    }
    public function getIterator(): \Traversable {
        if ($this->closed) return;
        if ($this->active) throw new \LogicException('A Lean cursor is already being iterated');
        $this->active=true;
        try {
            while (!$this->closed) {
                $item=($this->next)();
                if ($item===[]) break;
                yield $item[0];
            }
        } finally {
            $this->close();
        }
    }
    // Zend also owns the native resource if request teardown bypasses PHP destructors.
    public function __destruct() { $this->close(); }
}
