/**
 * Defines exact ecosystem archive subjects for signed publication and receipt statements.
 *
 * @file
 */

import { basename } from "node:path";

const sha256Pattern = /^[0-9a-f]{64}$/;

const fail = message => {
	throw new TypeError(message);
};

const string = (value, label) => {
	if(typeof value !== "string" || value === "") fail(`${label} must be a non-empty string`);
};

const portablePath = (value, label) => {
	string(value, label);
	if(value.startsWith("/") || value.includes("\\") || value.split("/").includes(".."))
	{
		fail(`${label} must be a relative portable path`);
	}
};

const exactKeys = (value, keys, label) => {
	if(value === null || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object`);
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	if(JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${label} fields must be closed`);
};

const snapshot = value => Object.freeze({ ...value });

/**
 * Builds the canonical signed record for every archive in an ordered publication target list.
 *
 * @param targets - Publication targets containing ecosystem, coordinate, operation, and archive records.
 */
export const releaseArchiveSubjectsFor = targets => {
	if(!Array.isArray(targets) || targets.length === 0) fail("publication targets must be a non-empty array");
	const subjects = [];
	for(const target of targets)
	{
		if(target === null || typeof target !== "object" || Array.isArray(target)) fail("publication target must be an object");
		for(const field of ["ecosystem", "coordinate", "operation"]) string(target[field], `target.${field}`);
		if(!Array.isArray(target.archives) || target.archives.length === 0) fail(`${target.ecosystem} target must contain archives`);
		for(const archive of target.archives)
		{
			if(archive === null || typeof archive !== "object" || Array.isArray(archive)) fail(`${target.ecosystem} archive must be an object`);
			for(const field of ["kind", "path"]) string(archive[field], `archive.${field}`);
			portablePath(archive.path, "archive.path");
			if(!Number.isSafeInteger(archive.bytes) || archive.bytes < 0) fail("archive.bytes must be a non-negative safe integer");
			if(typeof archive.sha256 !== "string" || !sha256Pattern.test(archive.sha256)) fail("archive.sha256 must be a SHA-256 identity");
			subjects.push(snapshot({
				ecosystem: target.ecosystem
				, coordinate: target.coordinate
				, operation: target.operation
				, kind: archive.kind
				, path: archive.path
				, filename: basename(archive.path)
				, bytes: archive.bytes
				, sha256: archive.sha256
			}));
		}
	}
	subjects.sort((left, right) => left.path.localeCompare(right.path));
	for(let index = 1; index < subjects.length; index += 1)
	{
		if(subjects[index].path === subjects[index - 1].path) fail(`archive subject path is duplicated: ${subjects[index].path}`);
	}
	return Object.freeze(subjects);
};

/**
 * Validates a signed archive-subject array and optionally compares it with its publication targets.
 *
 * @param subjects - Signed archive subject records.
 * @param targets - Optional target list used to reconstruct the expected canonical records.
 */
export const validateReleaseArchiveSubjects = (subjects, targets = null) => {
	if(!Array.isArray(subjects) || subjects.length === 0) fail("archiveSubjects must be a non-empty array");
	let previous = null;
	for(const subject of subjects)
	{
		exactKeys(subject, [
			"ecosystem"
			, "coordinate"
			, "operation"
			, "kind"
			, "path"
			, "filename"
			, "bytes"
			, "sha256"
		], "archive subject");
		for(const field of ["ecosystem", "coordinate", "operation", "kind", "filename"])
		{
			string(subject[field], `archive subject ${field}`);
		}
		portablePath(subject.path, "archive subject path");
		if(subject.filename !== basename(subject.path)) fail("archive subject filename differs from its path");
		if(!Number.isSafeInteger(subject.bytes) || subject.bytes < 0) fail("archive subject bytes must be a non-negative safe integer");
		if(typeof subject.sha256 !== "string" || !sha256Pattern.test(subject.sha256)) fail("archive subject sha256 must be a SHA-256 identity");
		if(previous !== null && subject.path.localeCompare(previous) <= 0) fail("archive subjects must use unique canonical path order");
		previous = subject.path;
	}
	if(targets !== null)
	{
		const expected = releaseArchiveSubjectsFor(targets);
		const fields = ["ecosystem", "coordinate", "operation", "kind", "path", "filename", "bytes", "sha256"];
		const records = values => values.map(subject => fields.map(field => subject[field]));
		if(JSON.stringify(records(subjects)) !== JSON.stringify(records(expected))) fail("archive subjects differ from their publication targets");
	}
	return true;
};
