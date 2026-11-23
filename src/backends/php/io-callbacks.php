<?php
declare(strict_types=1);
namespace __LB_PUBLIC__;

final class CallbackClosed extends \RuntimeException {}

/** Optional explicit lifetime for an invokable. Ordinary closures work directly. */
final class RetainedCallback {
    private readonly int $pid;
    private ?\Closure $fn;
    public function __construct(callable $fn) {
        $this->pid=getmypid();
        $this->fn=Internal\CallbackPump::bind($fn);
    }
    private function context(): void {
        if ($this->pid!==getmypid()) throw new \LogicException('Cannot use an inherited callback after fork');
    }
    public function __invoke(mixed $arg): mixed {
        $this->context();
        $fn=$this->fn??throw new CallbackClosed('Retained PHP callback is closed');
        return $fn($arg);
    }
    public function close(): void { $this->context(); $this->fn=null; }
    public function isClosed(): bool { $this->context(); return $this->fn===null; }
    private function __clone() {}
    public function __serialize(): array { throw new \LogicException('Cannot serialize a retained callback'); }
    public function __unserialize(array $data): void { throw new \LogicException('Cannot restore a retained callback'); }
}

namespace __LB_PUBLIC__\Internal;

use Amp\Cancellation;
use Revolt\EventLoop;
use __LB_PUBLIC__\LeanBridgeError;

/** @internal One consumer-thread dispatcher. No PHP callback pointer crosses into Lean. */
final class CallbackPump {
    private array $bindings=[];
    private array $errors=[];
    private mixed $stream=null;
    private ?string $watch=null;
    private readonly int $pid;
    public function __construct(private readonly \FFI $ffi,private readonly \FFI\CData $h,private readonly array $ops,
        array $spec,array $args,private readonly ?Cancellation $cancel) {
        $this->pid=getmypid();
        foreach ($spec as [$slot,$in,$out]) $this->bindings[$slot]=[self::bind($args[$slot]),$in,$out];
    }
    public static function bind(mixed $fn): \Closure {
        if (!is_callable($fn)) throw new \TypeError('Expected a unary PHP callable');
        $call=\Closure::fromCallable($fn); $reflection=new \ReflectionFunction($call);
        $p=$reflection->getParameters();
        if ($reflection->isGenerator() || $reflection->returnsReference() || !$p || $p[0]->isPassedByReference() || $reflection->getNumberOfRequiredParameters()>1)
            throw new \TypeError('Expected a unary, by-value PHP callback, not a generator');
        return $call;
    }
    public function listen(Delivery $owner): void {
        $fd=$this->ffi->new('int'); $port=$this->ops['callbacks'];
        self::ok($this->ffi->$port($this->h,\FFI::addr($fd)));
        $this->stream=fopen('php://fd/'.$fd->cdata,'rb');
        if (!is_resource($this->stream)) throw new LeanBridgeError('Cannot watch Lean callback requests');
        $this->watch=EventLoop::onReadable($this->stream,function(string $id) use ($owner): void {
            // A nested await may drive another fiber or another component; it must
            // not redispatch the active request on this same native handle.
            EventLoop::disable($id);
            try {
                \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
                for ($n=0;$n<16 && $this->active();$n++) {
                    $slot=$this->ffi->new('uint32_t'); $next=$this->ops['next'];
                    $status=$this->ffi->$next($this->h,\FFI::addr($slot));
                    if ($status===1) break;
                    self::ok($status);
                    $this->dispatch($slot->cdata);
                }
            } catch (\Throwable $error) { $owner->close($error); }
            finally { if ($this->watch===$id && $this->active()) EventLoop::enable($id); }
        });
    }
    private function active(): bool { return $this->h[0]!==0 && !($this->cancel?->isRequested()??false); }
    private static function ok(int $status): void {
        if ($status!==0) throw new LeanBridgeError('Native callback delivery failed (status '.$status.')');
    }
    private function dispatch(int $slot): void {
        [$call,$in,$out]=$this->bindings[$slot]??throw new LeanBridgeError('Unknown Lean callback slot');
        $buffer=$this->ffi->new('lbphp_buffer'); $get=$this->ops['arg']; $dispose=$this->ops['dispose'];
        try {
            self::ok($this->ffi->$get($this->h,$slot,\FFI::addr($buffer)));
            $n=$buffer->length;
            if ($n<0 || $n>16777216 || ($n && ($buffer->data===null || \FFI::isNull($buffer->data)))) throw new LeanBridgeError('Invalid callback payload');
            $value=WireValues::output($in,"\0",$n?\FFI::string($buffer->data,$n):'');
        } finally { $this->ffi->$dispose(\FFI::addr($buffer)); }
        try { $reply=$call($value); }
        catch (\Exception $error) {
            if (!$this->active()) return;
            $message=$error->getMessage();
            if (strlen($message)>16777216 || preg_match('//u',$message)!==1) $message='PHP callback failed';
            $id=$this->ffi->new('uint32_t'); $fail=$this->ops['fail'];
            self::ok($this->ffi->$fail($this->h,$message,strlen($message),\FFI::addr($id)));
            if ($id->cdata!==count($this->errors)+1) throw new LeanBridgeError('Invalid callback exception identity');
            $this->errors[$id->cdata]=$error;
            return;
        } catch (\Error $trap) {
            $retire=$this->ops['trap']; $this->ffi->$retire(); throw $trap;
        }
        if (!$this->active()) return;
        $bytes=WireValues::input($out,$reply,new Budget());
        if (!$this->active()) return;
        $data=$this->ffi->new('lbphp_buffer'); $scope=new Scope($this->ffi); $put=$this->ops['reply'];
        try {
            $data->data=$scope->buffer($bytes); $data->length=strlen($bytes);
            self::ok($this->ffi->$put($this->h,$slot,\FFI::addr($data)));
        } finally { $scope->close(); }
    }
    public function original(int $id): \Throwable { return $this->errors[$id]??throw new LeanBridgeError('Unknown callback exception identity'); }
    public function close(): void {
        if ($this->pid!==getmypid()) return;
        if ($this->watch!==null) { EventLoop::cancel($this->watch); $this->watch=null; }
        if (is_resource($this->stream)) fclose($this->stream);
        $this->stream=null; $this->bindings=[]; $this->errors=[];
    }
    public function __destruct() { $this->close(); }
}
