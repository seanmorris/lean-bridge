/**
 * Removes access credentials and local machine paths from distributed source evidence.
 *
 * @file
 * @param remote - Git remote URL or local repository fallback to sanitize.
 */
export const publicRepositoryIdentity = remote => {
	const source = String(remote).trim();
	if(/^[A-Za-z]:[\\/]/.test(source)) return "local";
	const scp = source.match(/^(?:[^@\s/:]+@)?([^\s/:]+):([^\s]+)$/);
	let url;
	try
	{ url = new URL(scp && !source.includes("://") ? `ssh://${scp[1]}/${scp[2]}` : source); }
	catch
	{ return "local"; }
	if(!["https:", "http:", "ssh:", "git:", "git+https:", "git+ssh:"].includes(url.protocol)) return "local";
	url.username = "";
	url.password = "";
	url.search = "";
	url.hash = "";
	return url.href;
};
