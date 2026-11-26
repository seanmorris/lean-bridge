/** @file Application code run against the installed Gauge and Inspector packages. */
import {Pair, withHosts} from "@example/gauge-records";
import {withHosts as inspect} from "@example/record-peer";

/** The consumer supplies this class; Gauge and Inspector do not share a wrapper. */
export class Meter
{
	/**
	 * Create a meter with an observable read count.
	 *
	 * @param n - Initial reading.
	 */
	constructor(n) {this.level=n;this.reads=0;}
	/** Return the reading or throw the original application error. */
	read() {this.reads++;if(this.error) throw this.error;return this.level;}
	/** Return this exact instance. */
	identity() {return this;}
}
const check=(v,m)=>{if(!v) throw new Error(m);};
const fails=(fn,predicate)=>{
	try
	{ fn(); } catch(e)
	{ check(predicate(e),"unexpected error: "+e);return; }
	throw new Error("operation unexpectedly succeeded");
};
/**
 * Exercise the public APIs, not the compiler or the internal registry.
 *
 * @param peerFirst - Whether Inspector should bind before Gauge.
 */
export function exercise(peerFirst)
{
	let api,peer;
	if(peerFirst)
	{peer=inspect({Box: Meter});api=withHosts({Box: Meter});}
	else
	{api=withHosts({Box: Meter});peer=inspect({Box: Meter});}
	const x=new Meter(23),y=new Meter(19),n=(1n<<130n)+5n,bytes=new Uint8Array([9,8]);
	const pair=new Pair(x,bytes,n,y), choose=api.choose(pair);
	bytes[0]=0;check(pair.sample[0]===9 && pair.sequence===n,"copied input fields");
	const generated=api.create_pair(x);
	check(generated.lead===x && api.sum_read(generated,pair)===42,"Lean constructed row");
	const closed=new Pair(x,bytes,n,y);closed.dispose();
	const before=x.reads;
	fails(()=>api.sum_read(pair,closed),e=>e instanceof TypeError);
	fails(()=>api.sum_read(pair,{...pair}),e=>e instanceof TypeError);
	const wide=new Pair(x,new Uint8Array(8*1024*1024),0n,y);
	fails(()=>api.sum_read(wide,wide),e=>e instanceof RangeError);wide.dispose();
	check(x.reads===before,"invalid second input invoked the first meter");
	x.error=new Error("original meter failure");fails(()=>api.flip(pair),e=>e===x.error);delete x.error;
	const flipped=api.flip(pair);check(flipped.lead===y && flipped.spare===x && flipped.sequence===n+1n,"flipped row");
	const sample=flipped.sample;check(sample.join(",")==="9,8,23","compiled Lean byte mutation");
	sample[0]=77;check(flipped.sample[0]===9,"getter did not copy");
	const temp=new Meter(7);
	// Input (6 MiB) plus first copied result (6 MiB) fit together. The meter
	// is the next field; only the final 6 MiB result field exceeds the budget.
	fails(()=>api.duplicate_sample(temp,new Uint8Array(6*1024*1024)),e=>e instanceof RangeError);
	check(pair.dispose() && !pair.dispose() && generated.dispose(),"dispose input");
	check(choose(true)===x && choose(false)===y && choose.dispose(),"function capture survived input disposal");
	check(api.dispose(),"close creating binding"); const kept=flipped.spare;
	check(flipped.dispose(),"dispose result");fails(()=>flipped.spare,e=>e instanceof TypeError);
	check(peer.increment(kept)===x && x.level===24 && peer.dispose(),"independent peer identity and mutation");
	return {copy: true,originalError: true,partialResultRejected: true,peerLevel: x.level,peerFirst};
}
