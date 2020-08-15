/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

export type GlobalStateContext = { globalState: vscode.Memento };

let defaultStorage: vscode.Memento | undefined = undefined;

export const MISSING = undefined;

export function init(ctx: GlobalStateContext): void {
    defaultStorage = ctx.globalState;
}

export const fetch = <R = unknown>(scope: string, key: string): R | typeof MISSING => {
    if (!defaultStorage) {
        throw new Error('Persistent store not initialized.');
    }
    return defaultStorage.get(scope + ':' + key, MISSING);
};

export const store = (scope: string, key: string, value: unknown): Thenable<void> => {
    if (!defaultStorage) {
        throw new Error('Persistent store not initialized.');
    }
    return defaultStorage.update(scope + ':' + key, value);
};
