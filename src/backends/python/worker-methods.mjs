/** @file Bind Python's native task, cursor, and callback observers to the creating host session. */

/**
 * Validate every argument before publishing a single strong host identity.
 *
 * @param args - Ordered codecs, excluding the private callback port.
 * @param array - C local holding converted Lean arguments.
 * @param offset - Offset into the CPython argument tuple.
 */
export const pythonHostArguments = (args, array, offset) => {
	const hosts = [], lines = [];
	for(const [j, codec] of args.entries())
	{
		const input = `PyTuple_GET_ITEM(args, ${j + offset})`;
		if(codec.hostIndex === undefined) lines.push(`if (!(${array}[${j}] = ${codec.fromPython(input)})) goto done;`);
		else
		{
			lines.push(`if (!lb_check_host(${codec.hostIndex}, ${input})) goto done;`);
			hosts.push(`if (!(${array}[${j}] = lb_stage_argument(${codec.hostIndex}, ${input}, &pending_hosts))) goto done;`);
		}
	}
	if(hosts.length) lines.unshift("lb_value *pending_hosts = NULL;");
	return { setup: [...lines, ...hosts, ...hosts.length ? ["lb_finish_hosts(&pending_hosts, 1);"] : []].join("\n    ")
		, rollback: hosts.length ? "lb_finish_hosts(&pending_hosts, 0);\n    " : "" };
};

/**
 * Wrap the C functions named in the method table, regardless of table formatting.
 * Cleanup functions deliberately remain usable after a binding has expired.
 *
 * @param entries - Compiler-checked exported functions.
 * @param streams - Whether the component has the cursor protocol.
 * @param callbacks - Whether it has retained callback ports.
 */
export const pythonWorkerMethods=(entries,streams,callbacks)=>{
	const ops=new Map(entries.map((e,i)=>["lb_invoke_"+i,e.parameters.some(p=>p.type.kind==="io-callback")?"first":"none"]));
	for(const op of ["lb_task_ready","lb_task_descriptor","lb_task_take",...streams?["lb_cursor_next"]:[],...callbacks?["lb_cb_fd"]:[]]) ops.set(op,"self");
	if(callbacks)
	{
		ops.set("lb_cb_open","none");ops.set("lb_cb_drain","first");
	}
	const wrappers=[...ops].map(([op,kind])=>`static PyObject *scoped_${op}(PyObject *mod, PyObject *args) {
    ${kind==="first"?'if (!PyTuple_Check(args) || PyTuple_GET_SIZE(args)<1) {PyErr_SetString(PyExc_TypeError,"missing worker port");return NULL;}':""}
    return lb_worker_dispatch(${op},mod,args,${kind==="first"?"PyTuple_GET_ITEM(args,0)":kind==="self"?"args":"NULL"});
}`).join("\n");
	return [wrappers,...Array.from(ops.keys(),name=>`#define ${name} scoped_${name}`)].join("\n");
};
