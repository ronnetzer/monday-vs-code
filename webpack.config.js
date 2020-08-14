/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require('path');
const webpack = require('webpack');

/**
 *
 * @param {*} env
 * @returns webpack.Configuration
 */
function getExtensionConfig(env) {
	/** @type webpack.Configuration */
	let config = {
		name: 'extension',
		mode: env.production ? 'production' : 'development',
		target: 'node',
		entry: {
			extension: './src/extension.ts'
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: 'ts-loader',
					exclude: /node_modules/
				}
			]
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js'],
			alias: {
				"node-fetch": path.resolve(__dirname, 'node_modules/node-fetch/dist/index.cjs'),
			}
		},
		devtool: !env.production ? 'source-map' : undefined,
		output: {
			filename: '[name].js',
			path: path.resolve(__dirname, 'media'),
			libraryTarget: "commonjs",
			devtoolModuleFilenameTemplate: 'file:///[absolute-resource-path]'
		},
		externals: {
			'vscode': 'commonjs vscode',
			'utf-8-validate': 'utf-8-validate',
			'bufferutil': 'bufferutil',
			'encoding': 'encoding',
			'applicationinsights-native-metrics': 'applicationinsights-native-metrics'
		}
	};

	return config;
}

module.exports = function (env) {
	env = env || {};
	env.production = !!env.production;
	return [getExtensionConfig(env)];
};