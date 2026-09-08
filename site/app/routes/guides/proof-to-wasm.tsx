/**
 * Bind the canonical proof-to-wasm guide to its statically rendered route.
 *
 * @file
 */

import Content from "../../../../build/site-content/proof-to-wasm.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Load only this guide's compiled content when its route is visited. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
