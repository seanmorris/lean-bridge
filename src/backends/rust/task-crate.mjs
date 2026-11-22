/**
 * Render Rust's public task, stream, error and resource types over the exact
 * word ABI compiled by the native adapter. No symbol or raw value is public.
 *
 * @file
 */
import { readFile } from "node:fs/promises";
import { taskResourceTypes } from "../c/task-resources.mjs";
import { cTaskValues } from "../c/task-values.mjs";
import { retainedTask } from "../c/task-callback-exports.mjs";
import { rustRetainedEntry } from "./task-callback.mjs";
import { copiedRustAssets } from "./copied-assets.mjs";

const reserved = new Set("as async await break const continue dyn else enum extern false fn for gen if impl in let loop match mod move mut pub ref return static struct super trait true type unsafe use where while yield abstract become box do final macro override priv try typeof unsized virtual".split(" "));
const ident = s => {
	if(!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(s) || s === "_") throw new TypeError("Invalid Rust identifier");
	if(["self", "Self", "super", "crate"].includes(s)) return s + "_";
	return reserved.has(s) ? "r#" + s : s;
};
const widths = { unit: ["()", "u8"], bool: ["bool", "bool"], char: ["char", "u32"], usize: ["usize", "usize"], isize: ["isize", "isize"], float32: ["f32", "f32"], float64: ["f64", "f64"] };
for(const n of [8, 16, 32, 64])
	for(const [p, r] of [["u", "u"], ["", "i"]]) widths[p + "int" + n] = [r + n, r + n];
const quote = JSON.stringify;

/**
 * Generate from authenticated entries and the verified native library inventory.
 *
 * @param options - Native symbol prefix, checked entries, resource identities and compiled evidence.
 */
