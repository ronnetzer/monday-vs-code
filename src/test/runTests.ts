import * as cp from 'child_process';
import * as path from 'path';
import { runTests, downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from 'vscode-test';

async function go() {
	try {
		const extensionDevelopmentPath = path.resolve(__dirname, '../../');
		const extensionTestsPath = path.resolve(__dirname, './');
		const vscodeExecutablePath = await downloadAndUnzipVSCode('insiders');
		const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

		// Use cp.spawn / cp.exec for custom setup
		cp.spawnSync(cliPath, ['--install-extension', 'github.vscode-pull-request-github'], {
			encoding: 'utf-8',
			stdio: 'inherit'
		});

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