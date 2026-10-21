/**
 * Preserve native observation commands while bounding each GitHub expression.
 *
 * @file
 */
import assert from "node:assert/strict";

const recorder = '            node scripts/consumer-ci.mjs record --consumer "$consumer" --output "build/consumer-ci/results/native-${{ matrix.profile }}/$consumer.json" --performance "build/consumer-ci/performance/$consumer.json" --test-result "$result" --package-installation "$installed" --real-lean-execution "$installed" --command "$consumer_command"\n          done\n';
const secondHeader = "      - name: Record native Python and Rust consumer observations\n"
	+ "        if: always() && (matrix.profile == 'python' || matrix.profile == 'rust')\n        shell: bash\n        run: |\n";
const prefix = '          test_result="${{ steps.consumer.outcome == \'success\' && \'passed\' || \'failed\' }}"\n'
	+ '          executed="${{ steps.consumer.outcome == \'success\' && \'true\' || \'false\' }}"\n'
	+ '          for consumer in ${{ matrix.consumers }}; do\n            result="$test_result"\n            installed="$executed"\n'
	+ '            consumer_command="npm run test:consumer:native"\n';
const first = "      - name: Record native consumer observations\n        if: always()";
const once = (source, old, replacement) => {
	assert.equal(source.split(old).length, 2, "require exactly one native recording boundary");
	return source.replace(old, () => replacement);
};

/**
 * Join only the exact split, for comparison with the authenticated previous workflow.
 *
 * @param workflow - Complete current workflow text.
 */
export const joinNativeObservations = workflow => {
	assert.equal(workflow.split(secondHeader).length, 2, "require exactly one second recording step");
	return once(once(workflow, recorder + secondHeader + prefix, "")
		, first + " && matrix.profile == 'c-family'\n", first + "\n");
};

/**
 * Count the interpolated expression, including format quoting and brace escaping.
 * Mirrors TemplateReader.ParseScalar in actions/runner, not a full YAML validator.
 *
 * @param source - Decoded scalar text.
 */
export const workflowExpressionLength = source => {
	const args = []; let format = "", cursor = 0, literal = false;
	const append = value => {
		literal ||= value.length > 0;
		format += value.replaceAll("'", "''").replaceAll("{", "{{").replaceAll("}", "}}");
	};
	while(true)
	{
		const start = source.indexOf("${{", cursor);
		if(start < 0)
		{ append(source.slice(cursor)); break; }
		append(source.slice(cursor, start));
		let quoted = false, end = start + 3;
		for(; end < source.length; end++)
		{
			if(source[end] === "'") quoted = !quoted;
			else if(!quoted && source.slice(end, end + 2) === "}}") break;
		}
		assert.ok(end < source.length, "unclosed workflow expression");
		format += `{${args.length}}`;
		args.push(source.slice(start + 3, end).trim()); cursor = end + 2;
	}
	if(!args.length) return 0;
	if(args.length === 1 && !literal) return args[0].length;
	return `format('${format}', ${args.join(", ")})`.length;
};

/**
 * Read run blocks and single-line run fields. Retaining newlines in folded
 * blocks gives a conservative length bound without executing their contents.
 *
 * @param workflow - Complete YAML text, separately validated by actionlint.
 */
export const workflowRunScalars = workflow => {
	const lines = workflow.split("\n"), runs = [];
	for(let index = 0; index < lines.length; index++)
	{
		const match = /^( *)run: (.*)$/u.exec(lines[index]);
		if(!match) continue;
		const line = index + 1, value = match[2];
		if(!/^[|>][-+]?$/u.test(value))
		{
			assert.ok(!/^[|>]/u.test(value), "unsupported run block indicator");
			runs.push({ line, source: value }); continue;
		}
		const indent = match[1].length + 2, parts = [];
		while(index + 1 < lines.length && (!lines[index + 1].trim() || lines[index + 1].startsWith(" ".repeat(indent))))
			parts.push(lines[++index].slice(indent));
		const raw = parts.join("\n") + "\n";
		const source = value.endsWith("+") ? raw : raw.replace(/\n+$/u, value.endsWith("-") ? "" : "\n");
		runs.push({ line, source });
	}
	return runs;
};

/**
 * Leave headroom below GitHub's 21,000-character expression parser limit.
 *
 * @param workflow - Complete workflow YAML.
 */
export const assertWorkflowRunBudget = workflow => {
	const runs = workflowRunScalars(workflow);
	for(const { line, source } of runs)
		assert.ok(Math.max(source.length, workflowExpressionLength(source)) <= 20000, `run at line ${line} exceeds the 20,000-character CI budget`);
	return runs.length;
};
