// TODO: one day -.-
declare module 'monday-sdk-js' {
    export = init;

    namespace init {
        export interface MondaySDKResponse<T> {
            data: T;
            account_id: string;
        }

        export interface Team {
            id: string;
            name: string;
            picture_url: string;
        }

        export interface UserPreview {
            id: string;
            name: string;
            email: string;
            isTeam?: boolean;
        }

        export type UserDetails = UserPreview & {
            photo_thumb_small?: string;
            join_date?: Date;
            url?: string;
            is_guest?: boolean;
            title?: string;
            location?: string;
            teams?: Team[];
            account?: { id: string; name: string };
        }

        export type User = UserPreview & UserDetails;

        // all / active / archived / deleted
        export enum State {
            ACTIVE = 'active',
            ALL = 'all',
            ARCHIVED = 'archived',
            DELETED = 'deleted',
        }

        //
        export enum BoardKind {
            PRIVATE = 'private',
            PUBLIC = 'public',
            SHARE = 'share',
        }

        export interface Board {
            name: string;
            id: string;
            state: State;
            groups: { id: string }[];
            tags: Tag[]
            board_kind: BoardKind;
        }

        export interface Group {
            id: string;
            title: string;
            deleted: boolean;
            archived: boolean;
            color: string;
            position: string;
            items: ItemPreview[];
        }

        export interface Tag {
            id: string;
            name: string;
            color: string;
        }

        export interface ItemPreview {
            id: string;
            name: string;
        }

        export interface Item extends ItemPreview {
            state: State;
            creator_id: string;
            created_at: string;
            updated_at: string;
            group: Group;
            board: { id: string };
            subscribers: UserPreview[];
        }

        export interface MondaySDK {
            setToken: (token: string) => void;
            api: <T = any>(query: string, options: any) => Promise<MondaySDKResponse<T>>;
            oauthToken: (code: string, clientId: string, clientSecret: string) => Promise<any>;
        }
    }

    function init(options?: { token: string }): MondaySDK;
}

/**
  constructor(options = {}) {
    this._token = options.token;

    this.setToken = this.setToken.bind(this);
    this.api = this.api.bind(this);
  }

  setToken(token) {
    this._token = token;
  }

  async api(query, options = {}) {
    const params = { query, variables: options.variables };
    const token = options.token || this._token;

    if (!token) throw new Error(TOKEN_MISSING_ERROR);

    return await mondayApiClient.execute(params, token);
  }

  oauthToken(code, clientId, clientSecret) {
    return oauthToken(code, clientId, clientSecret);
  }
 */
