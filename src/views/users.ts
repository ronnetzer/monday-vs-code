import * as vscode from 'vscode';
import { UsersManager } from '../monday/usersManager';

export class UserProvider implements vscode.TreeDataProvider<UserItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<UserItem | undefined | void> = new vscode.EventEmitter<UserItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<UserItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private usersManager: UsersManager) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: UserItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: any): Thenable<any[]> {
		if (element) {
			return Promise.resolve([]);
		} else {
			// if no element return the boards list
			return Promise.resolve(this.usersManager.users.map(user => {
				// TODO: add context menu that will open monday in the corresponding context,
				// e.g. Send Email, Add to Team or w/e...
				return new UserItem(user.name, 0);
			}));
		}
	}
}

export class UserItem extends vscode.TreeItem {

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
	}
}