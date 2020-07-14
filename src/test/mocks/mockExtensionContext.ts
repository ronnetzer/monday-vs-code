import * as path from 'path';
import * as temp from 'temp';
import { ExtensionContext, Uri } from 'vscode';

import { InMemoryMemento } from './inMemoryMemento';

export class MockExtensionContext implements ExtensionContext {
	extensionPath = path.resolve(__dirname, '..');

	workspaceState = new InMemoryMemento();
	globalState = new InMemoryMemento();
	subscriptions: { dispose(): any; }[] = [];

	storagePath: string;
	storageUri: Uri;
	globalStoragePath: string;
	globalStorageUri: Uri;
	logPath: string;
	logUri: Uri;
	extensionUri: Uri;
	environmentVariableCollection: any;
	extensionMode: any;

	constructor() {
		this.storagePath = temp.mkdirSync('storage-path');
		this.storageUri = Uri.parse(this.storagePath);
		this.globalStoragePath = temp.mkdirSync('global-storage-path');
		this.globalStorageUri = Uri.parse(this.globalStoragePath);
		this.logPath = temp.mkdirSync('log-path');
	}

	asAbsolutePath(relativePath: string): string {
		return path.resolve(this.extensionPath, relativePath);
	}

	dispose() {
		this.subscriptions.forEach(sub => sub.dispose());
	}
}