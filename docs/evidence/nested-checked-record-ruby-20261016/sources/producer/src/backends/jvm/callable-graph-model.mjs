/**
 * Compile typed JVM callback signatures over the shared recursive native carrier.
 *
 * @file
 */
import { basename } from 'node:path';
import { canonicalJson, sha256 } from '../../capsule/node.mjs';
import { createNativeCallableGraphDescriptor } from '../../build/native-callable-graph.mjs';
import { compileNativeCallableGraphPayloads } from '../c/native-callable-graph-payloads.mjs';
import { compileCopiedJvmGraphPackageModel } from './copied-graph-package.mjs';
import { cIdentifier } from '../c/generate.mjs';

const pascal = name => name.split(/[^A-Za-z0-9]+/).filter(Boolean).map(part => part[0].toUpperCase() + part.slice(1)).join('');
const camel = name => { const value = pascal(name); return value[0].toLowerCase() + value.slice(1); };
const keywords = new Set('_ abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null record sealed permits var yield _GraphCalls _GraphTypes _CallableGraphRuntime _CallableGraphNative _KotlinCallableGraphApiCalls kotlin org'.split(' '));
const members = 'equals hashCode toString getClass clone finalize notify notifyAll wait bridgeField builder java'.split(' ');
const primitiveName = name => ({ uint8: 'UInt8', uint16: 'UInt16', uint32: 'UInt32', uint64: 'UInt64', usize: 'USize', isize: 'ISize' })[name] ?? pascal(name);

/**
 * Compile typed JVM callback signatures over the shared recursive native carrier.
 *
 * @param ir - Validated component binding graph.
 */
export const compileCallableJvmGraphPackageModel = ir => {
	const descriptor = createNativeCallableGraphDescriptor(ir), payloads = compileNativeCallableGraphPayloads(ir, descriptor);
	const generated = compileCopiedJvmGraphPackageModel(payloads.ir);
	const nodes = new Map(generated.types.map(node => [node.id, node]));
	const copy = ref => nodes.get(payloads.copy(ref).id);
	const occupied = new Set([...generated.publicFiles, ...generated.internalFiles, ...generated.kotlin.publicFiles, ...generated.kotlin.internalFiles].map(file => basename(file).replace(/\.(?:java|kt)$/u, '')));
	const claim = name => {
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || occupied.has(name)) throw new TypeError('Reserved or duplicate JVM callable name: ' + name);
		occupied.add(name); return name;
	};
	const definitions = new Map(ir.types.map(type => [type.id, type]));
	const callbacks = new Map(descriptor.callbacks.map((signature, index) => {
		const parameters = signature.parameters.map(copy), result = copy(signature.result);
		const structured = [...signature.parameters, signature.result].some(ref => ref.kind !== 'primitive');
		const publicName = claim(structured ? 'Fn' + pascal(cIdentifier(definitions.get(signature.id).name)) : 'Fn' + signature.parameters.map(ref => primitiveName(ref.name)).join('') + 'To' + primitiveName(signature.result.name));
		const kotlinJavaName = structured ? claim('Kotlin' + publicName) : publicName;
		return [signature.id
			, {
			...signature
			, index
			, parameters
			, result
			, structured
			, publicName
			, kotlinJavaName
			, call: `${generated.prefix}_callback_${signature.key}_lease_call`
			, dispose: `${generated.prefix}_callback_${signature.key}_lease_dispose`
			}
		];
	}));
	const value = ref => callbacks.has(ref.id) ? { callback: callbacks.get(ref.id) } : { node: copy(ref) };
	const names = new Set(members);
	const functions = ir.declarations.map((definition, index) => {
		const publicName = camel(cIdentifier(definition.name));
		if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(publicName) || names.has(publicName) || keywords.has(publicName)) throw new TypeError('Reserved or duplicate JVM callable function: ' + publicName);
		names.add(publicName);
		const parameterNames = definition.parameters.map(site => keywords.has(site.name) ? site.name + '_' : site.name);
		if(parameterNames.some(name => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) || new Set(parameterNames).size !== parameterNames.length) throw new TypeError('JVM callable parameters collide after keyword escaping');
		return { index, definition, publicName, parameterNames, parameters: definition.parameters.map(site => value(site.type)), result: value(definition.result.type), native: descriptor.exports.find(item => item.bindingId === definition.id).symbol + '_graph' };
	});
	let bytes = Object.values(generated.files).reduce((total, text) => total + text.length, 0) + Object.values(generated.kotlin.files).reduce((total, text) => total + text.length, 0);
	for(const callback of callbacks.values())
	{
		const types = [...callback.parameters, callback.result];
		bytes += 16384 + types.reduce((total, node) => total + (node.publicType.length + generated.kotlin.publicTypes[node.id].length) * 32, 0);
	}
	for(const fn of functions) bytes += 8192 + fn.parameterNames.reduce((total, name) => total + name.length * 16, 0);
	if(bytes > 16 * 1024 * 1024) throw new TypeError('JVM callable source exceeds its 16 MiB generation budget');
	return { ...generated, ir, descriptor, payloads, nodes, callbacks, functions, layoutSha256: sha256(canonicalJson({ layout: generated.layout, descriptor })) };
};
