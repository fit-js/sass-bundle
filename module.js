'use strict';
import path from 'path';

import VFS from 'vinyl-fs';
import { obj as thru } from 'through2';
import debounce from 'debounce';

import gulpPostCss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import postCssCriticalSplit from 'postcss-critical-split';
import changed from 'gulp-changed';
import plumber from 'gulp-plumber';
import nodeSass from 'node-sass';
import rtl from 'postcss-rtl';

import gulpGroupCssMediaQuries from 'gulp-group-css-media-queries';
import gulpRename from 'gulp-rename';
import gulpClip from 'gulp-clip-empty-files';
import gulpSass from 'gulp-sass';
import gulpUglifyCss from 'gulp-uglifycss';
import * as pkg from './package.json';


let develop, output, source, trigger, prefixer, imports, critical, options, criticalOpts, rtlSupport;

export function init(config, core) {
	develop = core.args.env() === 'develop';

	// required
	output = config.output;
	source = core.utils.filterNonExistingFiles(config.source || '*.scss');
	trigger = config.trigger || '**/*.scss';
	imports = [].concat(source).concat(trigger).map((item) => {
		return path.dirname(item);
	});

	// optional
	rtlSupport = config.rtl || false;
	prefixer = config.autoprefixer_options;
	critical = config.critical || false;

	if (!output) {
		core.utils.error(pkg.name, 'config.output are required');
		return;
	}

	if (critical) {
		core.utils.error('Critical', 'Enabled');
	}

	options = {
		functions: {
			'encodeBase64($string)': function ($string) {
				var buffer = new Buffer($string.getValue());
				return nodeSass.types.String(buffer.toString('base64'));
			}
		},
		includePaths: imports.concat([
			'node_modules',
			path.join(__dirname, 'sass')
		])
	};

	criticalOpts = {
		start: 'critical:start',
		stop: 'critical:end'
	};

	build();

	let bs = core.globals.get('bs');

	if (develop && bs) {
		return bs.watch(trigger)
			.on('change',
				debounce(build, 100)
			);
	}
}

function $stream(stream) {
	return new Promise((resolve) => {
		stream(VFS
			.src(source)
			.pipe(plumber())
			.pipe(changed(output))
			.pipe(gulpSass(options))
			.on('error', gulpSass.logError)
			.on('end', () => {
				resolve();
			})
		)
			.pipe(gulpClip())
			.pipe(gulpGroupCssMediaQuries())
			.pipe(develop ? thru() : gulpUglifyCss())
			.pipe(VFS.dest(output));
	});
}

function build(file) {
	file && console.log(file + ' has changed');
	console.time(pkg.name);
	let stream;

	if (critical) {
		stream = $stream(buildCritical)
			.then(() => $stream(buildDefault));

	} else if (rtlSupport) {
		stream = $stream(buildRtl);

	} else {
		stream = $stream(buildDefault);

	}

	stream.then(() => {
		console.timeEnd(pkg.name);
	});
}

function buildCritical(stream) {
	let opts = Object.assign({ output: 'critical' }, criticalOpts);

	return stream
		.pipe(gulpPostCss([
			postCssCriticalSplit(opts),
			autoprefixer(prefixer)
		]))
		.pipe(gulpRename({ 'suffix': '.critical' }));
}

function buildRtl(stream) {
	return stream
		.pipe(gulpPostCss([
			rtl(),
			autoprefixer(prefixer)
		]));
}

function buildDefault(stream) {
	return stream
		.pipe(gulpPostCss([
			autoprefixer(prefixer)
		]));
}
