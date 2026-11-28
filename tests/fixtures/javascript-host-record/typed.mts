/** @file Compile and run a strict TypeScript application against the two installed packages. */
import {Pair, withHosts} from "@example/gauge-records";
import {withHosts as inspect} from "@example/record-peer";

/** An application class with a reading and an optional error from its owner. */
class Meter
{
	/** Current reading, including changes from the independent package. */
	level: number;
	/** Optional application exception returned unchanged by a failing call. */
	error?: Error;
	/**
	 * Create an application meter.
	 *
	 * @param level - Initial reading.
	 */
	constructor(level: number) {this.level=level;}
	/** Return the current reading. */
	read() {if(this.error) throw this.error;return this.level;}
	/** Return this exact instance. */
	identity():this {return this;}
}
const api=withHosts({Box: Meter}), peer=inspect({Box: Meter});
const x=new Meter(7), y=new Meter(4);
const initial:Pair<Meter>=new Pair(x,new Uint8Array([1]),1n,y);
const failure=new Error("typed caller");x.error=failure;
let seen:unknown;
try
{api.flip(initial);} catch(e)
{seen=e;}
delete x.error;if(seen!==failure) throw Error("typed host error identity");
const reversed:Pair<Meter>=api.flip(initial);
const choose=api.choose(initial);
seen=null;
try
{api.duplicate_sample(x,new Uint8Array(6*1024*1024));} catch(e)
{seen=e;}
if(!(seen instanceof RangeError)) throw Error("typed partial result");
// Checked by tsc but never called: each line must be rejected.
const rejectedCalls=()=>{
	// @ts-expect-error -- Nat is a bigint, not a JS number.
	new Pair(x,new Uint8Array(),4,y);
	// @ts-expect-error -- a structural object is not a generated record.
	api.flip({lead: x,sample: new Uint8Array(),sequence: 1n,spare: y,dispose: ()=>true});
	// @ts-expect-error -- returned fields cannot be replaced.
	reversed.lead=x;
};
void rejectedCalls;
if(!initial.dispose() || choose(true)!==x || !choose.dispose() || !api.dispose()) throw Error("typed function capture");
const kept:Meter=reversed.spare;
if(!reversed.dispose() || peer.increment(kept)!==x || kept.level!==8 || !peer.dispose()) throw Error("typed peer identity");
console.log("typed record reached independent peer");
