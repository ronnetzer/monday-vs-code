/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { UserHoverProvider } from './userHoverProvider';
import { IssueTodoProvider } from './issueTodoProvider';
import { IssueCompletionProvider } from './issueCompletionProvider';
import { NewIssue, USER_EXPRESSION, ISSUES_CONFIGURATION, createItemUrl } from './util';
import { UserCompletionProvider } from './userCompletionProvider';
import { StateManager } from './stateManager';
import { Resource } from '../common/resources';
import {
    IssueFileSystemProvider,
    NEW_ISSUE_SCHEME,
    SUBSCRIBERS,
    TAGS,
    TagCompletionProvider,
    NEW_ISSUE_FILE,
    BOARD,
    GROUP,
} from './issueFile';
import { ITelemetry } from '../common/telemetry';
import { BoardsManager } from '../monday/boardsManager';
import { UsersManager } from '../monday/usersManager';
import { CredentialStore } from '../monday/credentials';
import { ItemsManager } from '../monday/ItemsManager';
import { GroupTreeItem } from '../views/boards';
import { IssueHoverProvider } from './issueHoverProvider';
import { group } from 'console';

const ISSUE_COMPLETIONS_CONFIGURATION = 'issueCompletions.enabled';
const USER_COMPLETIONS_CONFIGURATION = 'userCompletions.enabled';

export class IssueFeatureRegistrar implements vscode.Disposable {
    private _stateManager: StateManager;
    private createIssueInfo:
        | {
            document: vscode.TextDocument;
            newIssue: NewIssue | undefined;
            lineNumber: number | undefined;
            insertIndex: number | undefined;
        }
        | undefined;

    constructor(
        private credentialStore: CredentialStore,
        private boardsManager: BoardsManager,
        private usersManager: UsersManager,
        private itemsManager: ItemsManager,
        private context: vscode.ExtensionContext,
        private telemetry: ITelemetry,
    ) {
        this._stateManager = new StateManager(
            this.credentialStore,
            this.boardsManager,
            this.itemsManager,
            this.usersManager,
            this.telemetry,
            this.context,
        );
    }

