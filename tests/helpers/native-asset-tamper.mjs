/**
 * Corrupt a test-owned native asset, then restore its bytes and permissions.
 *
 * @file
 */
import { chmod, lstat, readFile, writeFile } from "node:fs/promises";

/**
 * Installers can make libraries read-only. Give the fixture's owner temporary
 * write permission without changing package contents or depending on root.
 *
 * @param path - Regular file in the test's private deployment.
 * @param check - Rejection probe, executed while the file is corrupt.
 */
export const withCorruptedNativeAsset = async (path, check) => {
	const attributes = await lstat(path);
	if(!attributes.isFile()) throw new TypeError("Native tamper probes require a regular file");
	const original = await readFile(path);
	if(original.length === 0) throw new TypeError("Native tamper probes require a nonempty file");
	const corrupt = Buffer.from(original); corrupt[corrupt.length - 1] ^= 1;
	const mode = attributes.mode & 0o7777;
	await chmod(path, mode | 0o200);
	try
	{
		await writeFile(path, corrupt);
		return await check();
	}
	finally
	{
		try
		{
			await writeFile(path, original);
		}
		finally
		{
			await chmod(path, mode);
		}
	}
};
