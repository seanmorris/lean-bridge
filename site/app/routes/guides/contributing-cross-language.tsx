/**
 * Bind the cross-language implementation stages to their documentation route.
 *
 * @file
 */
import Content from "../../../../build/site-content/contributing-cross-language.mjs";
import Documentation from "../../components/Documentation";
export { meta } from "../../components/Documentation";

/** Render the implementation stages. */
export default function Guide()
{
	return <Documentation Content={Content} />;
}
