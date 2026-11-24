/** @file Project the authenticated PHP worker port into binding-scoped methods and scheduler operations. */
import {canonicalJson} from "../../capsule/node.mjs";
import {phpHostTaskKernel} from "../../build/php-host-task-kernel.mjs";

/**
 * Recompute the task table from elaboration before generating any PHP symbol calls.
 *
 * @param o - Reconciled exports and the native linker result.
 */
export const phpHostTaskApi=async o=>{
	const {linked,checked,ir,model,ns}=o,{task}=linked;
	const kernel=await phpHostTaskKernel({ir
		, checked: {...checked,evidence: linked.evidence}
		, runtimeIdentity: linked.runtimeIdentity
		, modules: linked.evidence.selection.exportModules
		, name: task.coordinate});
	if(canonicalJson(task.methods)!==canonicalJson(kernel.methods) || canonicalJson(task.port)!==canonicalJson(kernel.port)
		|| task.ledger!==kernel.ledger.name || !/^[0-9a-f]{64}$/u.test(linked.binaries[task.ledger]))
		throw new TypeError("PHP worker port differs from compiled declarations");
	const site=t=>{
		if(Array.isArray(t)) return t.map(site);
		if(typeof t!=="string" || !t.startsWith("host:")) return t;
		const k=model.kinds.findIndex(x=>"host:"+x.key===t);
		if(k<0) throw new TypeError("Unknown PHP worker object"); return k;
	};
	const table=[];
	const method=({entry,name,args,ex,stepEx})=>{
		const i=table.length,m=kernel.methods[i],p=kernel.port;
		if(m.declaration!==entry.declaration) throw new TypeError("Wrong native PHP worker order");
		const fn=p.stem+"_"+i, stream=m.delivery==="async-iterator", type=stream?"PullStream":"\\Amp\\Future";
		const ops={poll: m.names.poll,close: m.names.close,watch: kernel.wire.wait.open,unwatch: kernel.wire.wait.close,...stream?{pull: m.names.pull}:{}};
		const callbacks=(m.callbacks??[]).map(([slot,a,b])=>[slot,site(a),site(b)]);
		const queue=callbacks.length?{next: m.names.next,callbacks: m.names.callbacks,trap: m.names.trap,arg: fn+"_arg",reply: fn+"_reply",fail: fn+"_fail",dispose: p.dispose}:{};
		table.push({name: m.declaration,step: m.stepDeclaration??null
			, fn,ops,callbacks,queue
			, depth: m.tagBytes,effect: m.effect
			, args: m.args.map(site)
			, result: site(m.result)
			, error: site(m.error)
			, terminal: site(m.terminal)
			, terminalStatus: m.delivery==="task" || m.stepIO?4:3
			, factoryError: ex?ns+"\\"+ex:null
			, terminalError: stepEx?ns+"\\"+stepEx:null});
		let cancel="$cancellation"; while(args.includes(cancel)) cancel+="_";
		return `    public function ${name}(${[...args.map(a=>"mixed "+a),"?\\Amp\\Cancellation "+cancel+"=null"].join(", ")}): ${type} {
        if (func_num_args()>${args.length+1}) throw new \\ArgumentCountError('Unexpected worker arguments');
        if (!$this->open) throw new \\LogicException('PHP host binding is closed');
        return $this->tasks->start(${i},[${args.join(",")}],${cancel});
    }`;
	};
	const factory=()=>`    public static function tasks(\\FFI $ffi,HostMembers $members): HostTasks {
        return new HostTasks($ffi,$members,self::PREFIX,'${kernel.port.dispose}',json_decode(<<<'TASKS'
${canonicalJson(table).trim()}
TASKS,true,128,JSON_THROW_ON_ERROR));
    }
`;
	return {method,factory};
};
