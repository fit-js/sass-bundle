'use strict';
import path from 'path';

import vfs from 'vinyl-fs';
import { obj as thru } from 'through2';

import gulpPostCss from 'gulp-postcss';
import autoprefixer from 'autoprefixer';
import postCssCriticalSplit from 'postcss-critical-split';

import gulpGroupCssMediaQuries from 'gulp-group-css-media-queries';
import gulpRename from 'gulp-rename';
import plumber from 'gulp-plumber';
import gulpSass from 'gulp-sass';
import gulpUglifyCss from 'gulp-uglifycss';
import * as pkg from './package.json';

let develop, output, source, trigger, prefixer, imports, critical, testCritical, options, criticalOpts;

export function init (config, core) {
	develop = core.args.env() === 'develop';

	// required
	output = config.output;
	source = core.utils.filterNonExistingFiles (config.source || '*.scss');
	imports = source.map((item) => {
		return path.dirname(item);
	});
	trigger = config.trigger || '**/*.scss';

	// optional
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
			.on ('change', build);
	}
}

function build (file) {
	var msg = file ? file : pkg.name
	console.time (msg);

	if (critical) {
		if (testCritical) {
			buildCritical();
		} else {
			buildCritical (true);
			buildRest();
		}
	} else {
		buildDefault();
	}
	console.timeEnd (msg);
}

function buildCritical (addSuffix) {
	let opts = Object.assign ({}, criticalOpts, { output: 'critical' });

	return vfs.src (source)
		.pipe (plumber())
		.pipe (gulpSass (options))
		.on ('error', gulpSass.logError)
		.pipe (gulpPostCss ([
			postCssCriticalSplit(opts),
			autoprefixer(prefixer)
		]))
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (addSuffix ? gulpRename({'suffix': '.critical'}) : thru())
		.pipe (vfs.dest (output));
}

function buildRest () {
	let opts = Object.assign({}, criticalOpts, { output: 'rest' });

	return vfs.src(source)
		.pipe (plumber())
		.pipe (gulpSass (options))
		.on ('error', gulpSass.logError)
		.pipe (gulpPostCss ([
			postCssCriticalSplit(opts),
			autoprefixer(prefixer)
		]))
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (vfs.dest (output));
}

function buildDefault () {
	return vfs.src (source)
		.pipe (plumber())
		.pipe (gulpSass (options))
		.on ('error', gulpSass.logError)
		.pipe (gulpPostCss ([
			autoprefixer(prefixer)
		]))
		.pipe (gulpGroupCssMediaQuries ())
		.pipe (develop ? thru() : gulpUglifyCss())
		.pipe (vfs.dest (output));
}
