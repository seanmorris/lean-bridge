<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use Amp\{Cancellation,Future};
use LeanBridge\NativeHostV2\References;
use __LB_PUBLIC__\{Err,Ok,LeanBridgeError,PullStream,IOError,TaskIOError};

/** @internal One native class binding, one policy for arguments, replies and errors. */
final class HostTasks {
    private readonly HostTaskObjects $objects;
    private readonly \WeakMap $live;
    private bool $closed=false;
    public function __construct(private readonly \FFI $ffi,HostMembers $members,string $prefix,
                                private readonly string $dispose,private readonly array $methods) {
        $this->objects=new HostTaskObjects($ffi,$prefix,$dispose,$members);
        $this->live=new \WeakMap();
    }
    public function close(): void {
        if ($this->closed) return;
        $this->closed=true;
        $pending=[]; foreach ($this->live as $job=>$_) $pending[]=$job;
        $first=null;
        foreach ($pending as $job) {
            try { $job->close(new \LogicException('PHP host binding is closed')); }
            catch (\Throwable $e) { $first??=$e; }
        }
        try { $this->objects->sweep(); } catch (\Throwable $e) { $first??=$e; }
        if ($first) throw $first;
    }
    private function decode(string|int|array $type,\FFI\CData $out,string $tags='',int $i=0): mixed {
        if (is_array($type)) return match (isset($tags[$i])?ord($tags[$i]):-1) {
            1=>new Ok($this->decode($type[0],$out,$tags,$i+1)),
            0=>new Err($this->decode($type[1],$out,$tags,$i+1)),
            default=>throw new \UnexpectedValueException('Malformed worker result tag')
        };
        $n=$out->length;
        if (is_int($type)) {
            if ($out->lease[3]!==$type+3 || !$out->lease[0] || !$out->lease[1] || $out->lease[2] || $n)
                throw new \UnexpectedValueException('Wrong native worker object kind');
            return $this->objects->resolve($type,\FFI::string($this->ffi->cast('char *',\FFI::addr($out->lease[0])),16));
        }
        if ($out->lease[3] || $n<0 || $n>16777216 || ($n && ($out->data===null || \FFI::isNull($out->data))))
            throw new \UnexpectedValueException('Malformed copied worker result');
        return WireValues::output($type,'',$n?\FFI::string($out->data,$n):'');
    }
    /** No PHP application callback or await inside this frame. Pins are provisional
        until native validation accepts the entire call; always dispose temporary leases. */
    private function withInputs(array $types,array $args,\Closure $send): int {
        References::enter(); $failed=true; $pins=[]; $scope=new Scope($this->ffi); $values=new Budget();
        try {
            $in=$this->ffi->new('lbphp_buffer['.max(1,count($types)).']');
            foreach ($types as $i=>$type) {
                if ($type==='callback') continue;
                if (is_int($type)) {
                    $s=$this->objects->pin($type,$args[$i]); $pins[]=[$type,$s];
                } else $s=WireValues::input($type,$args[$i],$values);
                $in[$i]->data=$scope->buffer($s); $in[$i]->length=strlen($s);
            }
            $status=$send($in);
            if (in_array($status,[0,3,4],true)) foreach ($pins as [$kind,$s]) $this->objects->admit($kind,$s);
            $failed=false;
            return $status;
        } finally {
            try { foreach ($pins as [$kind,$s]) $this->objects->drop($kind,$s); $scope->close(); }
            finally { References::leave($failed); }
        }
    }
    private function reply(string|int $type,mixed $v,string $fn,\FFI\CData $h,int $slot,\Closure $active): void {
        $status=$this->withInputs([$type],[$v],fn($in)=>$active()?$this->ffi->$fn($h,$slot,$in):6);
        if ($status!==0 && $active()) throw new LeanBridgeError('Native callback reply failed (status '.$status.')');
    }
    public function start(int $id,array $args,?Cancellation $cancel): Future|PullStream {
        \LeanBridge\CopiedNativeV1\Runtime::ensureProcess();
        if ($this->closed) throw new \LogicException('PHP host binding is closed');
        $cancel?->throwIfRequested();
        $m=$this->methods[$id]; $fn=$m['fn']; $ops=$m['ops']; $stream=isset($ops['pull']); $ffi=$this->ffi;
        $h=$ffi->new('uint64_t[2]'); $pump=null;
        if ($m['callbacks']) {
            $q=$m['queue']+['decode'=>$this->decode(...),'replyValue'=>$this->reply(...)];
            $pump=new CallbackPump($ffi,$h,$q,$m['callbacks'],$args,$cancel);
        }
        $ops['releaseCallbacks']=function() use($pump) {
            try { $pump?->close(); }
            finally { if (!$this->closed) $this->objects->sweep(); }
        };
        $invoke=function(bool $taking) use($ffi,$h,$fn,$m,$stream,$pump,&$args): mixed {
            $out=$ffi->new('lbphp_buffer'); $p=\FFI::addr($out); $depth=$m['depth']; $tags=$ffi->new('uint8_t['.$depth.']');
            try {
                if ($taking) { $take=$fn.'_take'; $s=$ffi->$take($h,$p,$tags,$depth); }
                else $s=$this->withInputs($m['args'],$args,fn($in)=>$ffi->$fn($in,count($args),$p,$tags,$depth,$h));
                $tagBytes=\FFI::string($ffi->cast('char *',\FFI::addr($tags[0])),$depth);
                if ($s===0) {
                    if (!$taking) return null;
                    $v=$this->decode($m['result'],$out,$tagBytes); return $stream?[$v]:$v;
                }
                if ($taking && $stream && $s===2) return [];
                if ($taking && $pump && $s===14) throw $pump->original($this->decode('uint32',$out));
                if ((!$taking && $s===4 || $taking && $pump && $s===13) && $m['effect']==='IO')
                    throw new IOError($m['name'],$this->decode('string',$out));
                if ($s===3 && $m['effect']==='EIO' && (!$taking || $pump)) {
                    $class=$m['factoryError']; throw new $class($m['name'],$this->decode($m['error'],$out,$tagBytes));
                }
                if ($taking && $m['terminal']!==null && $s===$m['terminalStatus']) {
                    $class=$m['terminalError']; throw new $class($m['step']??$m['name'],$this->decode($m['terminal'],$out,$tagBytes));
                }
                throw new LeanBridgeError('Native worker failed in '.$m['name'].' (status '.$s.')');
            } finally { $dispose=$this->dispose; $ffi->$dispose($p); }
        };
        $owner=new Delivery($ffi,$h,$ops,fn()=>$invoke(true),$cancel);
        $this->live[$owner]=true;
        try {
            $invoke(false); $args=[]; // The C frame consumed the arguments; do not retain PHP inputs until settlement.
            if ($this->closed) throw new \LogicException('PHP host binding is closed');
            $owner->subscribe(); $pump?->listen($owner);
            if (!$stream) return $owner->read();
            $make=\Closure::bind(static fn()=>new PullStream($owner),null,PullStream::class);
            return $make();
        } catch (\Throwable $e) { $owner->close($e); throw $e; }
    }
}
