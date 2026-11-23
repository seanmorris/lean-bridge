/** @file Version-one private word-frame layout shared by the emitter and the JS runtime. */
export const taskFrame = Object.freeze({magic: 0x4c425431
	, handle: 24
	, out: 40
	, args: 72
	, start: 0, listen: 1, take: 2, cancel: 3, close: 4, pull: 5, clear: 6});
