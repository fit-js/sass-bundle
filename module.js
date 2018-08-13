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


let develop, output, source, trigger, prefixer, imports, critical, testCritical, options, criticalOpts, rtlSupport;

export function init (config, core) {
	develop = core.args.env() === 'develop';

	// required
	output = config.output;
	source = core.utils.filterNonExistingFiles (config.source || '*.scss');
	trigger = config.trigger || '**/*.scss';
	imports = [].concat(source).concat(trigger).map((item) => {
		return path.dirname(item);
	});

	// optional
	rtlSupport = config.rtl || false;
	prefixer = config.autoprefixer_options;
	critical = config.critical || false;
	testCritical = critical && config.critical === 'test';

	if (!output) {
		core.utils.error (pkg.name, 'config.output are required');
		return;
	}

	if(critical === 'test') {
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
		return bs.watch (trigger)
			.on ('change', 
				debounce(build, 100)
			);
	}
}

function build (file) {
	file && console.log(file + ' has changed');
	console.time (pkg.name);

	let stream = VFS
		.src (source)
		.pipe (plumber())
		.pipe (changed(output))
		.pipe (gulpSass (options))
		.on ('error', gulpSass.logError)
		.on ('end', () => {
			console.timeEnd (pkg.name);
		});

	if (critical) {
		build_critical(stream);
		return;
	}

	if (rtlSupport) {
		build_rtl(stream);
		return;
	}

	buildDefault(stream);
}

function build_critical (stream) {
	let opts = Object.assign({ output: testCritical ? 'critical' : 'rest' }, criticalOpts);

	stream
		.pipe (gulpPostCss ([
			postCssCriticalSplit(opts),
			autoprefixer(prefixer)
		]))
		.pipe (gulpClip())
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (testCritical ? gulpRename({'suffix': '.critical'}) : thru())
		.pipe (VFS.dest (output));
}

function build_rtl (stream) {

	stream
		.pipe (gulpPostCss ([
			rtl(),
			autoprefixer(prefixer)
		]))
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (VFS.dest (output));
}

function buildDefault (stream) {

	stream
		.pipe (gulpPostCss ([
			autoprefixer(prefixer)
		]))
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (VFS.dest (output));
}
