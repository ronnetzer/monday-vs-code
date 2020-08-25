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
import { MondayKit, onSessionDidChanged } from './monday/kit';
import { BoardsManager } from './monday/boardsManager';
import { UsersManager } from './monday/usersManager';
import { ItemsManager } from './monday/ItemsManager';
import { BoardProvider } from './views/boards';
import { UserProvider } from './views/users';
import { IssueFeatureRegistrar } from './issues/issueFeatureRegistrar';
import { onceEvent } from './common/utils';

const aiKey = '9fe62150-f293-4898-ae09-3cf831a8dd75';

// fetch.promise polyfill
// eslint-disable-next-line
const fetch = require('node-fetch');
// eslint-disable-next-line
const PolyfillPromise = require('es6-promise').Promise;
fetch.Promise = PolyfillPromise;

let telemetry: TelemetryReporter;
let mondayKit: MondayKit;

async function init(
    context: vscode.ExtensionContext,
    mondayCredentialStore: MondayCredentialStore,
    boardsManager: BoardsManager,
    usersManager: UsersManager,
    itemsManager: ItemsManager,
): Promise<void> {
    // init all services
    await boardsManager.init();
    await usersManager.init();
    await itemsManager.init();

    // init sidebar providers
    const boardsProvider = new BoardProvider(boardsManager, itemsManager);
    vscode.window.registerTreeDataProvider('boards', boardsProvider);

    const usersProvider = new UserProvider(usersManager);
    vscode.window.registerTreeDataProvider('users', usersProvider);

    context.subscriptions.push(Logger);
    Logger.appendLine('Monday board found, initializing items manager & users manager');

    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

    const issuesFeatures = new IssueFeatureRegistrar(
        mondayCredentialStore,
        boardsManager,
        usersManager,
        itemsManager,
        context,
        telemetry,
    );

    context.subscriptions.push(issuesFeatures);
    await issuesFeatures.initialize();

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
    const usersManager = new UsersManager(telemetry, mondayKit.sdk);
    const itemsManager = new ItemsManager(telemetry, mondayKit.sdk, boardsManager, usersManager);

    registerCommands(context, telemetry, mondayCredentialStore, boardsManager, usersManager);

    if (mondayKit.isAuthenticated()) {
        await init(context, mondayCredentialStore, boardsManager, usersManager, itemsManager);
    } else {
        onceEvent(onSessionDidChanged)((e) =>
            init(context, mondayCredentialStore, boardsManager, usersManager, itemsManager),
        );
    }

    return mondayCredentialStore.getApi();
}

export async function deactivate(): Promise<void> {
    if (telemetry) {
        telemetry.dispose();
    }
}
