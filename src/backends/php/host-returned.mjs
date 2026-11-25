/** @file Generate a site-typed, invokable PHP object over a private Lean function lease. */
/**
 * Emit a factory and its callable without exposing a native ticket to PHP callers.
 *
 * @param o - Verified factory, synchronous entry indices and PHP carrier spellings.
 */
export const phpReturnedMethod = o => {
	const {name,cls,args,inputs,arg,reply,hint,i,n,declaration}=o;
	return String.raw`    public function ${name}(${args.map(a=>"mixed "+a).join(", ")}): ${cls} {
        if (func_num_args()!==${args.length}) throw new \ArgumentCountError('Wrong number of arguments');
        if (!$this->open || $this->closing) throw new \LogicException('PHP host binding is closed');
        $Owner_=\WeakReference::create($this);
        $State_=new Internal\HostFunctionCell(
            static function($id,$arg) use ($Owner_) {
                $b=$Owner_->get();
                if (!$b || !$b->open || $b->closing) throw new \LogicException('Returned PHP function has no live binding');
                return $b->_call(${n+i},[$id,$arg],['uint64',${arg}],${reply},null,${declaration});
            },
            static function($id,$commit) use ($Owner_) {
                $b=$Owner_->get();
                if (!$b || !$b->open || $b->closing) { $commit(); return; }
                $b->_call(${2*n+i},[$id],['uint64'],'unit',null,'',null,$commit);
            });
        $Result_=new class($State_) implements ${cls} {
            public function __construct(private readonly Internal\HostFunctionCell $state) {}
            private function __clone() {}
            public function __invoke(mixed $value): ${hint} {
                if (func_num_args()!==1) throw new \ArgumentCountError('Returned function expects one argument');
                return $this->state->invoke($value);
            }
            public function close(): void { $this->state->close(); }
        };
        $this->_call(${i},[${args.join(",")}],${inputs},'uint64',null,${declaration},null,$State_->attach(...));
        return $Result_;
    }`;
};
