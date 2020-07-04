import * as path from 'path';
import { runTests, downloadAndUnzipVSCode } from 'vscode-test';

async function go() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './');
		const vscodeExecutablePath = await downloadAndUnzipVSCode('insiders');

		/**
		 * Basic usage
		 */
		await runTests({
			vscodeExecutablePath,
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				'--disable-extensions'
			]
		});
	} catch (e) {
		console.log(e);
		process.exit(1);
	}
}

go();