export const generateRustTaskSources = async options => {
	const { prefix, entries, resources = [], evidence } = options;
	if(!/^lbc_[a-z0-9_]+$/u.test(prefix) || evidence?.library !== "lib" + prefix + ".so"
		|| !/^[a-f0-9]{64}$/u.test(evidence.runtimeIdentity) || !/^[a-f0-9]{64}$/u.test(evidence.libraries?.[evidence.library]))
		throw new TypeError("Rust task generation requires its checked native adapter identity");
	const ffi = new Map(), models = new Map(), raw = [], funcs = [], pub = [];
	const names = new Set(["native", "abi", "Task", "Items", "Stream", "Error", "Fault", "BigInt", "BigUint", "CallbackTask", "CallbackTaskError", "CallbackError", "RetainedCallback"]);
	const rs = taskResourceTypes(resources), c = cTaskValues(prefix, false, rs);
	const sym = (name, args, out = "i32") => {
		const sig = 'unsafe extern "C" fn(' + args.join(",") + ")->" + out;
		const prev = ffi.get(name);
		if(prev && prev.sig !== sig) throw new TypeError("Inconsistent Rust FFI signature: " + name);
		if(!prev) ffi.set(name, { field: "f" + ffi.size, sig });
		return ffi.get(name).field;
	};
	const bufFree = sym(prefix + "_buffer_dispose", ["*mut Buffer"], "()");
	for(const r of rs)
	{
		if(names.has(r.name) || ["Option", "Result", "String", "Vec", "Infallible", "Resource"].includes(r.name)) throw new TypeError("Rust resource type collides: " + r.name);
		names.add(r.name);
		pub.push(`pub type ${ident(r.name)} = lean_bridge_task_runtime::Resource<${r.hash.match(/.{16}/gu).map(v => "0x" + v).join(",")}>;`);
		const base = prefix + "_resource_" + r.slug;
		r.ops = [sym(base + "_retain", ["abi::Lease", "*mut abi::Lease"]), sym(base + "_same", ["abi::Lease", "abi::Lease", "*mut bool"]), sym(base + "_release", ["*mut abi::Lease"])];
	}
	const shape = t => {
		const key = JSON.stringify(t); if(models.has(key)) return models.get(key);
		const cc = c.codec(t), n = t.name;
		let v;
		const res = rs.find(r => t.kind === "named" && r.id === t.id);
		if(res)
		{
			const [keep, eq, drop] = res.ops;
			v = { host: ident(res.name), input: "&" + ident(res.name)
				, raw: "abi::Lease", clear: `Clear::Status(a.${drop})`
				, prepare: x => ["", `unsafe{abi::borrow(${x})?}`]
				, decode: x => `Ok(unsafe{abi::attach(std::mem::take(${x}), abi::Ops{retain:a.${keep},same:a.${eq},release:a.${drop}})})` };
		} else if(t.kind === "primitive" && Object.hasOwn(widths, n))
		{
			const [host, type] = widths[n];
			v = { host, raw: type
				, prepare: x => ["", n === "unit" ? "0" : n === "char" ? x + " as u32" : x]
				, decode: x => n === "unit" ? `if *${x}==0{Ok(())}else{Err(Fault::Protocol)}` : n === "char" ? `char::from_u32(*${x}).ok_or(Fault::Protocol)` : `Ok(*${x})` };
		} else if(t.kind === "primitive" && ["bytes", "string"].includes(n))
		{
			const str = n === "string";
			v = { host: str ? "String" : "Vec<u8>"
				, input: str ? "&str" : "&[u8]", raw: "Buffer", arg: "View"
				, clear: `Clear::Void(a.${bufFree})`
				, prepare: x => ["", "view(" + x + (str ? ".as_bytes()" : "") + ")"]
				, decode: x => (str ? "text" : "bytes") + "(" + x + ")" };
		} else if(t.kind === "primitive" && ["nat", "int"].includes(n))
		{
			const signed = n === "int", type = signed ? "BigInt" : "BigUint";
			const drop = sym(prefix + "_integer_dispose", ["*mut Words"], "()");
			v = { host: type, input: "&" + type, raw: "Words", arg: "WordView"
				, clear: `Clear::Void(a.${drop})`
				, prepare: x => [`if ${x}.bits()>LIMIT as u64*8{return Err(Fault::Limit.into());} let words_${x}=${x}${signed ? ".magnitude()" : ""}.to_u64_digits();`, `WordView{words:words_${x}.as_ptr(),len:words_${x}.len(),negative:${signed ? x + ".sign()==num_bigint::Sign::Minus" : "false"}}`]
				, decode: x => signed ? `magnitude(${x}).map(|m|BigInt::from_biguint(if ${x}.negative {num_bigint::Sign::Minus}else{num_bigint::Sign::Plus},m))` : `if ${x}.negative{Err(Fault::Protocol)}else{magnitude(${x})}` };
		} else if(t.kind === "apply" && t.constructor === "result")
		{
			const [ok, err] = t.arguments.map(shape), type = "R" + models.size;
			raw.push(`#[derive(Clone,Copy)] #[repr(C)] union ${type}U {ok:${ok.raw},err:${err.raw}}
#[derive(Clone,Copy)] #[repr(C)] struct ${type} {ok:bool,payload:${type}U}`);
			v = { host: `Result<${ok.host},${err.host}>`, raw: type
				, clear: cc.dispose ? `Clear::Void(a.${sym(cc.dispose, ["*mut " + type], "()")})` : "Clear::None"
				, decode: x => `if ${x}.ok { ${ok.read}(a,unsafe{&mut ${x}.payload.ok}).map(Ok) } else { ${err.read}(a,unsafe{&mut ${x}.payload.err}).map(Err) }` };
		} else throw new TypeError("Unsupported compiler-authenticated Rust task carrier " + key);
		v.clear ??= "Clear::None"; v.input ??= v.host; v.arg ??= v.raw;
		v.read = "read" + models.size;
		funcs.push(`fn ${v.read}(a:&Api,v:&mut ${v.raw})->Result<${v.host},Fault>{${v.decode("v")}}`);
		models.set(key, v); return v;
	};
	const guard = (v, name) => `let mut ${name}:Guard<${v.raw}>=unsafe{Guard::zero(${v.clear})};`;
	for(const [i, e] of entries.entries())
	{
		if(retainedTask(e))
		{
			const name = ident(e.name);
			if(names.has(name)) throw new TypeError("Rust export name collides: " + name);
			names.add(name);
			rustRetainedEntry({ e, i, name, prefix, ident, shape, guard, sym, bufFree, pub, funcs }); continue;
		}
		// Match the C generator's traversal (including nested Except) so aggregate
		// disposers and their ABI layouts agree with the compiled component.
		const args = e.parameters.map(x => shape(x.type)), value = shape(e.result);
		const error = e.effect === "EIO" ? shape(e.error) : null, step = e.stepError ? shape(e.stepError) : null;
		const async = Boolean(e.delivery), stream = e.delivery === "async-iterator", io = e.effect === "IO", base = prefix + "_" + e.name;
		if(!["task", "async-iterator", undefined].includes(e.delivery)) throw new TypeError("Unsupported Rust delivery");
		const out = async ? stream ? `Items<${value.host},${step?.host ?? "std::convert::Infallible"}>` : `Task<${value.host}>` : value.host;
		const returnType = `Result<${out},Error${error ? "<" + error.host + ">" : ""}>`;
		const fn = ident(e.name);
		if(names.has(fn)) throw new TypeError("Rust export name collides: " + fn); names.add(fn);
		const argNames = e.parameters.map(p => ident(p.name));
		if(new Set(argNames).size !== argNames.length) throw new TypeError("Colliding Rust parameter names");
		pub.push(`/// Lean declaration: \`${e.declaration}\`.\npub fn ${fn}(${args.map((x, j) => argNames[j] + ":" + x.input).join(",")})->${returnType}{native::call${i}(${argNames.join(",")})}`);
		const start = sym(base + (async ? "_start" : "_call"), [...args.map(x => x.arg), "*mut " + (async ? "Handle" : value.raw), ...error ? ["*mut " + error.raw] : io ? ["*mut Buffer"] : []]);
		const prepared = args.map((v, j) => v.prepare("v" + j));
		const call = `let s=unsafe{(a.${start})(${[...prepared.map(p => p[1]), async ? "&mut h" : "&mut out.v", ...error || io ? ["&mut err.v"] : []].join(",")})};`;
		let success;
		if(async)
		{
			const pull = stream && sym(base + "_pull", ["Handle"]);
			const poll = sym(base + "_poll", ["Handle", "*mut i32"]), close = sym(base + "_close", ["*mut Handle"]);
			const take = sym(base + "_take", ["*mut Handle", "*mut " + value.raw, ...step ? ["*mut " + step.raw] : [], ...e.taskIO ? ["*mut Buffer"] : []]);
			funcs.push(`fn take${i}(a:&Api,h:&mut Handle,_:&[CallbackError])->Result<Option<${value.host}>,Error<${step?.host ?? "Infallible"}>> {
    ${guard(value, "out")} ${step ? guard(step, "err") : ""}
    ${e.taskIO ? `let mut msg:Guard<Buffer>=unsafe{Guard::zero(Clear::Void(a.${bufFree}))};` : ""}
    let s=unsafe{(a.${take})(h,&mut out.v${step ? ",&mut err.v" : ""}${e.taskIO ? ",&mut msg.v" : ""})};
    ${e.taskIO ? `if s==4{return Err(Fault::TaskIo{declaration:${quote(e.declaration)},message:text(&msg.v)?}.into());}` : ""}
    ${step ? `if s==3{return Err(Error::Step(${step.read}(a,&mut err.v)?));}` : ""}
    ${stream ? "if s==2{return Ok(None);}" : ""} abi::status(s)?; Ok(Some(${value.read}(a,&mut out.v)?))
}`);
			success = `Ok(${stream ? "Items" : "Task"}::from_source(Channel{api:a,h,poll:a.${poll},close:a.${close},pull:${pull ? "Some(a." + pull + ")" : "None"},take:take${i},callbacks:None}))`;
		} else success = `Ok(${value.read}(a,&mut out.v)?)`;
		funcs.push(`pub(super) fn call${i}(${args.map((x, j) => "v" + j + ":" + x.input).join(",")})->${returnType} {
    let a=runtime()?; ${prepared.map(p => p[0]).join("\n")} ${async ? "let mut h=Handle::default();" : guard(value, "out")}
    ${error ? guard(error, "err") : io ? `let mut err:Guard<Buffer>=unsafe{Guard::zero(Clear::Void(a.${bufFree}))};` : ""} ${call}
    ${error ? `if s==3{return Err(Error::Start(${error.read}(a,&mut err.v)?));}` : ""}
    ${io ? `if s==4{return Err(Fault::Io{declaration:${quote(e.declaration)},message:text(&err.v)?}.into());}` : ""}
    abi::status(s)?; ${success}
}`);
	}
	const driver = await readFile(new URL("./task-native.rs", import.meta.url), "utf8");
	const fields = [...ffi.values()].map(x => x.field + ":" + x.sig);
	const loads = [...ffi].map(([n, x]) => `${x.field}:sym!(${quote(n)},${x.sig})`);
	return { "src/lib.rs": `//! Generated bindings to compiled Lean. All native calls belong on the process main thread.\npub use lean_bridge_task_runtime::{Task,Items,Error,Fault,Stream,CallbackTask,CallbackTaskError,CallbackError,RetainedCallback};\npub use num_bigint::{BigUint,BigInt};\nmod native;\n${pub.join("\n")}\n`
		, "src/native.rs": `#![allow(dead_code,unused_imports,unused_variables)]\n${driver.replace("/* GENERATED_SYMBOLS */", loads.join(",\n"))}\nstruct Api{${fields.join(",\n")}}\n${raw.join("\n")}\n${funcs.join("\n")}\n`
		, "src/assets.rs": copiedRustAssets(evidence, { task: true }) };
};
