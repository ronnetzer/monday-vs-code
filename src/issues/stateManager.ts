import * as vscode from 'vscode';
import { CredentialStore as MondayCredentialStore } from '../monday/credentials';
import { convertTeamToUser, ISSUES_CONFIGURATION, QUERIES_CONFIGURATION, DEFAULT_QUERY_CONFIGURATION, variableSubstitution } from './util';
import { BoardsManager } from '../monday/boardsManager';
import { UsersManager } from '../monday/usersManager';
import { ITelemetry } from '../common/telemetry';
import { User, Item } from 'monday-sdk-js';
import { ItemsManager } from '../monday/ItemsManager';
import { onSessionDidChanged } from '../monday/kit';

const ISSUES_KEY = 'issues';

const DEFAULT_QUERY_CONFIGURATION_VALUE = [{ label: 'My Issues', query: 'default' }];

export class StateManager {
    private _userMap: Promise<Map<string, User>> | undefined;
    private _itemMap: Promise<Map<string, Item>> | undefined;
    private _onRefreshCacheNeeded: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public onRefreshCacheNeeded: vscode.Event<void> = this._onRefreshCacheNeeded.event;
    private _onDidChangeIssueData: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public onDidChangeIssueData: vscode.Event<void> = this._onDidChangeIssueData.event;
    private _queries: { label: string; query: string }[];

    private _currentIssue: unknown | undefined;
    private _onDidChangeCurrentIssue: vscode.EventEmitter<void> = new vscode.EventEmitter();
    public readonly onDidChangeCurrentIssue: vscode.Event<void> = this._onDidChangeCurrentIssue.event;
    private initializePromise: Promise<void> | undefined;

    constructor(
        readonly mondayCredentialStore: MondayCredentialStore,
        readonly boardsManager: BoardsManager,
        readonly itemsManager: ItemsManager,
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

    refreshCacheNeeded() {
        this._onRefreshCacheNeeded.fire();
    }

    async refresh(): Promise<void> {
        return this._itemMap = undefined;;
    }

    private async doInitialize() {
        this._queries = vscode.workspace.getConfiguration(ISSUES_CONFIGURATION).get(QUERIES_CONFIGURATION, DEFAULT_QUERY_CONFIGURATION_VALUE);
		if (this._queries.length === 0) {
			this._queries = DEFAULT_QUERY_CONFIGURATION_VALUE;
		}

        this.context.subscriptions.push(
            this.onRefreshCacheNeeded(async () => {
                await this.refresh();
            }),
        );

        this.context.subscriptions.push(
            onSessionDidChanged(async (sesssion) => {
                if (!sesssion) {
                    this.refreshCacheNeeded();
                    this.boardsManager.defaultBoard = undefined;
                }
            })
        );
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

    private async getItems(): Promise<Map<string, Item>> {
        await this.initializePromise;
        const items = await this.itemsManager.getEntries();
        const itemMap = new Map();

        for (const item of items) {
            itemMap.set(item.name, item);
        }

        return itemMap;
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

    get itemMap(): Promise<Map<string, Item>> {
        if (!this.initializePromise) {
            return Promise.resolve(new Map());
        }
        if (!this._itemMap) {
            this._itemMap = this.getItems();
        }
        return this._itemMap;
    }

    private async getCurrentUser(): Promise<string> {
        return this.usersManager.currentUser.name;
    }

    get currentIssue(): unknown | undefined {
        return this._currentIssue;
    }
}
