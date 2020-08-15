/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// import * as LRUCache from 'lru-cache';
import * as vscode from 'vscode';
import { CredentialStore as MondayCredentialStore } from '../monday/credentials';
import { convertTeamToUser } from './util';
import { BoardsManager } from '../monday/boardsManager';
import { UsersManager } from '../monday/usersManager';
import { ITelemetry } from '../common/telemetry';
import { User } from 'monday-sdk-js';

// TODO: make exclude from date words configurable
// const CURRENT_ISSUE_KEY = 'currentIssue';

const ISSUES_KEY = 'issues';

export interface IssueState {
    branch?: string;
    hasDraftPR?: boolean;
}

interface TimeStampedIssueState extends IssueState {
    stateModifiedTime: number;
}

interface IssuesState {
    issues: Record<string, TimeStampedIssueState>;
    branches: Record<string, { owner: string; repositoryName: string; number: number }>;
}

export class StateManager {
    // public readonly resolvedIssues: LRUCache<string, IssueModel> = new LRUCache(50); // 50 seems big enough
    private _userMap: Promise<Map<string, User>> | undefined;
    private _itemCollection: Map<string, Promise<any[]>> = new Map();
    private _onRefreshCacheNeeded: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public onRefreshCacheNeeded: vscode.Event<void> = this._onRefreshCacheNeeded.event;
    private _onDidChangeIssueData: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public onDidChangeIssueData: vscode.Event<void> = this._onDidChangeIssueData.event;
    private _queries: { label: string; query: string }[];

    private _currentIssue: unknown | undefined;
    private _onDidChangeCurrentIssue: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public readonly onDidChangeCurrentIssue: vscode.Event<void> = this._onDidChangeCurrentIssue.event;
    private initializePromise: Promise<void> | undefined;
    private _maxIssueNumber = 0;

    get issueCollection(): Map<string, Promise<any[]>> {
        return this._itemCollection;
    }

    constructor(
        readonly mondayCredentialStore: MondayCredentialStore,
        readonly boardsManager: BoardsManager,
        readonly usersManager: UsersManager,
        private telemetry: ITelemetry,
        private context: vscode.ExtensionContext,
    ) {}

    async tryInitializeAndWait(): Promise<void> {
        if (!this.initializePromise) {
            this.initializePromise = new Promise((resolve, reject) => {
                if (this.mondayCredentialStore.isAuthenticated()) {
                    return this.doInitialize().then(() => resolve());
                } else {
                    this.telemetry.sendTelemetryErrorEvent('issues.stateManager.unauthorize');
                    reject('unauthorized');
                }
            });
        }
        return this.initializePromise;
    }

    // refreshCacheNeeded() {
    //     this._onRefreshCacheNeeded.fire();
    // }

    // async refresh(): Promise<void> {
    //     return this.setItemData();
    // }

    private async doInitialize() {
        this.cleanIssueState();
        // await this.setItemData();
        // this.context.subscriptions.push(
        //     this.onRefreshCacheNeeded(async () => {
        //         await this.refresh();
        //     }),
        // );
    }

    private cleanIssueState() {
        const stateString: string | undefined = this.context.workspaceState.get(ISSUES_KEY);
        const state: IssuesState = stateString ? JSON.parse(stateString) : { issues: [], branches: [] };
        const deleteDate: number = new Date().valueOf() - 30 /*days*/ * 86400000; /*milliseconds in a day*/
        for (const issueState in state.issues) {
            if (state.issues[issueState].stateModifiedTime < deleteDate) {
                if (state.branches && state.branches[issueState]) {
                    delete state.branches[issueState];
                }
                delete state.issues[issueState];
            }
        }
    }

    private async getUsers(): Promise<Map<string, User>> {
        await this.initializePromise;
        const assignableUsers = await Promise.all([
            this.usersManager.getUserTeams(),
            this.usersManager.getEntries(),
        ]).then(([teams, users]) => [...teams.map(convertTeamToUser), ...users]);
        const userMap: Map<string, User> = new Map();
        for (const user of assignableUsers) {
            userMap.set(user.name, user);
        }
        return userMap;
    }

