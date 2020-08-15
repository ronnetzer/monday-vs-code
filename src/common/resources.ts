/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';

export class Resource {
    static icons: {
        light: { [index: string]: string };
        dark: { [index: string]: string };
        reactions: { [index: string]: string };
    };

    static initialize(context: vscode.ExtensionContext): void {
        Resource.icons = {
            light: {
                Modified: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-modified.svg')),
                Added: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-added.svg')),
                Deleted: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-deleted.svg')),
                Renamed: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-renamed.svg')),
                Copied: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-copied.svg')),
                Untracked: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-untrackedt.svg')),
                Ignored: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-ignored.svg')),
                Conflict: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'status-conflict.svg')),
                Comment: context.asAbsolutePath(path.join('resources', 'icons', 'comment.svg')),
                Avatar: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'github.svg')),
                Description: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'git-pull-request.svg')),
                Issues: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'issues.svg')),
                IssueClosed: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'issue-closed.svg')),
                Check: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'check.svg')),
                Edit: context.asAbsolutePath(path.join('resources', 'icons', 'light', 'edit.svg')),
            },
            dark: {
                Modified: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-modified.svg')),
                Added: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-added.svg')),
                Deleted: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-deleted.svg')),
                Renamed: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-renamed.svg')),
                Copied: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-copied.svg')),
                Untracked: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-untracked.svg')),
                Ignored: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-ignored.svg')),
                Conflict: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'status-conflict.svg')),
                Comment: context.asAbsolutePath(path.join('resources', 'icons', 'comment.svg')),
                Avatar: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'github.svg')),
                Description: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'git-pull-request.svg')),
                Issues: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'issues.svg')),
                IssueClosed: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'issue-closed.svg')),
                Check: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'check.svg')),
                Edit: context.asAbsolutePath(path.join('resources', 'icons', 'dark', 'edit.svg')),
            },
            reactions: {
                THUMBS_UP: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'thumbs_up.png')),
                THUMBS_DOWN: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'thumbs_down.png')),
                CONFUSED: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'confused.png')),
                EYES: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'eyes.png')),
                HEART: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'heart.png')),
                HOORAY: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'hooray.png')),
                LAUGH: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'laugh.png')),
                ROCKET: context.asAbsolutePath(path.join('resources', 'icons', 'reactions', 'rocket.png')),
            },
        };
    }
}
