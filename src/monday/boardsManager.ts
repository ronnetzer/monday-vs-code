import * as WorkspaceState from '../common/workspaceState';
import * as vscode from 'vscode';
import { ITelemetry } from '../common/telemetry';
import { MondaySDK } from 'monday-sdk-js';
import { MondaySDKResponse } from './kit';

// all / active / archived / deleted
export enum BoardState {
	ACTIVE = 'active',
	ALL = 'all',
	ARCHIVED = 'archived',
	DELETED = 'deleted'
}

//
export enum BoardKind {
	PRIVATE = 'private',
	PUBLIC = 'public',
	SHARE = 'share'
}

export interface Board {
	name: string;
	id: string;
	state: BoardState;
	board_kind: BoardKind;
}

export interface Boards {
	boards: Board[];
}

export class BoardsManager {
	boards: Board[];
	defaultBoard: Board;
	constructor(private readonly _telemetry: ITelemetry, private readonly _mondaySDK: MondaySDK) { }

	async init(): Promise<Board> {
		// TODO: load from api all possible boards, check the state to see if the default board is defined.
		this._telemetry.sendTelemetryEvent('boards.manager.init');
		this.setDefaultBoard(WorkspaceState.fetch('monday', 'defaultBoard') as Board);

		const boardsQuery = this.allBoardsQuery();

		const boardsResponse = await this._mondaySDK.api(boardsQuery, '') as MondaySDKResponse<Boards>;
		this.boards = boardsResponse.data.boards;

		// if we have 0 boards, throw an error.
		if (this.boards.length <= 0) {
			this._telemetry.sendTelemetryEvent('boards.manager.fail');
			throw new Error('No boards found, go and open some');
		}

		// if we have defaultBoard, check if he exists in the boards list.
		// otherwise prompt the user to select his default board
		// TODO: support multiple boards in a single project/workspace.
		await this.selectDefaultBoard();

		this._telemetry.sendTelemetryEvent('boards.manager.success');

		return this.defaultBoard;
	}

	public async selectDefaultBoard() {
		if (!this.defaultBoard || !this.defaultBoard.id || !this.boards.find((board) => board.id === this.defaultBoard.id)) {
			const choices = this.getBoardsChoices();
			const response: vscode.QuickPickItem | undefined = await vscode.window.showQuickPick(choices, { placeHolder: 'Default monday board for this workspace' });
			if (response) {
				this.setDefaultBoard(this.boards.find(board => board.id === response.description) as Board);
			} else {
				this._telemetry.sendTelemetryEvent('boards.manager.fail');
				throw new Error('No default board selected');
			}
		}
	}

	private setDefaultBoard(board: Board) {
		this.defaultBoard = board;
		WorkspaceState.store('monday', 'defaultBoard', this.defaultBoard);
	}

	private allBoardsQuery() {
		return `{
			boards() {
			name,
			id,
			state,
			tags {
			 id,
			  name
			},
			board_kind
		  }
		}`;
	}

	private getBoardsChoices(): vscode.QuickPickItem[] {
		return this.boards.map(board =>
			({ label: board.name, alwaysShow: true, description: board.id })
		);
	}
}