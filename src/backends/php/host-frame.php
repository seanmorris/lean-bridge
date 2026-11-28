<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use LeanBridge\NativeHostV2\References;

/** @internal Synchronous caller. All CData and reference tokens stay inside the component. */
final class HostFrame {
    private static ?self $top=null;
    private static int $sequence=0;
    private static ?\WeakMap $gates=null;
    private array $inputs=[], $faults=[];
    private ?\Throwable $fatal=null;
    private int $boundary=0;
    private int $reply=0;
    private ?HostWords $response=null;
    private function __construct(private readonly int $id, private readonly HostMembers $binding,
                                 private readonly \FFI $ffi) {}
    private function keep(object $v): int { $id=References::hold($v); $this->inputs[]=$id; return $id; }
    private function ref(int $op, int $a, int $b): int {
        if ($op===-8) { References::drop($a); return 0; }
        if ($op===-6) {
            $o=References::get($a); $c=References::get($b);
            return (int)(is_object($o) && is_string($c) && $o instanceof $c);
        }
        return match ($op) {
            -1=>References::hold($this->binding,true),
            -2=>(int)(References::get($a)!==null),
            -3=>(int)(References::get($a)===$this->binding),
            -4=>References::hold($this->binding->classAt($a)),
            -5=>(int)(References::get($a)===References::get($b)),
            -7=>References::hold(References::get($a)),
            -9=>$this->keep(References::get($a)),
            default=>throw new \UnexpectedValueException('Unknown native PHP reference operation')
        };
    }
    private function releaseReply(): void {
        if ($this->reply) { References::drop($this->reply); $this->reply=0; }
        $this->response=null;
    }
    private function read(string|int $site, HostWords $words, \FFI\CData $data, int $i): mixed {
        if (is_string($site)) return $words->get($site,$data,$i);
        if ($data[$i+1]!==0 || $data[$i+2]!==0) throw new \UnexpectedValueException('Invalid nominal host words');
        $v=References::get($data[$i]); $this->binding->nominal($site,$v); return $v;
    }
    private function lift(string|int|array $site, HostWords $words, \FFI\CData $data, \FFI\CData $tags, int $depth=0): mixed {
        if (!is_array($site)) return $this->read($site,$words,$data,0);
        if ($depth>=64) throw new \UnexpectedValueException('Invalid native result depth');
        return match ($tags[$depth]) {
            1=>new \__LB_PUBLIC__\Ok($this->lift($site[0],$words,$data,$tags,$depth+1)),
            0=>new \__LB_PUBLIC__\Err($this->lift($site[1],$words,$data,$tags,$depth+1)),
            default=>throw new \UnexpectedValueException('Invalid native result tag')
        };
    }
    private static function gate(\FFI $ffi): \FFI\CData {
        self::$gates ??= new \WeakMap();
        if (isset(self::$gates[$ffi])) return self::$gates[$ffi];
        // One FFI trampoline per loaded component, not one permanent callback per call.
        $gate=$ffi->new('php_host_gate');
        $gate->fn=static function(int $id,int $op,$args,int $n,$out,$fault): int {
            $f=self::$top;
            try {
                if (!$f || $f->id!==$id) return 2;
                if ($op<0) {
                    if ($n!==2) throw new \UnexpectedValueException('Invalid reference operation arity');
                    $out[0]=$f->ref($op,$args[0],$args[1]); return 0;
                }
                if ($f->fatal) return 2;
                if ($f->boundary) { $fault[0]=$f->boundary; return 1; }
                $f->releaseReply();
                $spec=$f->binding->memberAt($op);
                if ($n!==count($spec['args'])) throw new \UnexpectedValueException('Invalid member arity');
                $words=new HostWords($f->ffi); $values=[];
                foreach ($spec['args'] as $i=>$site) $values[]=$f->read($site,$words,$args,$i*3);
                try {
                    [$ok,$value]=$f->binding->invoke($op,$values);
                    if (!$ok) {
                        $f->faults[]=$value; $fault[0]=count($f->faults); return 1;
                    }
                    if (is_int($spec['result'])) $out[0]=$f->reply=References::hold($value);
                    else { $f->response=new HostWords($f->ffi); $f->response->put($spec['result'],$value,$out,0); }
                } catch (\TypeError|\ValueError $e) {
                    // The application returned an invalid value (or accessed an
                    // unset property). Keep it distinct from an IO error that
                    // Lean may translate, without retiring a healthy runtime.
                    $f->faults[]=$e; $fault[0]=$f->boundary=count($f->faults); return 1;
                }
                return 0;
            } catch (\Throwable $e) {
                // No PHP exception may unwind through a foreign frame.
                if ($f) $f->fatal=$e;
                return 2;
            }
        };
        return self::$gates[$ffi]=$gate;
    }
    /** Return private [success|declared|io, payload]; restore original throws only after C returns. */
    public static function call(\FFI $ffi,string $prefix,HostMembers $binding,int $op,array $args,array $params,
                                string|int|array $result='unit',string|int|array|null $error=null): array {
        if (!array_is_list($args) || count($params)!==count($args)) throw new \ArgumentCountError('Wrong host argument count');
        if (self::$sequence===PHP_INT_MAX) throw new \OverflowException('Native call sequence exhausted');
        $f=new self(++self::$sequence,$binding,$ffi); $parent=self::$top;
        self::$top=$f;
        try {
            $in=$ffi->new('uint64_t['.max(1,3*count($args)).']'); $out=$ffi->new('uint64_t[4]');
            $tags=$ffi->new('uint8_t[64]'); $fault=$ffi->new('uint32_t[1]'); $words=new HostWords($ffi);
            foreach ($params as $i=>$site) {
                if (is_int($site)) { $binding->nominal($site,$args[$i]); $in[$i*3]=$f->keep($args[$i]); }
                else $words->put($site,$args[$i],$in,$i*3);
            }
            $gate=self::gate($ffi); $fn=$prefix.'_call'; $clear=$prefix.'_clear';
            try {
                $status=$ffi->$fn($f->id,$gate->fn,$op,$in,count($args),$out,$tags,$fault);
                if ($f->fatal) throw $f->fatal;
                if ($f->boundary) throw $f->faults[$f->boundary-1];
                if ($status===13) throw ($f->faults[$fault[0]-1] ?? new \UnexpectedValueException('Unknown PHP exception ticket'));
                if ($status===4) return ['io',$words->get('string',$out,0)];
                if ($status===3 && $error!==null) return ['declared',$f->lift($error,$words,$out,$tags)];
                if ($status!==0) throw new \RuntimeException('Native PHP host call failed (status '.$status.')');
                return ['success',$f->lift($result,$words,$out,$tags)];
            } finally { $ffi->$clear($out); }
        } finally {
            self::$top=$parent;
            $f->releaseReply(); foreach ($f->inputs as $id) References::drop($id);
        }
    }
}
