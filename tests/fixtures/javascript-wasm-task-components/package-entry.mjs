/** @file Read this independently installed component's Wasm, relative to its own package. */

/** Load the installed side module from the host filesystem or its serving origin. */
export const readComponent = async () => {
	const url = new URL("./component.wasm", import.meta.url);
	if(url.protocol === "file:") return (await import("node:fs/promises")).readFile(url);
	const response = await fetch(url);
	if(!response.ok) throw new Error("Could not load task component: " + response.status);
	return new Uint8Array(await response.arrayBuffer());
};
