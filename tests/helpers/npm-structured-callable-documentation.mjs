/**
 * Select the structured-callback example without absorbing adjacent sections.
 *
 * @file
 */
import assert from "node:assert/strict";

/**
 * Require one named section and one JavaScript example within its own boundary.
 *
 * @param source - Complete JavaScript/TypeScript consumer guide.
 */
export const npmStructuredCallableDocumentation = source => {
	const sections = source.split(/^### Structured callbacks\r?\n/mu);
	assert.equal(sections.length, 2, "Expected exactly one Structured callbacks section");
	const section = sections[1].split(/^#{1,3} /mu)[0];
	const blocks = [...section.matchAll(/^```js\r?\n([\s\S]*?)^```[\t ]*$/gmu)];
	assert.equal(blocks.length, 1, "Expected exactly one JavaScript example in Structured callbacks");
	return blocks[0][1];
};
