/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

// import { Repository } from './api/api';
// import { ApiImpl } from './api/api1';
// import { onceEvent } from './common/utils';
// import { PullRequestManager } from './github/pullRequestManager';
// import { registerBuiltinGitProvider, registerLiveShareGitProvider } from './gitProviders/api';
// import { PullRequestsTreeDataProvider } from './view/prsTreeDataProvider';
// import { ReviewManager } from './view/reviewManager';
// import { IssueFeatureRegistrar } from './issues/issueFeatureRegistrar';
// import { CredentialStore } from './github/credentials';

// import { GitExtension, GitAPI } from './typings/git';
// import { GitHubContactServiceProvider } from './gitProviders/GitHubContactServiceProvider';
// import { LiveShare } from 'vsls/vscode.js';

import * as WorkspaceState from './common/workspaceState';
import * as PersistentState from './common/persistentState';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { registerCommands } from './commands';
import Logger from './common/logger';
import { Resource } from './common/resources';
import { handler as uriHandler } from './common/uri';
import { FileTypeDecorationProvider } from './view/fileTypeDecorationProvider';
import { EXTENSION_ID } from './constants';
import { CredentialStore as MondayCredentialStore } from './monday/credentials';
import { MondayKit } from './monday/kit';
import { BoardsManager } from './monday/boardsManager';
import { UsersManager } from './monday/usersManager';

const aiKey: string = '5f5c7e72-c998-4afe-ac9b-4bf9b25ace98';

// fetch.promise polyfill
const fetch = require('node-fetch');
const PolyfillPromise = require('es6-promise').Promise;
fetch.Promise = PolyfillPromise;

let telemetry: TelemetryReporter;
let mondayKit: MondayKit;

async function init(context: vscode.ExtensionContext, mondayCredentialStore: MondayCredentialStore, boardsManager: BoardsManager): Promise<void> {
	context.subscriptions.push(Logger);
	Logger.appendLine('Monday board found, initializing items manager & users manager');

	context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));
	context.subscriptions.push(new FileTypeDecorationProvider());

	const usersManager = new UsersManager(telemetry, mondayKit.sdk);
	await usersManager.init();

	// TODO: instantiate ItemsManager(...) @ron.netzer
	// const prManager = new PullRequestManager(repository, telemetry, git, credentialStore);
	// context.subscriptions.push(prManager);

	// liveshareApiPromise.then((api) => {
	// 	if (api) {
	// 		// register the pull request provider to suggest PR contacts
	// 		api.registerContactServiceProvider('github-pr', new GitHubContactServiceProvider(prManager));
	// 	}
	// });
	// const reviewManager = new ReviewManager(context, repository, prManager, tree, telemetry);
	// await tree.initialize(prManager);
	registerCommands(context, telemetry, mondayCredentialStore, boardsManager);

	// git.onDidChangeState(() => {
	// 	reviewManager.updateState();
	// });

	// git.repositories.forEach(repo => {
	// 	repo.ui.onDidChange(() => {
	// 		// No multi-select support, always show last selected repo
	// 		if (repo.ui.selected) {
	// 			prManager.repository = repo;
	// 			reviewManager.setRepository(repo, false);
	// 			tree.updateQueries();
	// 		}
	// 	});
	// });

	// git.onDidOpenRepository(repo => {
	// 	repo.ui.onDidChange(() => {
	// 		if (repo.ui.selected) {
	// 			prManager.repository = repo;
	// 			reviewManager.setRepository(repo, false);
	// 			tree.updateQueries();
	// 		}
	// 	});
	// 	const disposable = repo.state.onDidChange(() => {
	// 		prManager.repository = repo;
	// 		reviewManager.setRepository(repo, true);
	// 		disposable.dispose();
	// 	});
	// });

	// context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editorChange => {
	// 	if (!editorChange) {
	// 		return;
	// 	}
	// 	for (const repo of git.repositories) {
	// 		if (editorChange.document.uri.fsPath.toLowerCase().startsWith(repo.rootUri.fsPath.toLowerCase()) &&
	// 			(repo.rootUri.fsPath.toLowerCase() !== prManager.repository.rootUri.fsPath.toLowerCase())) {
	// 			prManager.repository = repo;
	// 			reviewManager.setRepository(repo, true);
	// 			return;
	// 		}
	// 	}
	// }));

	// await vscode.commands.executeCommand('setContext', 'github:initialized', true);
	// const issuesFeatures = new IssueFeatureRegistrar(gitAPI, prManager, reviewManager, context, telemetry);
	// context.subscriptions.push(issuesFeatures);
	// await issuesFeatures.initialize();

	/* __GDPR__
		"startup" : {}
	*/
	telemetry.sendTelemetryEvent('startup');
}

export async function activate(context: vscode.ExtensionContext): Promise<MondayKit | undefined> {
	// initialize resources
	Resource.initialize(context);
	// const apiImpl = new ApiImpl();

	const version = vscode.extensions.getExtension(EXTENSION_ID)!.packageJSON.version;
	telemetry = new TelemetryReporter(EXTENSION_ID, version, aiKey);
	context.subscriptions.push(telemetry);

	PersistentState.init(context);
	WorkspaceState.init(context);

	const mondayCredentialStore = new MondayCredentialStore(telemetry);
	mondayKit = await mondayCredentialStore.initialize();

	// const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')!.exports;
	// const gitAPI = gitExtension.getAPI(1);

	// context.subscriptions.push(registerBuiltinGitProvider(apiImpl));
	// const liveshareGitProvider = registerLiveShareGitProvider(apiImpl);
	// context.subscriptions.push(liveshareGitProvider);
	// const liveshareApiPromise = liveshareGitProvider.initialize();

	// context.subscriptions.push(apiImpl);

	Logger.appendLine('Looking for Monday board');

	const boardsManager = new BoardsManager(telemetry, mondayKit.sdk);
	const selectedBoard = await boardsManager.init();
	// TODO: instantiate BoardsManager(...) @daniel.netzer

	Logger.appendLine(`Found default board: ${selectedBoard}`);
	// const prTree = new PullRequestsTreeDataProvider(telemetry);
	// context.subscriptions.push(prTree);

	// The Git extension API sometimes returns a single repository that does not have selected set,
	// so fall back to the first repository if no selected repository is found.
	// const selectedRepository = apiImpl.repositories.find(repository => repository.ui.selected) || apiImpl.repositories[0];

	// if (selectedRepository) {
	await init(context, mondayCredentialStore, boardsManager);
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