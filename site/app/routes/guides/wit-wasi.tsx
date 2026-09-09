/**
 * Bind the wit-wasi guide to its static documentation route.
 *
 * @file
 */
import Content from "../../../../build/site-content/wit-wasi.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Render only this guide's compiled content. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
