/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import { ITelemetry } from './common/telemetry';
import { CredentialStore } from './monday/credentials';
import { BoardsManager } from './monday/boardsManager';
import { UsersManager } from './monday/usersManager';
import { BoardTreeItem } from './views/boards';

export function registerCommands(
    context: vscode.ExtensionContext,
    telemetry: ITelemetry,
    credentialStore: CredentialStore,
    boardsManager: BoardsManager,
    usersManager: UsersManager,
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand('auth.logout', async () => {
            credentialStore.logout();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('auth.login', async () => {
            credentialStore.login();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('board.select', async () => {
            boardsManager.selectDefaultBoard();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('boards.refresh', async () => {
            boardsManager.getEntries();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('boards.setDefault', async (boardItem: BoardTreeItem) => {
            boardsManager.defaultBoard = boardItem.board;
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('users.refresh', async () => {
            usersManager.getEntries();
        }),
    );
}
