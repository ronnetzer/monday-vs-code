import { ITelemetry } from '../common/telemetry';
import { MondaySDK, UserPreview, User, Team, UserDetails } from 'monday-sdk-js';
import Logger from '../common/logger';

export interface UserResponse<T = UserPreview> {
    users: T[];
}

export class UsersManager {
    private _currentUser: Required<User>;

    constructor(private readonly _telemetry: ITelemetry, private readonly sdk: MondaySDK) {}

    async init(): Promise<Required<User>> {
        // TODO: load from api all possible boards, check the state to see if the default board is defined.
        Logger.appendLine('Init UsersManager');
        this._telemetry.sendTelemetryEvent('users.manager.init');

        this._currentUser = await this.getCurrentUser();
        this._telemetry.sendTelemetryEvent('users.manager.success', { currentUser: this._currentUser.name });

        return this._currentUser;
    }

    get currentUser(): Required<User> {
        return this._currentUser;
    }

    async getEntries(): Promise<User[]> {
        return await this.sdk.api<UserResponse>(this.allUsersPreviewQuery(), '').then((res) => {
            // if we have 0 boards, throw an error.
            if (!res.data.users.length) {
                Logger.appendLine('No users found');
                this._telemetry.sendTelemetryEvent('users.manager.fail');
                throw new Error('No users found, something is fishy here');
            }

            return res.data.users;
        });
    }

    async getUserTeams(): Promise<Team[]> {
        return Promise.resolve(this.currentUser.teams);
    }

    private async getCurrentUser(): Promise<Required<User>> {
        return await this.sdk.api<{ me: Required<User> }>(this.currentUserQuery(), '').then((res) => res.data.me);
    }

    async getUserDetails(ids: string[]): Promise<UserDetails> {
        const userDetailsQuery = this.userDetailsQuery(ids);
        const userDetailsRes = await this.sdk.api<UserResponse<UserDetails>>(userDetailsQuery, '');
        const userDetails = userDetailsRes.data.users[0];

        if (!userDetails) {
            Logger.appendLine('Cant get user details');
            this._telemetry.sendTelemetryEvent('users.manager.fail');
            return Promise.reject(new Error('Cant get user details'));
        }

        return userDetails;
    }

    private allUsersPreviewQuery() {
        return `{
			users {
				id
				name
				email
			}
		}`;
    }

    private currentUserQuery() {
        return `{
			me {
				id
				name
				email
				join_date
				photo_thumb_small
				title
				teams {
					id
					name
					picture_url
				}
				url
				is_guest
				account {
					name
					id
				}
			}
		}`;
    }

    private userDetailsQuery(ids: string[]) {
        return `{
			users(ids: [${ids.join(', ')}]) {
                name
                id
                email
				join_date
                photo_thumb_small
                location
				title
				url
				teams {
					id
					name
                }
                account {
					name
					id
				}
				is_guest
			}
		}`;
    }
}
