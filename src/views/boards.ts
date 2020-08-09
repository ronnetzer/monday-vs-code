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

	getParent(element: BoardTreeItem | GroupTreeItem | ItemTreeItem): vscode.TreeItem | null {
		return element instanceof BoardTreeItem ? null : element.parent;
	}

	resolveTreeItem(element: BoardTreeItem | GroupTreeItem | ItemTreeItem): Thenable<vscode.TreeItem> {
		if (element instanceof ItemTreeItem) {
			return this.itemsManager.getItem(element.item.id).then(item => new ItemTreeItem(item, element.parent))
		}

		return Promise.resolve(element);
	}

	getTreeItem(element: BoardTreeItem | GroupTreeItem | ItemTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BoardTreeItem | GroupTreeItem): Thenable<vscode.TreeItem[]> {
		if (element) {
			// if we have an element let's test and see instance of what he is (Board? Item? SubItem? etc...)
			if (element instanceof BoardTreeItem) {
				// TODO: return all relevant items for this board.
				return this.boardsManager.getBoardGroups(element.board.id)
					.then(groups => groups.map(group => new GroupTreeItem(group, element, group.items.length ? vscode.TreeItemCollapsibleState.Collapsed : undefined)));
			} else {
				// element is GroupItem
				return Promise.resolve(element.group.items).then(items => items.map(item => new ItemTreeItem(item, element)));
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
		public readonly parent: BoardTreeItem,
		public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(group.title, collapsibleState);
	}

	contextValue = 'group';
}

export class ItemTreeItem extends vscode.TreeItem {

	constructor(
		public readonly item: ItemPreview & Partial<Item>,
		public readonly parent: GroupTreeItem,
		public readonly collapsibleState?: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(item.name, collapsibleState);
	}

	contextValue = 'item';
}
