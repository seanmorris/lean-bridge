/**
 * Render the Rust owner side of a compiler-checked callback-taking task.
 *
 * @file
 */

/**
 * Generate a closure-taking Rust function and its private per-slot dispatch.
 *
 * @param options - Checked export, library symbols, Rust codecs and output buffers.
 */
export const rustRetainedEntry = options => {
	const { e, i, name, prefix, ident, shape, guard, sym, bufFree, pub, funcs } = options;
	const ps = e.parameters.map(({ name, type }, j) => ({ j
		, name: ident(name)
		, ...type.kind === "io-callback" ? { input: shape(type.argument), reply: shape(type.reply) } : { c: shape(type) } }));
	if(new Set(ps.map(x => x.name)).size !== ps.length) throw new TypeError("Colliding Rust callback parameter names");
	const args = ps.filter(x => x.c), callbacks = ps.filter(x => x.input);
	const value = shape(e.result), error = e.effect === "EIO" && shape(e.error);
	const type = x => x.c ? x.c.input : `impl Fn(${x.input.host})->Result<${x.reply.host},CallbackError>+'static`;
	const out = `Result<CallbackTask<${value.host}${error ? "," + error.host : ""}>,Error>`, decl = JSON.stringify(e.declaration);
	pub.push(`/// Lean declaration: \`${e.declaration}\`. Starts without blocking the owner; factory failures arrive on await.
pub fn ${name}(${ps.map(x => x.name + ":" + type(x)).join(",")})->${out}{native::call${i}(${ps.map(x => x.name).join(",")})}`);
	const base = prefix + "_" + e.name + "_";
	const start = sym(base + "start", [...args.map(x => x.c.arg), "*mut Handle"]);
	const poll = sym(base + "poll", ["Handle", "*mut i32"]), close = sym(base + "close", ["*mut Handle"]);
	const take = sym(base + "take", ["*mut Handle", "*mut " + value.raw, ...error ? ["*mut " + error.raw] : [], "*mut Buffer", "*mut u32", "*mut u8"]);
	funcs.push(`fn take${i}(a:&Api,h:&mut Handle,faults:&[CallbackError])->Result<Option<${value.host}>,CallbackTaskError${error ? "<" + error.host + ">" : ""}>{
    ${guard(value, "out")} ${error ? guard(error, "err") : ""}
    let mut msg:Guard<Buffer>=unsafe{Guard::zero(Clear::Void(a.${bufFree}))}; let(mut origin,mut phase)=(0,0);
    let s=unsafe{(a.${take})(h,&mut out.v${error ? ",&mut err.v" : ""},&mut msg.v,&mut origin,&mut phase)};
    ${error ? `if s==3{return Err(Error::Start(${error.read}(a,&mut err.v)?));}` : ""}
    if s==4 {
        if origin!=0 { let error=faults.get(origin as usize-1).ok_or(Fault::Protocol)?.clone();return Err(Error::Callback{declaration:${decl},error}); }
        let message=text(&msg.v)?;
        return Err(match phase {2=>Fault::Io{declaration:${decl},message},3=>Fault::TaskIo{declaration:${decl},message},_=>Fault::Protocol}.into());
    }
    abi::status(s)?; Ok(Some(${value.read}(a,&mut out.v)?))
}`);
	let owner = "None";
	if(callbacks.length)
	{
		const cases = callbacks.map(({ j, input, reply }) => {
			const arg = sym(base + "arg_" + j, ["Handle", "*mut " + input.raw]);
			const ret = sym(base + "reply_" + j, ["Handle", reply.arg]);
			const [prep, pass] = reply.prepare("v");
			return `${j}=>{ ${guard(input, "arg")} abi::status(unsafe{(a.${arg})(h,&mut arg.v)})?;
            let x=${input.read}(a,&mut arg.v)?;drop(arg);
            match v${j}(x){Err(e)=>Ok(Some(e)),Ok(v)=>{${reply.input.startsWith("&") ? "let v=&v;" : ""}${prep}
                abi::status(unsafe{(a.${ret})(h,${pass})})?;Ok(None)}}
        }`;
		});
		const fd = sym(base + "callbacks", ["Handle", "*mut i32"]), next = sym(base + "next", ["Handle", "*mut u32"]);
		const fail = sym(base + "fail", ["Handle", "View", "*mut u32"]), poison = sym(base + "poison", ["Handle"]);
		owner = `Some(Callbacks{declaration:${decl},fd:a.${fd},next:a.${next},fail:a.${fail},poison:a.${poison},faults:Vec::new(),
        dispatch:Box::new(move|slot,a,h|match slot {${cases.join(",")},_=>Err(Fault::Protocol)})})`;
	}
	const prepared = args.map(x => x.c.prepare("v" + x.j));
	funcs.push(`pub(super) fn call${i}(${ps.map(x => "v" + x.j + ":" + type(x)).join(",")})->${out}{
    let a=runtime()?;${prepared.map(p => p[0]).join("\n")} let mut h=Handle::default();
    let callbacks=${owner};
    abi::status(unsafe{(a.${start})(${[...prepared.map(p => p[1]), "&mut h"].join(",")})})?;
    Ok(Task::from_source(Channel{api:a,h,poll:a.${poll},close:a.${close},pull:None,take:take${i},callbacks}))
}`);
};
