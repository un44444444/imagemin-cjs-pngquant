'use strict';
const execa = require('execa');
const isPng = require('is-png');
const isStream = require('is-stream');
const pngquant = require('pngquant-bin');
const ow = require('ow');
const os = require("os");
const path = require('path');

const imageminPngquant = (options = {}) => input => {
	const isBuffer = Buffer.isBuffer(input);

	if (!isBuffer && !isStream(input)) {
		return Promise.reject(new TypeError(`Expected a Buffer or Stream, got ${typeof input}`));
	}

	if (isBuffer && !isPng(input)) {
		return Promise.resolve(input);
	}

	const args = ['-'];

	if (typeof options.speed !== 'undefined') {
		ow(options.speed, ow.number.integer.inRange(1, 11));
		args.push('--speed', options.speed);
	}

	if (typeof options.strip !== 'undefined') {
		ow(options.strip, ow.boolean);

		if (options.strip) {
			args.push('--strip');
		}
	}

	if (typeof options.quality !== 'undefined') {
		ow(options.quality, ow.array.length(2).ofType(ow.number.inRange(0, 1)));
		const [min, max] = options.quality;
		args.push('--quality', `${Math.round(min * 100)}-${Math.round(max * 100)}`);
	}

	if (typeof options.dithering !== 'undefined') {
		ow(options.dithering, ow.any(ow.number.inRange(0, 1), ow.boolean.false));

		if (typeof options.dithering === 'number') {
			args.push(`--floyd=${options.dithering}`);
		} else if (options.dithering === false) {
			args.push('--ordered');
		}
	}

	if (typeof options.posterize !== 'undefined') {
		ow(options.posterize, ow.number);
		args.push('--posterize', options.posterize);
	}

	if (typeof options.verbose !== 'undefined') {
		ow(options.verbose, ow.boolean);
		args.push('--verbose');
	}

	// fix: in pkg can not spawn pngquant.exe
	let newPngQuant = pngquant;
	let isInPkg = false;
	const platform = os.platform();
	if (platform.startsWith('win')) {
		if (pngquant.startsWith('C:\\snapshot\\')) {
			isInPkg = true;
		}
	}
	else {
		if (pngquant.startsWith('/snapshot/')) {
			isInPkg = true;
		}
	}
	if (isInPkg) {
		const sepIndex = pngquant.lastIndexOf(path.sep);
		if (sepIndex > 0) {
			const filePngquant = pngquant.substring(sepIndex + 1);
			newPngQuant = filePngquant;
		}
	}

	const subprocess = execa(newPngQuant, args, {
		encoding: null,
		maxBuffer: Infinity,
		input
	});

	const promise = subprocess
		.then(result => result.stdout) // eslint-disable-line promise/prefer-await-to-then
		.catch(error => {
			// We use `error.exitCode` to check for a special condition when running the pngquant binary.
			// See details on handling of "99" code at https://pngquant.org (search for "status code 99").
			if (error.exitCode === 99) {
				return input;
			}

			error.message = error.stderr || error.message;
			throw error;
		});

	subprocess.stdout.then = promise.then.bind(promise); // eslint-disable-line promise/prefer-await-to-then
	subprocess.stdout.catch = promise.catch.bind(promise);

	return subprocess.stdout;
};

module.exports = imageminPngquant;
module.exports.default = imageminPngquant;
