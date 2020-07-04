/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PullRequestManager, PullRequestDefaults } from '../github/pullRequestManager';
import * as vscode from 'vscode';
import { IssueHoverProvider } from './issueHoverProvider';
import { UserHoverProvider } from './userHoverProvider';
import { IssueTodoProvider } from './issueTodoProvider';
import { IssueCompletionProvider } from './issueCompletionProvider';
import { NewIssue, createGithubPermalink, USER_EXPRESSION, ISSUES_CONFIGURATION, QUERIES_CONFIGURATION, pushAndCreatePR } from './util';
import { UserCompletionProvider } from './userCompletionProvider';
import { StateManager } from './stateManager';
import { IssuesTreeData } from './issuesView';
import { IssueModel } from '../github/issueModel';
import { CurrentIssue } from './currentIssue';
import { ReviewManager } from '../view/reviewManager';
import { GitAPI } from '../typings/git';
import { Resource } from '../common/resources';
import { IssueFileSystemProvider, NEW_ISSUE_SCHEME, ASSIGNEES, LABELS, LabelCompletionProvider, NEW_ISSUE_FILE } from './issueFile';
import { ITelemetry } from '../common/telemetry';
import { Octokit } from '@octokit/rest';

const ISSUE_COMPLETIONS_CONFIGURATION = 'issueCompletions.enabled';
const USER_COMPLETIONS_CONFIGURATION = 'userCompletions.enabled';

export class IssueFeatureRegistrar implements vscode.Disposable {
	private _stateManager: StateManager;
	private createIssueInfo: { document: vscode.TextDocument, newIssue: NewIssue | undefined, lineNumber: number | undefined, insertIndex: number | undefined } | undefined;

	constructor(private gitAPI: GitAPI, private manager: PullRequestManager, private reviewManager: ReviewManager, private context: vscode.ExtensionContext, private telemetry: ITelemetry) {
		this._stateManager = new StateManager(gitAPI, this.manager, this.context);
	}

