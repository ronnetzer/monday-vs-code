import * as vscode from 'vscode';
import { BoardsManager } from '../monday/boardsManager';
import { Board, Group, Item, ItemPreview } from 'monday-sdk-js';
import { ItemsManager } from '../monday/ItemsManager';

export class BoardProvider implements vscode.TreeDataProvider<any> {

	private _onDidChangeTreeData: vscode.EventEmitter<BoardTreeItem | undefined | void> = new vscode.EventEmitter<BoardTreeItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<BoardTreeItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private boardsManager: BoardsManager, private itemsManager: ItemsManager) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: BoardTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BoardTreeItem | GroupTreeItem): Thenable<vscode.TreeItem[]> {
		if (element) {
			// if we have an element let's test and see instance of what he is (Board? Item? SubItem? etc...)
			if (element instanceof BoardTreeItem) {
				// TODO: return all relevant items for this board.
				return this.boardsManager.getBoardGroups(element.board.id)
					.then(groups => groups.map(group => new GroupTreeItem(group, group.items.length ? vscode.TreeItemCollapsibleState.Collapsed : undefined)));
			} else {
				// element is GroupItem
				return Promise.resolve(element.group.items).then(items => items.map(item => new ItemTreeItem(item)));
			}
		} else {
			// if no element return the boards list
			return Promise.resolve(this.boardsManager.boards.map(board => {
				const isDefault = board.id === this.boardsManager.defaultBoard.id;
				return new BoardTreeItem(board, isDefault ? 2 : 1);
			}));
		}
	}
}

export class BoardTreeItem extends vscode.TreeItem {

	constructor(
		public readonly board: Board,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(board.name, collapsibleState);
	}

	contextValue = 'board';
}

export class GroupTreeItem extends vscode.TreeItem {

	constructor(
		public readonly group: Group,
		public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(group.title, collapsibleState);
	}

	contextValue = 'group';
}

export class ItemTreeItem extends vscode.TreeItem {

	constructor(
		public readonly item: ItemPreview,
		public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(item.name, collapsibleState);
	}

	contextValue = 'item';
}
