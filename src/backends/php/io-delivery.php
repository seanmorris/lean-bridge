<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;

use Amp\Cancellation;
use Amp\DeferredFuture;
use Amp\Future;
use Revolt\EventLoop;
use __LB_PUBLIC__\LeanBridgeError;

/** @internal A single original-process native owner, with at most one outstanding pull. */
final class Delivery {
    private static ?\WeakMap $live=null;
    private readonly int $pid;
    private bool $closed=false;
    private ?\Throwable $reason=null;
    private ?string $subscription=null;
    private ?DeferredFuture $pending=null;
    private ?string $watcher=null;
    private mixed $stream=null;
    private ?\FFI\CData $gate=null;

    public function __construct(private readonly \FFI $ffi,private readonly \FFI\CData $handle,
        private readonly array $ops,private readonly \Closure $take,private readonly ?Cancellation $cancel) {
        $this->pid=getmypid();
        if (self::$live===null) {
            self::$live=new \WeakMap();
            register_shutdown_function(static function() {
                $owners=[];
                foreach (self::$live as $owner=>$_) $owners[]=$owner;
                foreach ($owners as $owner) if ($owner->pid===getmypid()) $owner->close();
            });
        }
        self::$live[$this]=true;
    }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize Lean delivery'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore Lean delivery'); }
    public function __destruct() { if ($this->pid===getmypid()) $this->close(); }
    public function subscribe(): void {
        if ($this->cancel===null) return;
        $weak=\WeakReference::create($this);
        $this->subscription=$this->cancel->subscribe(static function(\Throwable $error) use ($weak) {
            $weak->get()?->close($error);
        });
        $this->cancel->throwIfRequested();
    }
    private function unwatch(): void {
        if ($this->watcher!==null) { EventLoop::cancel($this->watcher); $this->watcher=null; }
        if (is_resource($this->stream)) fclose($this->stream);
        $this->stream=null;
        if ($this->gate!==null) {
            $end=$this->ops['unwatch']; $this->ffi->$end($this->gate); $this->gate=null;
        }
    }
    public function close(?\Throwable $reason=null): void {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if ($this->closed) return;
        $this->closed=true;
        $this->reason=$reason;
        try {
            $this->unwatch();
        } finally {
            try {
                if ($this->handle[0]) {
                    $close=$this->ops['close']; $status=$this->ffi->$close($this->handle);
                    if ($status!==0 && $status!==6) throw new LeanBridgeError('Cannot close Lean delivery (status '.$status.')');
                }
            } finally {
                if ($this->subscription!==null) $this->cancel->unsubscribe($this->subscription);
                unset(self::$live[$this]);/*__LB_RELEASE_CALLBACKS__*/
                $pending=$this->pending; $this->pending=null;
                $pending?->error($reason??new LeanBridgeError('Lean stream closed during pull'));
            }
        }
    }
    public function read(): Future {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if ($this->closed) return $this->reason ? Future::error($this->reason) : Future::complete([]);
        if ($this->pending!==null) throw new \LogicException('A Lean pull is already pending');
        $pending=$this->pending=new DeferredFuture();
        try {
            $this->cancel?->throwIfRequested();
            if (isset($this->ops['pull'])) {
                $pull=$this->ops['pull']; $s=$this->ffi->$pull($this->handle);
                if ($s!==0) throw new LeanBridgeError('Cannot pull Lean stream (status '.$s.')');
            }
            $this->advance();
        } catch (\Throwable $error) { $this->close($error); }
        return $pending->getFuture();
    }
    private function advance(): void {
        if ($this->closed || $this->pending===null) return;
        try {
            \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
            $this->cancel?->throwIfRequested();
            $poll=$this->ops['poll']; $fd=$this->ffi->new('int');
            $s=$this->ffi->$poll($this->handle,\FFI::addr($fd));
            if ($s===1) {
                if ($this->gate!==null) return;
                $gate=$this->ffi->new('int[2]'); $open=$this->ops['watch'];
                if ($this->ffi->$open($fd->cdata,-1,$gate)!==0) throw new LeanBridgeError('Cannot watch Lean worker');
                $this->gate=$gate;
                $this->stream=fopen('php://fd/'.$gate[0],'rb');
                if (!is_resource($this->stream)) throw new LeanBridgeError('Cannot open Lean readiness descriptor');
                $this->watcher=EventLoop::onReadable($this->stream,function() { $this->advance(); });
                return;
            }
            if ($s!==0) throw new LeanBridgeError('Cannot observe Lean delivery (status '.$s.')');
            $this->unwatch();
            $result=($this->take)();
            $pending=$this->pending; $this->pending=null;
            if (!isset($this->ops['pull']) || $result===[]) $this->close();
            $pending->complete($result);
        } catch (\Throwable $error) {
            if (isset($pending) && !$pending->isComplete()) $pending->error($error);
            $this->close($error);
        }
    }
}

namespace __LB_PUBLIC__;

/** Single-pass stream. Each foreach iteration requests exactly one Lean item. */
final class PullStream implements \IteratorAggregate {
    private bool $iterating=false;
    private function __construct(private readonly Internal\Delivery $owner) {}
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a Lean stream'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a Lean stream'); }
    public function close(): void { $this->owner->close(); }
    public function getIterator(): \Traversable {
        if ($this->iterating) throw new \LogicException('Lean stream already has an iterator');
        $this->iterating=true;
        try {
            while (($item=$this->owner->read()->await())!==[]) yield $item[0];
        } finally {
            $this->iterating=false;
            $this->close();
        }
    }
}
