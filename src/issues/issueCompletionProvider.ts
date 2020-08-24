/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { issueMarkdown, ISSUES_CONFIGURATION, isComment, getItemNumberLabel, createItemUrl, variableSubstitution } from './util';
import { StateManager } from './stateManager';
import { UsersManager } from '../monday/usersManager';
import { Item, User } from 'monday-sdk-js';

class IssueCompletionItem extends vscode.CompletionItem {
    constructor(public readonly issue: Item) {
        super(`${issue.id}: ${issue.name}`, vscode.CompletionItemKind.Issue);
    }
}

export class IssueCompletionProvider implements vscode.CompletionItemProvider {
    constructor(
        private stateManager: StateManager,
        private context: vscode.ExtensionContext,
    ) {}

    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext,
    ): Promise<IssueCompletionItem[]> {
        // If the suggest was not triggered by the trigger character, require that the previous character be the trigger character
        if (
            document.languageId !== 'scminput' &&
            position.character > 0 &&
            context.triggerKind === vscode.CompletionTriggerKind.Invoke &&
            !document.getText(document.getWordRangeAtPosition(position)).match(/#[0-9]*$/)
        ) {
            return [];
        }
        // It's common in markdown to start a line with #s and not want an completion
        if (
            position.character <= 6 &&
            document.languageId === 'markdown' &&
            document.getText(new vscode.Range(position.with(undefined, 0), position)) ===
                new Array(position.character + 1).join('#')
        ) {
            return [];
        }

        if (
            context.triggerKind === vscode.CompletionTriggerKind.TriggerCharacter &&
            (<string[]>vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get('ignoreCompletionTrigger', [])).find(
                (value) => value === document.languageId,
            )
        ) {
            return [];
        }

        if (document.languageId !== 'scminput' && !(await isComment(document, position))) {
            return [];
        }

        let range: vscode.Range = new vscode.Range(position, position);
        if (position.character - 1 >= 0) {
            const wordAtPos = document.getText(new vscode.Range(position.translate(0, -1), position));
            if (wordAtPos === '#') {
                range = new vscode.Range(position.translate(0, -1), position);
            }
        }

        await this.stateManager.tryInitializeAndWait();

        const completionItems: Map<string, IssueCompletionItem> = new Map();
        const now = new Date();
        const itemMap = await this.stateManager.itemMap;
        const itemMapValues = [...itemMap.values()];
        for (let idx = 0; idx < itemMapValues.length; idx++) {
            const item = itemMapValues[idx];
            completionItems.set(getItemNumberLabel(item), await this.completionItemFromIssue(item, now, range, document, idx))
        }

        return [...completionItems.values()];
    }

    private async completionItemFromIssue(
        issue: Item,
        now: Date,
        range: vscode.Range,
        document: vscode.TextDocument,
        index: number,
    ): Promise<IssueCompletionItem> {
        const item: IssueCompletionItem = new IssueCompletionItem(issue);
        if (document.languageId === 'markdown') {
            item.insertText = `[${getItemNumberLabel(issue)}](${createItemUrl(issue, this.stateManager.usersManager.currentUser)})`;
        } else {
            const configuration = vscode.workspace
                .getConfiguration(ISSUES_CONFIGURATION)
                .get('issueCompletionFormatScm');
            if (document.uri.path.match(/scm\/git\/scm\d\/input/) && typeof configuration === 'string') {
                item.insertText = await variableSubstitution(configuration, issue);
            } else {
                item.insertText = `${getItemNumberLabel(issue)}`;
            }
        }
        item.documentation = issue.state;
        item.range = range;
        item.detail = issue.group.title;
        let updatedAt: string = (now.getTime() - new Date(issue.updated_at).getTime()).toString();
        updatedAt = new Array(20 - updatedAt.length).join('0') + updatedAt;
        item.sortText = `${index} ${updatedAt}`;
        item.filterText = `${item.detail} # ${issue.id} ${issue.name} ${item.documentation}`;
        return item;
    }

    async resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): Promise<vscode.CompletionItem> {
        if (item instanceof IssueCompletionItem) {
            const itemCreator: User = await this.stateManager.usersManager.getUserDetails([item.issue.creator_id]);
            item.documentation = issueMarkdown(item.issue, itemCreator, this.context);
            item.command = {
                command: 'issues.issueCompletion',
                title: 'Issue Completion Chose,',
            };
        }
        return item;
    }
}