    async initialize(): Promise<any> {
        this.context.subscriptions.push(
            vscode.workspace.registerFileSystemProvider(NEW_ISSUE_SCHEME, new IssueFileSystemProvider()),
        );
        this.registerCompletionProviders();
        this.context.subscriptions.push(
            vscode.languages.registerCompletionItemProvider(
                { scheme: NEW_ISSUE_SCHEME },
                new TagCompletionProvider(this.itemsManager),
                ' ',
                ',',
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.createIssueFromSelection',
                (newIssue?: NewIssue, issueBody?: string) => {
                    /* __GDPR__
                "issue.createIssueFromSelection" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.createIssueFromSelection');
                    return this.createTodoIssue(newIssue, issueBody);
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.createIssueFromClipboard',
                () => {
                    /* __GDPR__
                "issue.createIssueFromClipboard" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.createIssueFromClipboard');
                    return this.createTodoIssueClipboard();
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.copyGithubPermalink',
                () => {
                    /* __GDPR__
                "issue.copyGithubPermalink" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.copyGithubPermalink');
                    // TODO: implement copy permalink
                    // return this.copyPermalink();
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.openGithubPermalink',
                () => {
                    /* __GDPR__
                "issue.openGithubPermalink" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.openGithubPermalink');
                    // TODO: implement open permalink
                    // return this.openPermalink();
                },
                this,
            ),
        );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand('issue.openIssue', (issueModel: any) => {
        //         /* __GDPR__
        // 		"issue.openIssue" : {}
        // 	*/
        //         this.telemetry.sendTelemetryEvent('issue.openIssue');
        //         return this.openIssue(issueModel);
        //     }),
        // );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.startWorking',
                (issue: any) => {
                    /* __GDPR__
                "issue.startWorking" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.startWorking');
                    // TODO: implement start working to task
                    console.log('TODO');
                    // return this.startWorking(issue);
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.continueWorking',
                (issue: any) => {
                    /* __GDPR__
                "issue.continueWorking" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.continueWorking');
                    // TODO: implement continue working to task
                    console.log('TODO');
                    // return this.startWorking(issue);
                },
                this,
            ),
        );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.startWorkingBranchPrompt',
        //         (issueModel: any) => {
        //             /* __GDPR__
        // 		"issue.startWorkingBranchPrompt" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.startWorkingBranchPrompt');
        //             return this.startWorkingBranchPrompt(issueModel);
        //         },
        //         this,
        //     ),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.stopWorking',
        //         (issueModel: any) => {
        //             /* __GDPR__
        // 		"issue.stopWorking" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.stopWorking');
        //             return this.stopWorking(issueModel);
        //         },
        //         this,
        //     ),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.statusBar',
        //         () => {
        //             /* __GDPR__
        // 		"issue.statusBar" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.statusBar');
        //             return this.statusBar();
        //         },
        //         this,
        //     ),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand('issue.copyIssueNumber', (issueModel: any) => {
        //         /* __GDPR__
        // 		"issue.copyIssueNumber" : {}
        // 	*/
        //         this.telemetry.sendTelemetryEvent('issue.copyIssueNumber');
        //         return this.copyIssueNumber(issueModel);
        //     }),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand('issue.copyIssueUrl', (issueModel: any) => {
        //         /* __GDPR__
        // 		"issue.copyIssueUrl" : {}
        // 	*/
        //         this.telemetry.sendTelemetryEvent('issue.copyIssueUrl');
        //         return this.copyIssueUrl(issueModel);
        //     }),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.refresh',
        //         () => {
        //             /* __GDPR__
        // 		"issue.refresh" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.refresh');
        //             return this.refreshView();
        //         },
        //         this,
        //     ),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.suggestRefresh',
        //         () => {
        //             /* __GDPR__
        // 		"issue.suggestRefresh" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.suggestRefresh');
        //             return this.suggestRefresh();
        //         },
        //         this,
        //     ),
        // );
        // this.context.subscriptions.push(
        //     vscode.commands.registerCommand(
        //         'issue.getCurrent',
        //         () => {
        //             /* __GDPR__
        // 		"issue.getCurrent" : {}
        // 	*/
        //             this.telemetry.sendTelemetryEvent('issue.getCurrent');
        //             return this.getCurrent();
        //         },
        //         this,
        //     ),
        // );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.createIssue',
                (group: GroupTreeItem) => {
                    /* __GDPR__
                    "issue.createIssue" : {}
                    */
                    // TODO: do something with the passed group and group.parent (board)
                    this.telemetry.sendTelemetryEvent('issue.createIssue');
                    return this.createIssue(group.parent.board.id, group.group.id);
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'issue.createItemFromFile',
                () => {
                    /* __GDPR__
                "issue.createItemFromFile" : {}
            */
                    this.telemetry.sendTelemetryEvent('issue.createItemFromFile');
                    return this.createItemFromFile();
                },
                this,
            ),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand('issue.issueCompletion', () => {
                /* __GDPR__
                "issue.issueCompletion" : {}
            */
                this.telemetry.sendTelemetryEvent('issue.issueCompletion');
            }),
        );
        this.context.subscriptions.push(
            vscode.commands.registerCommand('issue.userCompletion', () => {
                /* __GDPR__
                "issue.userCompletion" : {}
            */
                this.telemetry.sendTelemetryEvent('issue.userCompletion');
            }),
        );
        return this._stateManager.tryInitializeAndWait().then(() => {
            this.context.subscriptions.push(
                vscode.languages.registerHoverProvider(
                    '*',
                    new IssueHoverProvider(this._stateManager, this.context, this.telemetry),
                ),
            );
            this.context.subscriptions.push(
                vscode.languages.registerHoverProvider(
                    '*',
                    new UserHoverProvider(this._stateManager, this.usersManager, this.telemetry),
                ),
            );
            this.context.subscriptions.push(
                vscode.languages.registerCodeActionsProvider('*', new IssueTodoProvider(this.context)),
            );
        });
    }

    dispose(): void {
        // TODO: implement disposal of all resources
    }

    private documentFilters: Array<vscode.DocumentFilter | string> = [
        { language: 'php' },
        { language: 'powershell' },
        { language: 'jade' },
        { language: 'python' },
        { language: 'r' },
        { language: 'razor' },
        { language: 'ruby' },
        { language: 'rust' },
        { language: 'scss' },
        { language: 'search-result' },
        { language: 'shaderlab' },
        { language: 'shellscript' },
        { language: 'sql' },
        { language: 'swift' },
        { language: 'typescript' },
        { language: 'vb' },
        { language: 'xml' },
        { language: 'yaml' },
        { language: 'markdown' },
        { language: 'bat' },
        { language: 'clojure' },
        { language: 'coffeescript' },
        { language: 'jsonc' },
        { language: 'c' },
        { language: 'cpp' },
        { language: 'csharp' },
        { language: 'css' },
        { language: 'dockerfile' },
        { language: 'fsharp' },
        { language: 'git-commit' },
        { language: 'go' },
        { language: 'groovy' },
        { language: 'handlebars' },
        { language: 'hlsl' },
        { language: 'ini' },
        { language: 'java' },
        { language: 'javascriptreact' },
        { language: 'javascript' },
        { language: 'json' },
        { language: 'less' },
        { language: 'log' },
        { language: 'lua' },
        { language: 'makefile' },
        { language: 'ignore' },
        { language: 'properties' },
        { language: 'objective-c' },
        { language: 'perl' },
        { language: 'perl6' },
        '*',
    ];
    private registerCompletionProviders() {
        const providers: {
            provider: typeof IssueCompletionProvider | typeof UserCompletionProvider;
            trigger: string;
            disposable: vscode.Disposable | undefined;
            configuration: string;
        }[] = [
                {
                    provider: IssueCompletionProvider,
                    trigger: '#',
                    disposable: undefined,
                    configuration: ISSUE_COMPLETIONS_CONFIGURATION,
                },
                {
                    provider: UserCompletionProvider,
                    trigger: '@',
                    disposable: undefined,
                    configuration: USER_COMPLETIONS_CONFIGURATION,
                },
            ];
        for (const element of providers) {
            if (vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get(element.configuration, true)) {
                this.context.subscriptions.push(
                    (element.disposable = vscode.languages.registerCompletionItemProvider(
                        this.documentFilters,
                        new element.provider(this._stateManager, this.context),
                        element.trigger,
                    )),
                );
            }
        }
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((change) => {
                for (const element of providers) {
                    if (change.affectsConfiguration(`${ISSUES_CONFIGURATION}.${element.configuration}`)) {
                        const newValue: boolean = vscode.workspace
                            .getConfiguration(ISSUES_CONFIGURATION)
                            .get(element.configuration, true);
                        if (!newValue && element.disposable) {
                            element.disposable.dispose();
                            element.disposable = undefined;
                        } else if (newValue && !element.disposable) {
                            this.context.subscriptions.push(
                                (element.disposable = vscode.languages.registerCompletionItemProvider(
                                    this.documentFilters,
                                    new element.provider(this._stateManager, this.context),
                                    element.trigger,
                                )),
                            );
                        }
                        break;
                    }
                }
            }),
        );
    }

    async createIssue(boardId?: string, groupId?: string): Promise<void> {
        return this.makeNewItemFile(boardId, groupId);
    }

    async createItemFromFile(): Promise<void> {
        let text: string;
        if (
            !vscode.window.activeTextEditor ||
            vscode.window.activeTextEditor.document.uri.scheme !== NEW_ISSUE_SCHEME
        ) {
            return;
        }

        text = vscode.window.activeTextEditor.document.getText();
        const indexOfEmptyLineWindows = text.indexOf('\r\n\r\n');
        const indexOfEmptyLineOther = text.indexOf('\n\n');
        let indexOfEmptyLine: number;
        if (indexOfEmptyLineWindows < 0 && indexOfEmptyLineOther < 0) {
            return;
        } else {
            if (indexOfEmptyLineWindows < 0) {
                indexOfEmptyLine = indexOfEmptyLineOther;
            } else if (indexOfEmptyLineOther < 0) {
                indexOfEmptyLine = indexOfEmptyLineWindows;
            } else {
                indexOfEmptyLine = Math.min(indexOfEmptyLineWindows, indexOfEmptyLineOther);
            }
        }
        const title = text.substring(0, indexOfEmptyLine);

        const subscribers: string[] = [];
        text = text.substring(indexOfEmptyLine + 2).trim();
        if (text.startsWith(SUBSCRIBERS)) {
            const lines = text.split(/\r\n|\n/, 1);
            if (lines.length === 1) {
                lines[0]
                    .substring(SUBSCRIBERS.length)
                    .split(';')
                    .forEach((value) => {
                        value = value.trim();
                        if (value.startsWith('@')) {
                            value = value.substring(1).trim();
                            subscribers.push(value);
                        }
                    });
                text = text.substring(lines[0].length).trim();
            }
        }

        const tags: string[] = [];
        if (text.startsWith(TAGS)) {
            const lines = text.split(/\r\n|\n/, 1);
            if (lines.length === 1) {
                lines[0]
                    .substring(TAGS.length)
                    .split(',')
                    .forEach((value) => {
                        value = value.trim();
                        if (value) {
                            tags.push(value);
                        }
                    });
                text = text.substring(lines[0].length).trim();
            }
        }

        let boardId = (await this.boardsManager.getDefaultBoard())?.id;
        if (text.startsWith(BOARD)) {
            const lines = text.split(/\r\n|\n/, 1);
            if (lines.length === 1) {
                boardId = lines[0].substring(BOARD.length).trim();
                text = text.substring(lines[0].length).trim();
            }
        }

        let groupId: string | undefined;
        if (text.startsWith(GROUP)) {
            const lines = text.split(/\r\n|\n/, 1);
            if (lines.length === 1) {
                groupId = lines[0].substring(GROUP.length).trim();
                text = text.substring(lines[0].length).trim();
            }
        }

        const body = text;
        if (!title || !body) {
            return;
        }

        const createSucceeded = await this.doCreateIssue(
            this.createIssueInfo?.document,
            this.createIssueInfo?.newIssue,
            title,
            body,
            subscribers,
            tags,
            this.createIssueInfo?.lineNumber,
            this.createIssueInfo?.insertIndex,
            boardId,
            groupId,
        );

        this.createIssueInfo = undefined;
        if (createSucceeded) {
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
    }

    // getCurrent() {
    //     if (this._stateManager.currentIssue) {
    //         return {
    //             owner: this._stateManager.currentIssue.issue.remote.owner,
    //             repo: this._stateManager.currentIssue.issue.remote.repositoryName,
    //             number: this._stateManager.currentIssue.issue.number,
    //         };
    //     }
    // }

    // refreshView() {
    //     this._stateManager.refreshCacheNeeded();
    // }

    // async suggestRefresh() {
    //     await vscode.commands.executeCommand('hideSuggestWidget');
    //     await this._stateManager.refresh();
    //     return vscode.commands.executeCommand('editor.action.triggerSuggest');
    // }

    // openIssue(issueModel: any) {
    //     if (issueModel instanceof IssueModel) {
    //         return vscode.env.openExternal(vscode.Uri.parse(issueModel.html_url));
    //     }
    // }

    // async startWorkingBranchPrompt(issueModel: any) {
    //     if (issueModel instanceof IssueModel) {
    //         await this._stateManager.setCurrentIssue(new CurrentIssue(issueModel, this._stateManager, true));
    //     }
    // }

    // async stopWorking(issueModel: any) {
    //     if (issueModel instanceof IssueModel && this._stateManager.currentIssue?.issue.number === issueModel.number) {
    //         await this._stateManager.setCurrentIssue(undefined);
    //     }
    // }

    // async statusBar() {
    //     if (this._stateManager.currentIssue) {
    //         const openIssueText = `$(globe) Open #${this._stateManager.currentIssue.issue.number} ${this._stateManager.currentIssue.issue.title}`;
    //         const pullRequestText = `$(git-pull-request) Create pull request for #${this._stateManager.currentIssue.issue.number} (pushes branch)`;
    //         const draftPullRequestText = `$(comment-discussion) Create draft pull request for #${this._stateManager.currentIssue.issue.number} (pushes branch)`;
    //         const stopWorkingText = `$(primitive-square) Stop working on #${this._stateManager.currentIssue.issue.number}`;
    //         const choices = [openIssueText, pullRequestText, draftPullRequestText, stopWorkingText];
    //         const response: string | undefined = await vscode.window.showQuickPick(choices, {
    //             placeHolder: 'Current issue options',
    //         });
    //         switch (response) {
    //             case openIssueText:
    //                 return this.openIssue(this._stateManager.currentIssue.issue);
    //             case stopWorkingText:
    //                 return this._stateManager.setCurrentIssue(undefined);
    //         }
    //     }
    // }

    private stringToUint8Array(input: string): Uint8Array {
        const encoder = new TextEncoder();
        return encoder.encode(input);
    }

    // copyIssueNumber(issueModel: any) {
    //     if (issueModel instanceof IssueModel) {
    //         return vscode.env.clipboard.writeText(issueModel.number.toString());
    //     }
    // }

    // copyIssueUrl(issueModel: any) {
    //     if (issueModel instanceof IssueModel) {
    //         return vscode.env.clipboard.writeText(issueModel.html_url);
    //     }
    // }

    async createTodoIssueClipboard(): Promise<undefined> {
        return this.createTodoIssue(undefined, await vscode.env.clipboard.readText());
    }

    async createTodoIssue(newIssue?: NewIssue, issueBody?: string): Promise<undefined> {
        let document: vscode.TextDocument;
        let titlePlaceholder: string | undefined;
        let insertIndex: number | undefined;
        let lineNumber: number | undefined;
        let subscribers: string[] = [];
        let issueGenerationText: string | undefined;
        if (!newIssue && vscode.window.activeTextEditor) {
            document = vscode.window.activeTextEditor.document;
            issueGenerationText = document.getText(vscode.window.activeTextEditor.selection);
        } else if (newIssue) {
            document = newIssue.document;
            insertIndex = newIssue.insertIndex;
            lineNumber = newIssue.lineNumber;
            titlePlaceholder = newIssue.line.substring(insertIndex, newIssue.line.length).replace(USER_EXPRESSION, '').replace(/;/g, '').trim();
            issueGenerationText = document.getText(
                newIssue.range.isEmpty ? document.lineAt(newIssue.range.start.line).range : newIssue.range,
            );
        } else {
            return undefined;
        }

        await [...issueGenerationText.matchAll(USER_EXPRESSION)].forEach(async matches => {
            if (matches && matches.length === 2 && (await this._stateManager.userMap).has(matches[1])) {
                subscribers.push(matches[1]);
            }
        });


        let tags: string[] | undefined;
        if (issueGenerationText.startsWith(TAGS)) {
            const lines = issueGenerationText.split(/\r\n|\n/, 1);
            if (lines.length === 1) {
                tags = lines[0]
                    .substring(TAGS.length)
                    .split(',')
                    .map((value) => value.trim());
            }
        }

        let title: string | undefined;
        const body: string | undefined = issueBody || '';

        const quickInput = vscode.window.createInputBox();
        quickInput.value = titlePlaceholder ?? '';
        quickInput.prompt =
            'Set the item title. Confirm to create the item now or use the edit button to edit the issue title and description.';
        quickInput.title = 'Create Item';
        quickInput.buttons = [
            {
                iconPath: {
                    light: Resource.icons.light.Edit,
                    dark: Resource.icons.dark.Edit,
                },
                tooltip: 'Edit Description',
            },
        ];
        quickInput.onDidAccept(async () => {
            title = quickInput.value;
            if (title) {
                quickInput.busy = true;
                await this.doCreateIssue(
                    document,
                    newIssue,
                    title,
                    undefined,
                    subscribers,
                    tags,
                    lineNumber,
                    insertIndex,
                );
                quickInput.busy = false;
            }
            quickInput.hide();
        });

        quickInput.onDidTriggerButton(async () => {
            title = quickInput.value;
            quickInput.busy = true;
            this.createIssueInfo = { document, newIssue, lineNumber, insertIndex };

            this.makeNewItemFile(undefined, undefined, title, body, subscribers);
            quickInput.busy = false;
            quickInput.hide();
        });
        quickInput.show();
    }

    private async doCreateIssue(
        document: vscode.TextDocument | undefined,
        newIssue: NewIssue | undefined,
        title: string,
        body: string | undefined,
        subscribers: string[] | undefined,
        tags: string[] | undefined,
        lineNumber: number | undefined,
        insertIndex: number | undefined,
        boardId?: string,
        groupId?: string,
    ): Promise<boolean> {
        // TODO: if new issue, create it. otherwise update it.
        // create issue
        const issue = await this.itemsManager.createItem(title, boardId, groupId);

        if (issue) {
            if (body) {
                await this.itemsManager.updateBody(issue.id, body, boardId);
            }

            if (subscribers) {
                await this.itemsManager.updateSubscribers(issue.id, subscribers, boardId);
            }

            // if (tags) {
            //     await this.itemsManager.updateTags(issue.id, tags, boardId);
            // }

            const html_url = createItemUrl(issue, this.usersManager.currentUser);
            if (document !== undefined && insertIndex !== undefined && lineNumber !== undefined) {
                const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                const issueReference: string =
                    vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get('createInsertFormat', 'number') ===
                        'number'
                        ? `#${issue.id}`
                        : html_url;
                edit.replace(document.uri, new vscode.Range(new vscode.Position(lineNumber, insertIndex), document.lineAt(lineNumber).range.end), ` ${issueReference} ${title} ${subscribers?.map(s => `@${s};`)?.join('')}`);
                await vscode.workspace.applyEdit(edit);
            } else {
                const copyIssueUrl = 'Copy URL';
                const openIssue = 'Open Item';
                vscode.window.showInformationMessage('Item created', copyIssueUrl, openIssue).then(async (result) => {
                    switch (result) {
                        case copyIssueUrl:
                            await vscode.env.clipboard.writeText(html_url);
                            break;
                        case openIssue:
                            await vscode.env.openExternal(vscode.Uri.parse(html_url));
                            break;
                    }
                });
            }
            // this._stateManager.refreshCacheNeeded();
            return true;
        }

        return false;
    }

    private async makeNewItemFile(
        boardId?: string,
        groupId?: string,
        title?: string,
        body?: string,
        subscribers?: string[] | undefined,
    ) {
        const bodyPath = vscode.Uri.parse(`${NEW_ISSUE_SCHEME}:/${NEW_ISSUE_FILE}`);
        if (
            vscode.window.visibleTextEditors.filter(
                (visibleEditor) => visibleEditor.document.uri.scheme === NEW_ISSUE_SCHEME,
            ).length > 0
        ) {
            return;
        }
        await vscode.workspace.fs.delete(bodyPath);
        const subscribersLine = `${SUBSCRIBERS} ${
            subscribers && subscribers.length > 0 ? subscribers.map((value) => `@${value};`).join('') + ' ' : ''
            }`;
        const labelLine = `${TAGS} `;
        const boardLine = `${BOARD} ${boardId ?? (await this.boardsManager.getDefaultBoard())?.id}`;
        const groupLine = `${GROUP} ${groupId ?? ''}`;
        // TODO: parse the title and remove subscribers and tags from it
        const text = `${title ?? 'Item Title'}\n
${subscribersLine}\n
${labelLine}\n
${boardLine}\n
${groupLine}\n
${body ?? ''}\n
Item description`;
        await vscode.workspace.fs.writeFile(bodyPath, this.stringToUint8Array(text));
        const boardDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ' Board id to associate the item to, if left blank the default board will be used.',
                fontStyle: 'italic',
                color: new vscode.ThemeColor('items.newItemDecoration'),
            },
        });
        const groupDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText:
                    ' Group id to associate the item to, if left blank the item will be assigned to the first group.',
                fontStyle: 'italic',
                color: new vscode.ThemeColor('items.newItemDecoration'),
            },
        });
        const subscribersDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ' Semi-colon-separated usernames, use @ for autocompletion.',
                fontStyle: 'italic',
                color: new vscode.ThemeColor('items.newItemDecoration'),
            },
        });
        const tagsDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: ' Comma-separated tags.',
                fontStyle: 'italic',
                color: new vscode.ThemeColor('items.newItemDecoration'),
            },
        });
        const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((textEditor) => {
            if (textEditor?.document.uri.scheme === NEW_ISSUE_SCHEME) {
                let boardFullLine, groupFullLine, subscribersFullLine, tagsFullLine;
                for (let index = 0; index < textEditor.document.lineCount; index++) {
                    const line = textEditor.document.lineAt(index);
                    if (line.text.startsWith(BOARD)) {
                        boardFullLine = line;
                    }
                    if (line.text.startsWith(GROUP)) {
                        groupFullLine = line;
                    }
                    if (line.text.startsWith(SUBSCRIBERS)) {
                        subscribersFullLine = line;
                    }
                    if (line.text.startsWith(TAGS)) {
                        tagsFullLine = line;
                    }
                }

                if (boardFullLine) {
                    textEditor.setDecorations(boardDecoration, [
                        new vscode.Range(
                            new vscode.Position(boardFullLine.lineNumber, 0),
                            new vscode.Position(boardFullLine.lineNumber, boardFullLine.text.length),
                        ),
                    ]);
                }

                if (groupFullLine) {
                    textEditor.setDecorations(groupDecoration, [
                        new vscode.Range(
                            new vscode.Position(groupFullLine.lineNumber, 0),
                            new vscode.Position(groupFullLine.lineNumber, groupFullLine.text.length),
                        ),
                    ]);
                }

                if (subscribersFullLine) {
                    textEditor.setDecorations(subscribersDecoration, [
                        new vscode.Range(
                            new vscode.Position(subscribersFullLine.lineNumber, 0),
                            new vscode.Position(subscribersFullLine.lineNumber, subscribersFullLine.text.length),
                        ),
                    ]);
                }

                if (tagsFullLine) {
                    textEditor.setDecorations(tagsDecoration, [
                        new vscode.Range(
                            new vscode.Position(tagsFullLine.lineNumber, 0),
                            new vscode.Position(tagsFullLine.lineNumber, tagsFullLine.text.length),
                        ),
                    ]);
                }
            }
        });

        const editor = await vscode.window.showTextDocument(bodyPath);

        const saveDisposable = vscode.workspace.onDidSaveTextDocument(async (textDocument) => {
            if (textDocument === editor.document) {
                await this.createItemFromFile();
                saveDisposable.dispose();
            }
        });

        const closeDisposable = vscode.workspace.onDidCloseTextDocument((textDocument) => {
            if (textDocument === editor.document) {
                editorChangeDisposable.dispose();
                closeDisposable.dispose();
            }
        });
    }
}
