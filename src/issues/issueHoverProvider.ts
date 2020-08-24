/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
    ISSUE_OR_URL_EXPRESSION,
    parseIssueExpressionOutput,
    issueMarkdown,
    shouldShowHover,
} from './util';
import { StateManager } from './stateManager';
import { ITelemetry } from '../common/telemetry';
import { Item, ItemPreview } from 'monday-sdk-js';

export class IssueHoverProvider implements vscode.HoverProvider {
    constructor(
        private stateManager: StateManager,
        private context: vscode.ExtensionContext,
        private telemetry: ITelemetry,
    ) {}

    async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
        if (!(await shouldShowHover(document, position))) {
            return;
        }

        let wordPosition = document.getWordRangeAtPosition(position, ISSUE_OR_URL_EXPRESSION);
        if (wordPosition && wordPosition.start.character > 0) {
            wordPosition = new vscode.Range(
                new vscode.Position(wordPosition.start.line, wordPosition.start.character - 1),
                wordPosition.end,
            );
            const word = document.getText(wordPosition).trim();
            const match = word.match(ISSUE_OR_URL_EXPRESSION);
            const tryParsed = parseIssueExpressionOutput(match);
            if (tryParsed && match) {
                return this.createHover(match[0], tryParsed, wordPosition);
            }
        } else {
            return;
        }
    }

    private async createHover(
        value: string,
        parsed: ItemPreview,
        range: vscode.Range,
    ): Promise<vscode.Hover | undefined> {
        const item = await this.getIssue(value, parsed);
        if (item) {
        /* __GDPR__
				"issue.issueHover" : {}
			*/
            this.telemetry.sendTelemetryEvent('issues.issueHover');
            const itemCreator = await this.stateManager.usersManager.getUserDetails([item.creator_id]);
            const hover = new vscode.Hover(issueMarkdown(item, itemCreator, this.context), range);
            return hover;
        } else {
            return;
        }
    }

    private async getIssue(value: string, parsed: ItemPreview): Promise<Item> {
        return this.stateManager.itemsManager.getItem(parsed?.id || value);
    }
}
