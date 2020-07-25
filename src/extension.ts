/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as WorkspaceState from './common/workspaceState';
import * as PersistentState from './common/persistentState';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { registerCommands } from './commands';
import Logger from './common/logger';
import { Resource } from './common/resources';
import { handler as uriHandler } from './common/uri';
// import { FileTypeDecorationProvider } from './view/fileTypeDecorationProvider';
import { EXTENSION_ID } from './constants';
import { CredentialStore as MondayCredentialStore } from './monday/credentials';
import { MondayKit } from './monday/kit';
import { BoardsManager } from './monday/boardsManager';
import { UsersManager } from './monday/usersManager';
import { ItemsManager } from './monday/ItemsManager';
import { BoardProvider } from './views/boards';
import { UserProvider } from './views/users';
import { IssueFeatureRegistrar } from './issues/issueFeatureRegistrar';

const aiKey: string = '5f5c7e72-c998-4afe-ac9b-4bf9b25ace98';

// fetch.promise polyfill
const fetch = require('node-fetch');
const PolyfillPromise = require('es6-promise').Promise;
fetch.Promise = PolyfillPromise;

let telemetry: TelemetryReporter;
let mondayKit: MondayKit;

async function init(context: vscode.ExtensionContext, mondayCredentialStore: MondayCredentialStore, boardsManager: BoardsManager, usersManager: UsersManager, tasksManager: ItemsManager): Promise<void> {
	context.subscriptions.push(Logger);
	Logger.appendLine('Monday board found, initializing items manager & users manager');

	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

	const issuesFeatures = new IssueFeatureRegistrar(mondayCredentialStore, boardsManager, usersManager, tasksManager, context, telemetry);
	context.subscriptions.push(issuesFeatures);
	await issuesFeatures.initialize();

	registerCommands(context, telemetry, mondayCredentialStore, boardsManager, usersManager);

	/* __GDPR__
		"startup" : {}
	*/
	telemetry.sendTelemetryEvent('startup');
}

export async function activate(context: vscode.ExtensionContext): Promise<MondayKit | undefined> {
	// initialize resources
	Resource.initialize(context);

	const version = vscode.extensions.getExtension(EXTENSION_ID)!.packageJSON.version;

	telemetry = new TelemetryReporter(EXTENSION_ID, version, aiKey);
	context.subscriptions.push(telemetry);

	PersistentState.init(context);
	WorkspaceState.init(context);

	const mondayCredentialStore = new MondayCredentialStore(telemetry);
	mondayKit = await mondayCredentialStore.initialize();

	Logger.appendLine('Looking for Monday board');

	const boardsManager = new BoardsManager(telemetry, mondayKit.sdk);
	const selectedBoard = await boardsManager.init();
	// TODO: instantiate BoardsManager(...) @daniel.netzer

	const usersManager = new UsersManager(telemetry, mondayCredentialStore);
	await usersManager.init();

	// init sidebar (extract to the relevant services?)
	const boardsProvider = new BoardProvider(boardsManager);
	vscode.window.registerTreeDataProvider('boards', boardsProvider);

	const usersProvider = new UserProvider(usersManager);
	vscode.window.registerTreeDataProvider('users', usersProvider);

	const tasksManager = new ItemsManager(mondayCredentialStore, boardsManager, telemetry);

	Logger.appendLine(`Found default board: ${selectedBoard}`);
	// const prTree = new PullRequestsTreeDataProvider(telemetry);
	// context.subscriptions.push(prTree);

	Logger.appendLine(`Found default board: ${selectedBoard.id}`);

	// if (selectedRepository) {
	await init(context, mondayCredentialStore, boardsManager, usersManager, tasksManager);
	// } else {
	// 	onceEvent(apiImpl.onDidOpenRepository)(r => init(context, mondayCredentialStore, apiImpl, gitAPI, credentialStore, r, prTree, liveshareApiPromise));
	// }

	return mondayCredentialStore.getApi();
}

export async function deactivate() {
	if (telemetry) {
		telemetry.dispose();
	}
}