	async initialize() {
		this.context.subscriptions.push(vscode.workspace.registerFileSystemProvider(NEW_ISSUE_SCHEME, new IssueFileSystemProvider()));
		this.registerCompletionProviders();
		this.context.subscriptions.push(vscode.languages.registerCompletionItemProvider({ scheme: NEW_ISSUE_SCHEME }, new LabelCompletionProvider(this.manager), ' ', ','));
		this.context.subscriptions.push(vscode.window.createTreeView('issues:github', { showCollapseAll: true, treeDataProvider: new IssuesTreeData(this._stateManager, this.manager, this.context) }));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.createIssueFromSelection', (newIssue?: NewIssue, issueBody?: string) => {
			/* __GDPR__
				"issue.createIssueFromSelection" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.createIssueFromSelection');
			return this.createTodoIssue(newIssue, issueBody);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.createIssueFromClipboard', () => {
			/* __GDPR__
				"issue.createIssueFromClipboard" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.createIssueFromClipboard');
			return this.createTodoIssueClipboard();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.copyGithubPermalink', () => {
			/* __GDPR__
				"issue.copyGithubPermalink" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.copyGithubPermalink');
			return this.copyPermalink();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.openGithubPermalink', () => {
			/* __GDPR__
				"issue.openGithubPermalink" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.openGithubPermalink');
			return this.openPermalink();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.openIssue', (issueModel: any) => {
			/* __GDPR__
				"issue.openIssue" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.openIssue');
			return this.openIssue(issueModel);
		}));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.startWorking', (issue: any) => {
			/* __GDPR__
				"issue.startWorking" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.startWorking');
			return this.startWorking(issue);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.continueWorking', (issue: any) => {
			/* __GDPR__
				"issue.continueWorking" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.continueWorking');
			return this.startWorking(issue);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.startWorkingBranchPrompt', (issueModel: any) => {
			/* __GDPR__
				"issue.startWorkingBranchPrompt" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.startWorkingBranchPrompt');
			return this.startWorkingBranchPrompt(issueModel);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.stopWorking', (issueModel: any) => {
			/* __GDPR__
				"issue.stopWorking" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.stopWorking');
			return this.stopWorking(issueModel);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.statusBar', () => {
			/* __GDPR__
				"issue.statusBar" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.statusBar');
			return this.statusBar();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.copyIssueNumber', (issueModel: any) => {
			/* __GDPR__
				"issue.copyIssueNumber" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.copyIssueNumber');
			return this.copyIssueNumber(issueModel);
		}));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.copyIssueUrl', (issueModel: any) => {
			/* __GDPR__
				"issue.copyIssueUrl" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.copyIssueUrl');
			return this.copyIssueUrl(issueModel);
		}));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.refresh', () => {
			/* __GDPR__
				"issue.refresh" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.refresh');
			return this.refreshView();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.suggestRefresh', () => {
			/* __GDPR__
				"issue.suggestRefresh" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.suggestRefresh');
			return this.suggestRefresh();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.getCurrent', () => {
			/* __GDPR__
				"issue.getCurrent" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.getCurrent');
			return this.getCurrent();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.editQuery', (query: vscode.TreeItem) => {
			/* __GDPR__
				"issue.editQuery" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.editQuery');
			return this.editQuery(query);
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.createIssue', () => {
			/* __GDPR__
				"issue.createIssue" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.createIssue');
			return this.createIssue();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.createIssueFromFile', () => {
			/* __GDPR__
				"issue.createIssueFromFile" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.createIssueFromFile');
			return this.createIssueFromFile();
		}, this));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.issueCompletion', () => {
			/* __GDPR__
				"issue.issueCompletion" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.issueCompletion');
		}));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.userCompletion', () => {
			/* __GDPR__
				"issue.userCompletion" : {}
			*/
			this.telemetry.sendTelemetryEvent('issue.userCompletion');
		}));
		this.context.subscriptions.push(vscode.commands.registerCommand('issue.signinAndRefreshList', async () => {
			return this.manager.authenticate();
		}));
		return this._stateManager.tryInitializeAndWait().then(() => {
			this.context.subscriptions.push(vscode.languages.registerHoverProvider('*', new IssueHoverProvider(this.manager, this._stateManager, this.context, this.telemetry)));
			this.context.subscriptions.push(vscode.languages.registerHoverProvider('*', new UserHoverProvider(this.manager, this.telemetry)));
			this.context.subscriptions.push(vscode.languages.registerCodeActionsProvider('*', new IssueTodoProvider(this.context)));
		});
	}

	dispose() { }

	private documentFilters: Array<vscode.DocumentFilter | string> = [
		{ language: 'php' }, { language: 'powershell' }, { language: 'jade' }, { language: 'python' }, { language: 'r' }, { language: 'razor' },
		{ language: 'ruby' }, { language: 'rust' }, { language: 'scss' }, { language: 'search-result' }, { language: 'shaderlab' },
		{ language: 'shellscript' }, { language: 'sql' }, { language: 'swift' }, { language: 'typescript' }, { language: 'vb' },
		{ language: 'xml' }, { language: 'yaml' }, { language: 'markdown' }, { language: 'bat' }, { language: 'clojure' },
		{ language: 'coffeescript' }, { language: 'jsonc' }, { language: 'c' }, { language: 'cpp' }, { language: 'csharp' },
		{ language: 'css' }, { language: 'dockerfile' }, { language: 'fsharp' }, { language: 'git-commit' }, { language: 'go' },
		{ language: 'groovy' }, { language: 'handlebars' }, { language: 'hlsl' }, { language: 'ini' }, { language: 'java' },
		{ language: 'javascriptreact' }, { language: 'javascript' }, { language: 'json' }, { language: 'less' }, { language: 'log' },
		{ language: 'lua' }, { language: 'makefile' }, { language: 'ignore' }, { language: 'properties' }, { language: 'objective-c' },
		{ language: 'perl' }, { language: 'perl6' }, '*'
	];
	private registerCompletionProviders() {
		const providers: { provider: (typeof IssueCompletionProvider) | (typeof UserCompletionProvider), trigger: string, disposable: vscode.Disposable | undefined, configuration: string }[] = [
			{
				provider: IssueCompletionProvider,
				trigger: '#',
				disposable: undefined,
				configuration: ISSUE_COMPLETIONS_CONFIGURATION
			},
			{
				provider: UserCompletionProvider,
				trigger: '@',
				disposable: undefined,
				configuration: USER_COMPLETIONS_CONFIGURATION
			}
		];
		for (const element of providers) {
			if (vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get(element.configuration, true)) {
				this.context.subscriptions.push(element.disposable = vscode.languages.registerCompletionItemProvider(this.documentFilters, new element.provider(this._stateManager, this.manager, this.context), element.trigger));
			}
		}
		this.context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(change => {
			for (const element of providers) {
				if (change.affectsConfiguration(`${ISSUES_CONFIGURATION}.${element.configuration}`)) {
					const newValue: boolean = vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get(element.configuration, true);
					if (!newValue && element.disposable) {
						element.disposable.dispose();
						element.disposable = undefined;
					} else if (newValue && !element.disposable) {
						this.context.subscriptions.push(element.disposable = vscode.languages.registerCompletionItemProvider(this.documentFilters, new element.provider(this._stateManager, this.manager, this.context), element.trigger));
					}
					break;
				}
			}
		}));
	}

	async createIssue() {
		return this.makeNewIssueFile();
	}

	async createIssueFromFile() {
		let text: string;
		if (!vscode.window.activeTextEditor || (vscode.window.activeTextEditor.document.uri.scheme !== NEW_ISSUE_SCHEME)) {
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
		let assignees: string[] | undefined;
		text = text.substring(indexOfEmptyLine + 2).trim();
		if (text.startsWith(ASSIGNEES)) {
			const lines = text.split(/\r\n|\n/, 1);
			if (lines.length === 1) {
				assignees = lines[0].substring(ASSIGNEES.length).split(',').map(value => {
					value = value.trim();
					if (value.startsWith('@')) {
						value = value.substring(1);
					}
					return value;
				});
				text = text.substring(lines[0].length).trim();
			}
		}
		let labels: string[] | undefined;
		if (text.startsWith(LABELS)) {
			const lines = text.split(/\r\n|\n/, 1);
			if (lines.length === 1) {
				labels = lines[0].substring(LABELS.length).split(',').map(value => value.trim());
				text = text.substring(lines[0].length).trim();
			}
		}
		const body = text;
		if (!title || !body) {
			return;
		}
		const createSucceeded = await this.doCreateIssue(this.createIssueInfo?.document, this.createIssueInfo?.newIssue, title, body, assignees, labels, this.createIssueInfo?.lineNumber, this.createIssueInfo?.insertIndex);
		this.createIssueInfo = undefined;
		if (createSucceeded) {
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
		}
	}

	async editQuery(query: vscode.TreeItem) {
		const config = vscode.workspace.getConfiguration(ISSUES_CONFIGURATION);
		const inspect = config.inspect<{ label: string, query: string }[]>(QUERIES_CONFIGURATION);
		let command: string;
		if (inspect?.workspaceValue) {
			command = 'workbench.action.openWorkspaceSettingsFile';
		} else {
			const value = config.get<{ label: string, query: string }[]>(QUERIES_CONFIGURATION);
			if (inspect?.defaultValue && JSON.stringify(inspect?.defaultValue) === JSON.stringify(value)) {
				config.update(QUERIES_CONFIGURATION, inspect.defaultValue, vscode.ConfigurationTarget.Global);
			}
			command = 'workbench.action.openSettingsJson';
		}
		await vscode.commands.executeCommand(command);
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const text = editor.document.getText();
			const search = text.search(query.label!);
			if (search >= 0) {
				const position = editor.document.positionAt(search);
				editor.revealRange(new vscode.Range(position, position));
				editor.selection = new vscode.Selection(position, position);
			}
		}
	}

	getCurrent() {
		if (this._stateManager.currentIssue) {
			return { owner: this._stateManager.currentIssue.issue.remote.owner, repo: this._stateManager.currentIssue.issue.remote.repositoryName, number: this._stateManager.currentIssue.issue.number };
		}
	}

	refreshView() {
		this._stateManager.refreshCacheNeeded();
	}

	async suggestRefresh() {
		await vscode.commands.executeCommand('hideSuggestWidget');
		await this._stateManager.refresh();
		return vscode.commands.executeCommand('editor.action.triggerSuggest');
	}

	openIssue(issueModel: any) {
		if (issueModel instanceof IssueModel) {
			return vscode.env.openExternal(vscode.Uri.parse(issueModel.html_url));
		}
	}

	async startWorking(issue: any) {
		let issueModel: IssueModel | undefined;

		if (issue instanceof IssueModel) {
			issueModel = issue;
		} else if (issue && issue.repo && issue.owner && issue.number) {
			issueModel = await this.manager.resolveIssue(issue.owner, issue.repo, issue.number);
		}

		if (issueModel) {
			await this._stateManager.setCurrentIssue(new CurrentIssue(issueModel, this.manager, this._stateManager));
		}
	}

	async startWorkingBranchPrompt(issueModel: any) {
		if (issueModel instanceof IssueModel) {
			await this._stateManager.setCurrentIssue(new CurrentIssue(issueModel, this.manager, this._stateManager, true));
		}
	}

	async stopWorking(issueModel: any) {
		if ((issueModel instanceof IssueModel) && (this._stateManager.currentIssue?.issue.number === issueModel.number)) {
			await this._stateManager.setCurrentIssue(undefined);
		}
	}

	async statusBar() {
		if (this._stateManager.currentIssue) {
			const openIssueText: string = `$(globe) Open #${this._stateManager.currentIssue.issue.number} ${this._stateManager.currentIssue.issue.title}`;
			const pullRequestText: string = `$(git-pull-request) Create pull request for #${this._stateManager.currentIssue.issue.number} (pushes branch)`;
			const draftPullRequestText: string = `$(comment-discussion) Create draft pull request for #${this._stateManager.currentIssue.issue.number} (pushes branch)`;
			let defaults: PullRequestDefaults | undefined;
			try {
				defaults = await this.manager.getPullRequestDefaults();
			} catch (e) {
				// leave defaults undefined
			}
			const stopWorkingText: string = `$(primitive-square) Stop working on #${this._stateManager.currentIssue.issue.number}`;
			const choices = this._stateManager.currentIssue.branchName && defaults ? [openIssueText, pullRequestText, draftPullRequestText, stopWorkingText] : [openIssueText, pullRequestText, draftPullRequestText, stopWorkingText];
			const response: string | undefined = await vscode.window.showQuickPick(choices, { placeHolder: 'Current issue options' });
			switch (response) {
				case openIssueText: return this.openIssue(this._stateManager.currentIssue.issue);
				case pullRequestText: return pushAndCreatePR(this.manager, this.reviewManager, this._stateManager);
				case draftPullRequestText: return pushAndCreatePR(this.manager, this.reviewManager, this._stateManager, true);
				case stopWorkingText: return this._stateManager.setCurrentIssue(undefined);
			}
		}
	}

	private stringToUint8Array(input: string): Uint8Array {
		const encoder = new TextEncoder();
		return encoder.encode(input);
	}

	copyIssueNumber(issueModel: any) {
		if (issueModel instanceof IssueModel) {
			return vscode.env.clipboard.writeText(issueModel.number.toString());
		}
	}

	copyIssueUrl(issueModel: any) {
		if (issueModel instanceof IssueModel) {
			return vscode.env.clipboard.writeText(issueModel.html_url);
		}
	}

	async createTodoIssueClipboard() {
		return this.createTodoIssue(undefined, await vscode.env.clipboard.readText());
	}

	async createTodoIssue(newIssue?: NewIssue, issueBody?: string) {
		let document: vscode.TextDocument;
		let titlePlaceholder: string | undefined;
		let insertIndex: number | undefined;
		let lineNumber: number | undefined;
		let assignee: string[] | undefined;
		let issueGenerationText: string | undefined;
		if (!newIssue && vscode.window.activeTextEditor) {
			document = vscode.window.activeTextEditor.document;
			issueGenerationText = document.getText(vscode.window.activeTextEditor.selection);
		} else if (newIssue) {
			document = newIssue.document;
			insertIndex = newIssue.insertIndex;
			lineNumber = newIssue.lineNumber;
			titlePlaceholder = newIssue.line.substring(insertIndex, newIssue.line.length).trim();
			issueGenerationText = document.getText(newIssue.range.isEmpty ? document.lineAt(newIssue.range.start.line).range : newIssue.range);
		} else {
			return undefined;
		}
		const matches = issueGenerationText.match(USER_EXPRESSION);
		if (matches && matches.length === 2 && (await this._stateManager.userMap).has(matches[1])) {
			assignee = [matches[1]];
		}
		let title: string | undefined;
		const body: string | undefined = issueBody || newIssue?.document.isUntitled ? issueBody : (await createGithubPermalink(this.gitAPI, newIssue)).permalink;

		const quickInput = vscode.window.createInputBox();
		quickInput.value = titlePlaceholder ?? '';
		quickInput.prompt = 'Set the issue title. Confirm to create the issue now or use the edit button to edit the issue title and description.';
		quickInput.title = 'Create Issue';
		quickInput.buttons = [
			{
				iconPath: {
					light: Resource.icons.light.Edit,
					dark: Resource.icons.dark.Edit
				},
				tooltip: 'Edit Description'
			}
		];
		quickInput.onDidAccept(async () => {
			title = quickInput.value;
			if (title) {
				quickInput.busy = true;
				await this.doCreateIssue(document, newIssue, title, body, assignee, undefined, lineNumber, insertIndex);
				quickInput.busy = false;
			}
			quickInput.hide();
		});
		quickInput.onDidTriggerButton(async () => {
			title = quickInput.value;
			quickInput.busy = true;
			this.createIssueInfo = { document, newIssue, lineNumber, insertIndex };

			this.makeNewIssueFile(title, body, assignee);
			quickInput.busy = false;
			quickInput.hide();
		});
		quickInput.show();
	}

	private async makeNewIssueFile(title?: string, body?: string, assignees?: string[] | undefined) {
		const bodyPath = vscode.Uri.parse(`${NEW_ISSUE_SCHEME}:/${NEW_ISSUE_FILE}`);
		if (vscode.window.visibleTextEditors.filter(visibleEditor => visibleEditor.document.uri.scheme === NEW_ISSUE_SCHEME).length > 0) {
			return;
		}
		await vscode.workspace.fs.delete(bodyPath);
		const assigneeLine = `${ASSIGNEES} ${assignees && assignees.length > 0 ? assignees.map(value => '@' + value).join(', ') + ' ' : ''}`;
		const labelLine = `${LABELS} `;
		const text =
			`${title ?? 'Issue Title'}\n
${assigneeLine}
${labelLine}\n
${body ?? ''}\n
<!-- Edit the body of your new issue then click the ✓ \"Create Issue\" button in the top right of the editor. The first line will be the issue title. Assignees and Labels follow after a blank line. Leave an empty line before beginning the body of the issue. -->`;
		await vscode.workspace.fs.writeFile(bodyPath, this.stringToUint8Array(text));
		const assigneesDecoration = vscode.window.createTextEditorDecorationType({ after: { contentText: ' Comma-separated usernames, either @username or just username.', fontStyle: 'italic', color: new vscode.ThemeColor('issues.newIssueDecoration') } });
		const labelsDecoration = vscode.window.createTextEditorDecorationType({ after: { contentText: ' Comma-separated labels.', fontStyle: 'italic', color: new vscode.ThemeColor('issues.newIssueDecoration') } });
		const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((textEditor => {
			if (textEditor?.document.uri.scheme === NEW_ISSUE_SCHEME) {
				const assigneeFullLine = textEditor.document.lineAt(2);
				if (assigneeFullLine.text.startsWith(ASSIGNEES)) {
					textEditor.setDecorations(assigneesDecoration, [new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, assigneeFullLine.text.length))]);
				}
				const labelFullLine = textEditor.document.lineAt(3);
				if (labelFullLine.text.startsWith(LABELS)) {
					textEditor.setDecorations(labelsDecoration, [new vscode.Range(new vscode.Position(3, 0), new vscode.Position(3, labelFullLine.text.length))]);
				}
			}
		}));

		const editor = await vscode.window.showTextDocument(bodyPath);
		const closeDisposable = vscode.workspace.onDidCloseTextDocument((textDocument) => {
			if (textDocument === editor.document) {
				editorChangeDisposable.dispose();
				closeDisposable.dispose();
			}
		});
	}

	private async verifyLabels(createParams: Octokit.IssuesCreateParams): Promise<boolean> {
		if (!createParams.labels) {
			return true;
		}
		const allLabels = (await this.manager.getLabels(undefined, createParams)).map(label => label.name);
		const newLabels: string[] = [];
		const filteredLabels: string[] = [];
		createParams.labels?.forEach(label => {
			if (allLabels.includes(label)) {
				filteredLabels.push(label);
			} else {
				newLabels.push(label);
			}
		});

		if (newLabels.length > 0) {
			const yes = 'Yes';
			const no = 'No';
			const promptResult = await vscode.window.showInformationMessage(`The following labels don't exist in this repository: ${newLabels.join(', ')}. \nDo you want to create these labels?`, { modal: true }, yes, no);
			switch (promptResult) {
				case yes: return true;
				case no: {
					createParams.labels = filteredLabels;
					return true;
				}
				default: return false;
			}
		}
		return true;
	}

	private async doCreateIssue(document: vscode.TextDocument | undefined, newIssue: NewIssue | undefined, title: string, issueBody: string | undefined, assignees: string[] | undefined,
		labels: string[] | undefined, lineNumber: number | undefined, insertIndex: number | undefined): Promise<boolean> {
		let origin: PullRequestDefaults | undefined;
		try {
			origin = await this.manager.getPullRequestDefaults();
		} catch (e) {
			// There is no remote
			vscode.window.showErrorMessage('There is no remote. Can\'t create an issue.');
			return false;
		}
		const body: string | undefined = issueBody || newIssue?.document.isUntitled ? issueBody : (await createGithubPermalink(this.gitAPI, newIssue)).permalink;
		const createParams: Octokit.IssuesCreateParams = {
			owner: origin.owner,
			repo: origin.repo,
			title,
			body,
			assignees,
			labels
		};
		if (!(await this.verifyLabels(createParams))) {
			return false;
		}
		const issue = await this.manager.createIssue(createParams);
		if (issue) {
			if ((document !== undefined) && (insertIndex !== undefined) && (lineNumber !== undefined)) {
				const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
				const insertText: string = vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get('createInsertFormat', 'number') === 'number' ? `#${issue.number}` : issue.html_url;
				edit.insert(document.uri, new vscode.Position(lineNumber, insertIndex), ` ${insertText}`);
				await vscode.workspace.applyEdit(edit);
			} else {
				const copyIssueUrl = 'Copy URL';
				const openIssue = 'Open Issue';
				vscode.window.showInformationMessage('Issue created', copyIssueUrl, openIssue).then(async (result) => {
					switch (result) {
						case copyIssueUrl: await vscode.env.clipboard.writeText(issue.html_url); break;
						case openIssue: await vscode.env.openExternal(vscode.Uri.parse(issue.html_url)); break;
					}
				});
			}
			this._stateManager.refreshCacheNeeded();
			return true;
		}
		return false;
	}

	private async getPermalinkWithError(): Promise<string | undefined> {
		const link = await createGithubPermalink(this.gitAPI);
		if (link.error) {
			vscode.window.showWarningMessage(`Unable to create a GitHub permalink for the selection. ${link.error}`);
		}
		return link.permalink;
	}

	async copyPermalink() {
		const link = await this.getPermalinkWithError();
		if (link) {
			vscode.env.clipboard.writeText(link);
		}
	}

	async openPermalink() {
		const link = await this.getPermalinkWithError();
		if (link) {
			vscode.env.openExternal(vscode.Uri.parse(link));
		}
	}
}