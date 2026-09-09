/**
 * Display a result from the installed Lean component.
 *
 * @file
 */
const output = document.querySelector("#result");
try
{
	const { add, isEmpty } = await import("onboarding-small");
	const sum = add(20n, 22n);
	const empty = isEmpty("");
	if(sum !== 42n || !empty) throw new Error("Unexpected Lean result");
	output.textContent = `Sum: ${sum}. Empty string: ${empty}.`;
	output.dataset.status = "ready";
} catch(error)
{
	output.textContent = `Could not load Lean: ${String(error)}`;
	output.dataset.status = "error";
}
