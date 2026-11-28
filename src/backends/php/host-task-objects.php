<?php
declare(strict_types=1);
namespace __LB_PUBLIC__\Internal;
use LeanBridge\NativeHostV2\References;
use __LB_PUBLIC__\Bytes;

/** @internal Translate owner-domain objects to temporary, independently disposable worker leases. */
final class HostTaskObjects {
    public function __construct(private readonly \FFI $ffi, private readonly string $prefix,
                                private readonly string $dispose, private readonly HostMembers $binding) {}
    private function exchange(int $op,int $kind,mixed $value): mixed {
        $pin=$op===-3;
        References::enter(); $failed=true; $result=null;
        try {
            [, $result]=HostFrame::call($this->ffi,$this->prefix,$this->binding,$op,
                [$kind,$pin?$value:Bytes::fromString($value)],['uint32',$pin?$kind:'bytes'],
                $pin?'bytes':($op===-4?$kind:'unit'));
            $failed=false;
            return $pin?$result->toString():$result;
        } finally {
            try { References::leave($failed); }
            catch (\Throwable $e) {
                if ($pin && $result instanceof Bytes) $this->drop($kind,$result->toString());
                throw $e;
            }
        }
    }
    public function pin(int $kind,object $value): string { return $this->exchange(-3,$kind,$value); }
    public function resolve(int $kind,string $lease): object { return $this->exchange(-4,$kind,$lease); }
    public function admit(int $kind,string $lease): void { $this->exchange(-5,$kind,$lease); }
    /** A worker can release a wrapper outside a member frame. Sweep its weak
        registry root on the owner before a completed public operation returns. */
    public function sweep(): void {
        References::enter(); $failed=true;
        try { HostFrame::call($this->ffi,$this->prefix,$this->binding,-6,[],[]); $failed=false; }
        finally { References::leave($failed); }
    }
    public function drop(int $kind,string $lease): void {
        if (strlen($lease)!==16 || $kind<0 || $kind>=64) throw new \UnexpectedValueException('Invalid PHP worker lease');
        $out=$this->ffi->new('lbphp_buffer'); \FFI::memcpy($out->lease,$lease,16); $out->lease[3]=$kind+3;
        $dispose=$this->dispose; $this->ffi->$dispose(\FFI::addr($out));
    }
}
