/** An ordinary JS function is borrowed as a record field, not merely as the top-level argument. */
export function hostField(api,makeInput=quote=>({quote})) {
	let visits=0, innerCalls=0;
	const meter={offset:7};
	const input=makeInput(units=>{
		++visits;
		return api.flatQuote((a,b)=>{ ++innerCalls; return a+b; },units,meter.offset);
	});
	const first=api.applyTariff(input,35);
	meter.offset=12;
	const second=api.applyTariff(input,30);
	if(first!==42 || second!==42 || visits!==2 || innerCalls!==2) throw new Error("record borrow or reentry failed");
	const marker=new Error("meter offline");
	try {
		api.applyTariff({quote(){ throw marker; }},1);
		throw new Error("field exception was swallowed");
	} catch(e) { if(e!==marker) throw e; }
	const escaped=api.echoTariff(input);
	try {
		for(const attempt of [()=>escaped.quote(1),()=>api.applyTariff(escaped,1)]) {
			try { attempt(); throw new Error("escaped record field executed"); }
			catch(e) { if(e.status!==10) throw e; }
		}
	} finally { escaped.quote.dispose(); }
	if(visits!==2 || innerCalls!==2) throw new Error("entered an expired field");
	const recovered=api.applyTariff({quote:n=>n+1},41);
	if(recovered!==42) throw new Error("record failed after host error");
	return {visits,innerCalls,first,second,recovered};
}
