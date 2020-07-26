import * as vscode from 'vscode';
import { BoardsManager } from '../monday/boardsManager';
import { Board } from 'monday-sdk-js';

export class BoardProvider implements vscode.TreeDataProvider<BoardItem> {

	private _onDidChangeTreeData: vscode.EventEmitter<BoardItem | undefined | void> = new vscode.EventEmitter<BoardItem | undefined | void>();
	readonly onDidChangeTreeData: vscode.Event<BoardItem | undefined | void> = this._onDidChangeTreeData.event;

	constructor(private boardsManager: BoardsManager) {
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: BoardItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: BoardItem): Thenable<BoardItem[]> {
		if (element) {
			// if we have an element let's test and see instance of what he is (Board? Item? SubItem? etc...)
			if (element instanceof BoardItem) {
				// TODO: return all relevant items for this board.
				return Promise.resolve([]);
			} else {
				return Promise.resolve([]);
			}
		} else {
			// if no element return the boards list
			return Promise.resolve(this.boardsManager.boards.map(board => {
				const isDefault = board.id === this.boardsManager.defaultBoard.id;
				return new BoardItem(board, isDefault ? 2 : 1);
			}));
		}
	}
}

export class BoardItem extends vscode.TreeItem {

	constructor(
		public readonly board: Board,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly command?: vscode.Command
	) {
		super(board.name, collapsibleState);
	}

	contextValue = 'board';
}
