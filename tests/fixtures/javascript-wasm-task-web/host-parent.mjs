/** @file Run the installed host-object example in independent page and worker heaps. */
import {exercise,ExampleBox as Box} from "./calls.mjs";
import {withHosts} from "@lean-bridge/workshop-host-example";

/**
 * Run a child while an application object remains live in the parent.
 *
 * @param child - Start an independent module worker.
 * @param progress - Report the last completed stage.
 */
export async function run(child,progress)
{
	const w=withHosts({Box});
	try
	{
		const original=await w.start(42), worker=await child(progress);
		if(w.identity(original)!==original || original.level!==42) throw new Error("Child shutdown changed the page's object");
		await w.dispose();
		return {worker,page: await exercise(progress)};
	} finally
	{await w.dispose();}
}
