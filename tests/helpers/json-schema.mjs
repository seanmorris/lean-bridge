/**
 * Validates generated evidence against the repository's published JSON schemas.
 *
 * @file
 */
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import Ajv from "ajv/dist/2020.js";

const schemaRoot = new URL("../../schema/", import.meta.url);
let validatorPromise;

const loadValidator = async () => {
	const validator = new Ajv({ strict: false, validateFormats: false, allErrors: true });
	for(const name of await readdir(schemaRoot))
	{
		if(!name.endsWith(".schema.json")) continue;
		const url = new URL(name, schemaRoot);
		const schema = JSON.parse(await readFile(url, "utf8"));
		// File bases resolve the published schemas' relative cross-file references.
		schema.$id = url.href;
		validator.addSchema(schema);
	}
	return validator;
};

/**
 * Checks a generated document, including references to other closed schemas.
 *
 * @param name - Schema filename without the .schema.json suffix.
 * @param value - Generated JSON document.
 */
export const assertJsonSchema = async (name, value) => {
	validatorPromise ??= loadValidator();
	const validator = await validatorPromise;
	const validate = validator.getSchema(new URL(`${name}.schema.json`, schemaRoot).href);
	assert.ok(validate, `Missing JSON schema: ${name}`);
	assert.equal(validate(value), true, `${name}: ${JSON.stringify(validate.errors)}`);
};
