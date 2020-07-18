import TelemetryReporter from "vscode-extension-telemetry";

export interface Board {
	name: string;
	id: string;
}

export class BoardsManager {
	boards: Board[];
	defaultBoard: Board;
	constructor(telemetry: TelemetryReporter) { }

	async init(): Promise<void> {
		// TODO: load from api all possible boards, check the state to see if the default board is defined.
	}
}