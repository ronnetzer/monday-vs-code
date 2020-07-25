/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import { PullRequest } from './github/interface';
import { ITelemetry } from './common/telemetry';
import { CredentialStore } from './monday/credentials';
import { BoardsManager } from './monday/boardsManager';
import { UsersManager } from './monday/usersManager';
import { BoardItem } from './views/boards';

const _onDidUpdatePR = new vscode.EventEmitter<PullRequest | void>();
export const onDidUpdatePR: vscode.Event<PullRequest | void> = _onDidUpdatePR.event;

export function registerCommands(context: vscode.ExtensionContext, telemetry: ITelemetry, credentialStore: CredentialStore, boardsManager: BoardsManager, usersManager: UsersManager) {

	context.subscriptions.push(vscode.commands.registerCommand('auth.signout', async () => {
		credentialStore.logout();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('auth.login', async () => {
		credentialStore.login();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('board.select', async () => {
		boardsManager.selectDefaultBoard();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('boards.refresh', async () => {
		boardsManager.getEntries();
	}));

	context.subscriptions.push(vscode.commands.registerCommand('boards.setDefault', async (boardItem: BoardItem) => {
		boardsManager.setDefaultBoard(boardItem.board);
	}));

	context.subscriptions.push(vscode.commands.registerCommand('users.refresh', async () => {
		usersManager.getEntries();
	}));

	// context.subscriptions.push(vscode.commands.registerCommand('pr.signin', async () => {
	// 	await prManager.authenticate();
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('pr.deleteLocalBranchesNRemotes', async () => {
	// 	await prManager.deleteLocalBranchesNRemotes();
	// }));

	// context.subscriptions.push(vscode.commands.registerCommand('pr.signinAndRefreshList', async () => {
	// 	if (await prManager.authenticate()) {
	// 		vscode.commands.executeCommand('pr.refreshList');
	// 	}
	// }));
}
