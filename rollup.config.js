import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';
import localResolve from 'rollup-plugin-local-resolve';
import json from 'rollup-plugin-json';
import * as pkg from './package.json';

export default {
	input: pkg.module,
	output: {
		name: pkg.name,
		file: pkg.main,
		format: 'cjs'
	},
	external: [
		'gulp-group-css-media-queries',
		'postcss-rtl',
		'gulp-sass',
		'node-sass',
		'postcss',
		'readable-stream',
		'through2',
		'vinyl-fs'
	],
	plugins: [
		nodeResolve ({
			module: true,
			jsnext: false,
			main: false,
			preferBuiltins: true,
			modulesOnly: false,
			extensions: ['.js', '.json']
		}),
		localResolve(),
		commonjs ({
			include: 'node_modules/**',
			ignoreGlobal: true,
			sourceMap: false,
			ignore: ['fs', 'path']
		}),
		json()
	]
};
