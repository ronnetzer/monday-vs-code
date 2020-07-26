/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { userMarkdown, USER_EXPRESSION, shouldShowHover } from './util';
import { ITelemetry } from '../common/telemetry';
import { UsersManager } from '../monday/usersManager';
import { StateManager } from './stateManager';

export class UserHoverProvider implements vscode.HoverProvider {
	constructor(private stateManager: StateManager, private usersManager: UsersManager, private telemetry: ITelemetry) { }

	async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {
		if (!(await shouldShowHover(document, position))) {
			return;
		}

		let wordPosition = document.getWordRangeAtPosition(position, USER_EXPRESSION);
		if (wordPosition && (wordPosition.start.character > 0)) {
			wordPosition = new vscode.Range(new vscode.Position(wordPosition.start.line, wordPosition.start.character), wordPosition.end);
			const word = document.getText(wordPosition);
			const match = word.match(USER_EXPRESSION);
			if (match) {
				return this.createHover(match[1], wordPosition);
			}
		} else {
			return;
		}
	}

	private async createHover(username: string, range: vscode.Range): Promise<vscode.Hover | undefined> {
		try {
			const user = (await this.stateManager.userMap).get(username);
			if (user && user.name) {
				const details = user.isTeam ? user : await this.usersManager.getUserDetails([user.id]);
				/* __GDPR__
					"issue.userHover" : {}
				*/
				this.telemetry.sendTelemetryEvent('issues.userHover');
				return new vscode.Hover(userMarkdown({ ...user, ...details }), range);
			} else {
				return;
			}
		} catch (e) {
			// No need to notify about a hover that doesn't work
			return;
		}
	}
}