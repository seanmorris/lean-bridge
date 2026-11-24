/** @file Share application-object identity between components on one synchronous Wasm heap. */
import { captureWasmHostClasses } from "./wasm-host-members.mjs";

const bad = message => { throw new TypeError("JavaScript host domain: " + message); };
const limit = 0xffff_ffff;

/**
 * Each instance belongs to exactly one initialized Wasm heap, not the realm
 * or a module-global singleton. Sessions bind compatible classes by the
 * authored nominal key. Wasm, not JS garbage collection, releases the last
 * native pin. Neither an application property nor JS equality supplies an ID.
 *
 * @param retire - Synchronously retire the native wrappers of the last binding for a kind.
 */
export const createWasmHostDomain = retire => {
	const kinds = new Map(), tokens = new Map();
	let lastKind = 0, lastToken = 0, closing = false, poisoned = false;
	const open = () => { if(poisoned || closing) bad("not available"); };
	const rowFor = (kind, token) => {
		const row = tokens.get(token);
		if(!row || row.kind.id !== kind) bad("stale or wrong-kind host reference");
		return row;
	};
	const collect = row => {
		if(!row.temps && !row.native)
		{
			row.kind.byObject.delete(row.value); tokens.delete(row.id); row.kind.rows--;
		}
	};
	const attach = (kind, token, anchor, fresh) => {
		open(); const row = rowFor(kind,token), parent = anchor ? tokens.get(anchor) : null;
		if(!row.temps || row.native === Boolean(fresh) || (anchor && !parent?.native)) bad("invalid canonical acquisition");
		if(parent && parent.value !== row.value) row.anchors.add(parent.value);
		row.native = true;
	};
	// May be called by native finalization while retire() has stopped new calls.
	const detach = (kind, token) => {
		const row = rowFor(kind,token);
		if(!row.native) bad("duplicate native release");
		row.native = false; row.anchors.clear(); collect(row);
	};
	const bind = (model, supplied) => {
		open();
		const classes = captureWasmHostClasses(model,supplied);
		open(); // fetching constructors may have synchronously entered application code
		const keys = new Set();
		const selected = model.kinds.map(({key,policy},i) => {
			if(!/^[a-f0-9]{64}$(?![\s\S])/u.test(key) || keys.has(key)
				|| !["weak-canonical","strong-canonical"].includes(policy)) bad("invalid nominal kind");
			keys.add(key);
			const current=kinds.get(key), {ctor,proto}=classes[i];
			if(current && (current.ctor!==ctor || current.proto!==proto || current.policy!==policy))
				bad("incompatible binding for shared nominal kind");
			return current ?? {key,policy,ctor,proto,byObject: new WeakMap(),id: 0,users: 0,rows: 0};
		});
		if(lastKind + selected.filter(k=>!k.id).length > limit) bad("nominal kinds exhausted");
		for(const k of selected)
		{
			if(!k.id)
			{ k.id=++lastKind; kinds.set(k.key,k); }
			k.users++;
		}
		let closed=false, depth=0;
		const temps=new Map();
		const active = () => { open(); if(closed || !depth) bad("inactive host session"); };
		const kind = i => {
			active(); if(!Number.isInteger(i) || !selected[i]) bad("invalid component kind");
			return selected[i];
		};
		const check = (k,v) => {
			if(v===null || (typeof v!=="object" && typeof v!=="function") || !Object.prototype.isPrototypeOf.call(k.proto,v))
				bad("wrong host class");
		};
		const pin = (i,value) => {
			const k=kind(i); check(k,value); active();
			let row=k.byObject.get(value);
			if(!row)
			{
				if(lastToken===limit) bad("object tokens exhausted");
				row={id: ++lastToken,kind: k,value,temps: 0,native: false,anchors: new Set()};
				tokens.set(row.id,row); k.byObject.set(value,row); k.rows++;
			}
			row.temps++; temps.set(row.id,(temps.get(row.id)??0)+1); return row.id;
		};
		const release = token => {
			active(); const n=temps.get(token);
			if(!n) bad("temporary pin belongs to another session or has been released");
			const row=tokens.get(token);
			if(n===1) temps.delete(token); else temps.set(token,n-1);
			row.temps--; collect(row);
		};
		const resolve = (i,token) => {
			const k=kind(i), row=rowFor(k.id,token);
			check(k,row.value); active(); return row.value;
		};
		const close = () => {
			open(); if(depth) bad("cannot unbind an active host session");
			if(closed) return false;
			closed=true; closing=true;
			try
			{
				for(const k of selected) if(!--k.users)
				{
					retire(k.id);
					if(k.rows) bad("native retirement left live objects");
					kinds.delete(k.key);
				}
			} catch(error)
			{ poisoned=true; throw error; }
			finally
			{ closing=false; }
			return true;
		};
		return Object.freeze({classes,pin,release,resolve,close
			, enter: () => { open(); if(closed) bad("closed host session"); depth++; }
			, leave: () => { active(); if(depth===1 && temps.size) bad("unreleased transient host pins"); depth--; }
			, kind: i => kind(i).id, strong: i => kind(i).policy==="strong-canonical"});
	};
	return Object.freeze({bind,attach,detach,live: ()=>tokens.size
		, abandon: ()=>{poisoned=true;tokens.clear();kinds.clear();}
		, strong: (kind,token)=>rowFor(kind,token).kind.policy==="strong-canonical"});
};
