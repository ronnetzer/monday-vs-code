/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { userMarkdown, ISSUES_CONFIGURATION, UserCompletionItem, isComment } from './util';
import { StateManager } from './stateManager';
import { NEW_ISSUE_SCHEME } from './issueFile';
import { UsersManager } from '../monday/usersManager';

export class UserCompletionProvider implements vscode.CompletionItemProvider {
	constructor(private stateManager: StateManager, private usersManager: UsersManager, context: vscode.ExtensionContext) {
	}

	async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[]> {
		// If the suggest was not triggered by the trigger character, require that the previous character be the trigger character
		if ((document.languageId !== 'scminput') && (document.uri.scheme !== NEW_ISSUE_SCHEME) && (position.character > 0) && (context.triggerKind === vscode.CompletionTriggerKind.Invoke) && (document.getText(new vscode.Range(position.with(undefined, position.character - 1), position)) !== '@')) {
			return [];
		}

		if ((context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter) &&
			(<string[]>vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get('ignoreUserCompletionTrigger', [])).find(value => value === document.languageId)) {
			return [];
		}

		if ((document.languageId !== 'scminput') && !(await isComment(document, position))) {
			return [];
		}

		let range: vscode.Range = new vscode.Range(position, position);
		if (position.character - 1 >= 0) {
			const wordAtPos = document.getText(new vscode.Range(position.translate(0, -1), position));
			if (wordAtPos === '@') {
				range = new vscode.Range(position.translate(0, -1), position);
			}
		}

		const completionItems: vscode.CompletionItem[] = [];
		(await this.stateManager.userMap).forEach(user => {
			const completionItem: UserCompletionItem = new UserCompletionItem(user.name, vscode.CompletionItemKind.User);
			completionItem.insertText = `@${user.name};`;
			completionItem.range = range;
			completionItem.data = user;
			completionItem.detail = user.isTeam ? 'Team' : user.email;
			completionItem.filterText = `@ ${user.name} ${user.email}`;
			completionItems.push(completionItem);
		});
		return completionItems;
	}

	async resolveCompletionItem(item: UserCompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
		// TODO: get team details if item.data.isTeam
		const userDetails = item.data.isTeam ? item.data : await this.usersManager.getUserDetails([item.data.id]);
		if (userDetails) {
			item.data = { ...item.data, ...userDetails };
			item.documentation = userMarkdown(item.data);
			item.command = {
				command: 'issues.userCompletion',
				title: 'User Completion Chosen'
			};
		}
		return item;
	}
}