/** @file Assertions shared by the installed JavaScript clients. */
/**
 * Run against a fresh, installed component in a JavaScript host realm.
 *
 * @param api - Exports of the freshly installed Pulls package.
 */
export function exercise(api)
{
	const check = (ok,label) => { if(!ok) throw new Error(label); };
	const base=api.counts();
	const count=(pulls,closes,label)=>check(api.counts()-base===pulls*100+closes,label);
	const first=api.sequence(3), second=api.sequence(2);
	check(first[Symbol.iterator]()===first && !("then" in first),"immediate iterator");
	count(0,0,"open did not pull");
	check(first.next().value===0 && second.next().value===0,"independent cursors");
	for(const n of first)
	{ check(n===1,"break at second element"); break; }
	check(first.next().done && first.return().done,"closed after break");
	check(JSON.stringify([...second])==="[1]","exhaust other iterator");
	count(5,2,"break and exhaust");
	let caught; try
	{ api.checked(0); } catch(e)
	{ caught=e; }
	check(caught instanceof api.EIO_Pulls_checked && caught.payload==="open","typed open");
	const typed=api.checked(1); check(typed.next().value===0,"first typed value"); caught=null;
	try
	{ typed.next(); } catch(e)
	{ caught=e; }
	check(caught instanceof api.Step_Pulls_checked && caught.payload==="pull λ" && typed.next().done,"typed pull");
	const units=api.units(1), unit=units.next(); check(unit.done===false && unit.value===undefined,"Unit is an item");
	caught=null; try
	{ units.next(); } catch(e)
	{ caught=e; }
	check(caught instanceof api.Step_Pulls_units && caught.message==="unit step" && units.return().done,"IO pull");
	const cause=new Error("application exception");
	try
	{ for(const n of api.sequence(3))
	{ check(n===0,"throw on first item"); throw cause; } }
	catch(e)
	{ check(e===cause,"preserve caller exception"); }
	const unopened=api.sequence(10); unopened.return(); unopened.return();
	count(10,6,"typed failures, caller throw and unpulled close");
	const result=[...api.replies(2)];
	check(result.length===2 && result[0].error==="value λ" && result[1].ok===1,"returned Except values");
	count(13,7,"all native finalizers");
	return {pulls: 13,closes: 7};
}