    get userMap(): Promise<Map<string, User>> {
        if (!this.initializePromise) {
            return Promise.resolve(new Map());
        }
        if (!this._userMap) {
            this._userMap = this.getUsers();
        }
        return this._userMap;
    }

    private async getCurrentUser(): Promise<string> {
        return this.usersManager.currentUser.name;
    }

    // private async setItemData() {
    //     this._itemCollection.clear();
    //     let defaults: PullRequestDefaults | undefined;
    //     let user: string | undefined;
    //     for (const query of this._queries || []) {
    //         let items: Promise<IssueModel[] | MilestoneModel[]> = Promise.resolve([]);
    //         if (query.query === DEFAULT_QUERY_CONFIGURATION) {
    //         } else {
    //             if (!defaults) {
    //                 try {
    //                     // defaults = await this.manager.getPullRequestDefaults();
    //                 } catch (e) {
    //                     // leave defaults undefined
    //                 }
    //             }
    //             if (!user) {
    //                 user = await this.getCurrentUser();
    //             }
    //             items = this.setIssues(await variableSubstitution(query.query, undefined, defaults, user));
    //         }
    //         this._itemCollection.set(query.label, items);
    //     }
    //     // this._maxIssueNumber = await this.manager.getMaxIssue();
    // }

    // TODO: @rn set tasks
    // private setIssues(query: string): Promise<IssueModel[]> {
    //     return new Promise(async (resolve) => {
    //         // const issues = await this.manager.getIssues({ fetchNextPage: false }, query);
    //         this._onDidChangeIssueData.fire();
    //         resolve([]);
    //     });
    // }

    get currentIssue(): unknown | undefined {
        return this._currentIssue;
    }

    get maxIssueNumber(): number {
        return this._maxIssueNumber;
    }

    private isSettingIssue = false;
    // async setCurrentIssue(issue: CurrentIssue | undefined): Promise<void> {
    //     if (this.isSettingIssue && issue === undefined) {
    //         return;
    //     }
    //     this.isSettingIssue = true;
    //     try {
    //         if (this._currentIssue && issue?.issue.number === this._currentIssue.issue.number) {
    //             return;
    //         }
    //         if (this._currentIssue) {
    //             await this._currentIssue.stopWorking();
    //         }
    //         this.context.workspaceState.update(CURRENT_ISSUE_KEY, issue?.issue.number);
    //         this._currentIssue = issue;
    //         await this._currentIssue?.startWorking();
    //         this._onDidChangeCurrentIssue.fire();
    //     } catch (e) {
    //         // Error has already been surfaced
    //     } finally {
    //         this.isSettingIssue = false;
    //     }
    // }

    private getSavedState(): IssuesState {
        const stateString: string | undefined = this.context.workspaceState.get(ISSUES_KEY);
        return stateString ? JSON.parse(stateString) : { issues: Object.create(null), branches: Object.create(null) };
    }

    getSavedIssueState(issueNumber: number): IssueState {
        const state: IssuesState = this.getSavedState();
        return state.issues[`${issueNumber}`] ?? {};
    }

    // setSavedIssueState(issue: IssueModel, issueState: IssueState) {
    //     const state: IssuesState = this.getSavedState();
    //     state.issues[`${issue.number}`] = { ...issueState, stateModifiedTime: new Date().valueOf() };
    //     if (issueState.branch) {
    //         if (!state.branches) {
    //             state.branches = Object.create(null);
    //         }
    //         state.branches[issueState.branch] = {
    //             number: issue.number,
    //             owner: issue.remote.owner,
    //             repositoryName: issue.remote.repositoryName,
    //         };
    //     }
    //     this.context.workspaceState.update(ISSUES_KEY, JSON.stringify(state));
    // }
}
