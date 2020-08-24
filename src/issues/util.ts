/* eslint-disable */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as marked from 'marked';
import * as vscode from 'vscode';
import * as path from 'path';
import { Repository, GitAPI, Remote, Commit, Ref } from '../typings/git';
import { User, Team, Item, ItemPreview, State } from 'monday-sdk-js';
import { parse } from 'path';

export const ISSUE_EXPRESSION = /(([^\s]+)\/([^\s]+))?(#)([1-9][0-9]*)($|[\s:;\-(=)])/;
export const ISSUE_OR_URL_EXPRESSION = /(https?:\/\/monday\.com\/(([^\s]+)\/([^\s]+))\/([^\s]+\/)?(pulses)\/([0-9]+)?)|(([^\s]+)\/([^\s]+))?(#)([1-9][0-9]*)($|[\s:;\-(=)])/;

export const USER_EXPRESSION = /@([^;]+)/;

export const MAX_LINE_LENGTH = 150;

export const ISSUES_CONFIGURATION = 'mondayExtension';
export const QUERIES_CONFIGURATION = 'queries';
export const DEFAULT_QUERY_CONFIGURATION = 'default';
export const BRANCH_NAME_CONFIGURATION = 'workingIssueBranch';
export const BRANCH_CONFIGURATION = 'useBranchForIssues';
export const SCM_MESSAGE_CONFIGURATION = 'workingIssueFormatScm';

export function parseIssueExpressionOutput(output: RegExpMatchArray | null): ItemPreview | undefined {
    if (!output) {
        return undefined;
    }
    const issue: ItemPreview = { name: '', id: '0' };
    if (output.length === 7) {
        issue.name = output[3];
        issue.id = output[5];
        return issue;
    } else if (output.length === 14) {
        issue.name = output[2] || output[10];
        issue.id = output[5] || output[12];
        return issue;
    } else {
        return undefined;
    }
}

export class UserCompletionItem extends vscode.CompletionItem {
    data: User;
}

export function convertTeamToUser({ id, name, picture_url: photo_thumb_small }: Team): User {
    return {
        id,
        name,
        photo_thumb_small,
        email: '',
        isTeam: true,
    };
}

export function userMarkdown(user: User): vscode.MarkdownString {
    const markdown: vscode.MarkdownString = new vscode.MarkdownString(undefined, true);
    markdown.appendMarkdown(`![Avatar](${user.photo_thumb_small}|height=50,width=50) **[${user.name}](${user.url})**`);
    if (user.title) {
        markdown.appendText('  \r\n' + user.title.replace(/\r\n/g, ' '));
    }
    if (user.location) {
        markdown.appendMarkdown('  \r\n\r\n---');
        markdown.appendMarkdown(`  \r\n$(location) ${user.location}`);
    }
    if (user.teams?.length) {
        markdown.appendMarkdown(`  \r\n$(jersey) Member of ${user.teams.map((team) => team.name).join(', ')}`);
    }
    return markdown;
}

function convertHexToRgb(hex: string): { r: number; g: number; b: number } | undefined {
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : undefined;
}

function makeLabel(color: string, text: string): string {
    const rgbColor = convertHexToRgb(color);
    let textColor = 'ffffff';
    if (rgbColor) {
        // Color algorithm from https://stackoverflow.com/questions/1855884/determine-font-color-based-on-background-color
        const luminance = (0.299 * rgbColor.r + 0.587 * rgbColor.g + 0.114 * rgbColor.b) / 255;
        if (luminance > 0.5) {
            textColor = '000000';
        }
    }

    return `<span style="color:#${textColor};background-color:#${color};">&nbsp;&nbsp;${text}&nbsp;&nbsp;</span>`;
}

function parseAccountName(user: User): string {
    return user.account?.name.toLowerCase().replace(' ', '-') ?? '';
}

export function createItemUrl(item: Item, user: User): string {
    const account = parseAccountName(user);
    return `https://${account}.monday.com/boards/${item.board.id}/pulses/${item.id}`
}

function findLinksInIssue(body: string, item: Item, user: User): string {
    let searchResult = body.search(ISSUE_OR_URL_EXPRESSION);
    let position = 0;
    while (searchResult >= 0 && searchResult < body.length) {
        let newBodyFirstPart: string | undefined;
        if (searchResult === 0 || body.charAt(searchResult - 1) !== '&') {
            const match = body.substring(searchResult).match(ISSUE_OR_URL_EXPRESSION)!;
            const tryParse = parseIssueExpressionOutput(match);
            if (tryParse) {
                const issueNumberLabel = getItemNumberLabel(tryParse); // get label before setting owner and name.
                newBodyFirstPart =
                    body.slice(0, searchResult) +
                    `[${issueNumberLabel}](${createItemUrl(item, user)}})`;
                body = newBodyFirstPart + body.slice(searchResult + match[0].length);
            }
        }
        position = newBodyFirstPart ? newBodyFirstPart.length : searchResult + 1;
        const newSearchResult = body.substring(position).search(ISSUE_OR_URL_EXPRESSION);
        searchResult = newSearchResult > 0 ? position + newSearchResult : newSearchResult;
    }
    return body;
}

export const ISSUE_BODY_LENGTH = 200;
export function  issueMarkdown(
    item: Item,
    user: User,
    context: vscode.ExtensionContext,
    commentNumber?: number,
): vscode.MarkdownString {
    const markdown: vscode.MarkdownString = new vscode.MarkdownString(undefined, true);
    markdown.isTrusted = true;
    const date = new Date(item.created_at);
    markdown.appendMarkdown(
        `[${user.name}](${user.url}) on ${date.toLocaleString('default', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        })}  \n`,
    );
    const title = marked
        .parse(item.name, {
            renderer: new PlainTextRenderer(),
        })
        .trim();
    markdown.appendMarkdown(
        `${getIconMarkdown(item, context)} **${title}** [#${item.id}](${createItemUrl(item, user)})  \n`,
    );

    // TODO: get item description from column value
    let body = marked.parse(/* item.body */ '', {
        renderer: new PlainTextRenderer(),
    });
    markdown.appendMarkdown('  \n');
    body = body.length > ISSUE_BODY_LENGTH ? body.substr(0, ISSUE_BODY_LENGTH) + '...' : body;
    body = findLinksInIssue(body, item, user);

    markdown.appendMarkdown(body + '  \n');
    markdown.appendMarkdown('&nbsp;  \n');

    // TODO: add tags from column value
    // if (item.labels.length > 0) {
    //     item.item.labels.forEach((label: any) => {
    //         markdown.appendMarkdown(
    //             `[${makeLabel(label.color, label.name)}](https://github.com/${ownerName}/labels/${encodeURIComponent(
    //                 label.name,
    //             )}) `,
    //         );
    //     });
    // }

    //  TODO: add item updates
    // if (item.item.comments && commentNumber) {
    //     for (const comment of item.item.comments) {
    //         if (comment.databaseId === commentNumber) {
    //             markdown.appendMarkdown('  \r\n\r\n---\r\n');
    //             markdown.appendMarkdown('&nbsp;  \n');
    //             markdown.appendMarkdown(
    //                 `![Avatar](${comment.author.avatarUrl}|height=15,width=15) &nbsp;&nbsp;**${comment.author.login}** commented`,
    //             );
    //             markdown.appendMarkdown('&nbsp;  \n');
    //             const commentText = marked.parse(
    //                 comment.body.length > ISSUE_BODY_LENGTH
    //                     ? comment.body.substr(0, ISSUE_BODY_LENGTH) + '...'
    //                     : comment.body,
    //                 { renderer: new PlainTextRenderer() },
    //             );
    //             // commentText = findLinksInIssue(commentText, issue);
    //             markdown.appendMarkdown(commentText);
    //         }
    //     }
    // }
    return markdown;
}

function getIconMarkdown(item: Item, context: vscode.ExtensionContext) {
    switch (item.state) {
        case 'active':
            return `![Item State](${vscode.Uri.file(
                context.asAbsolutePath(path.join('resources', 'icons', 'issues-green.svg'))
            ).toString()})`;

        case 'archived':
        case 'deleted':
            return `![Item State](${vscode.Uri.file(
                context.asAbsolutePath(path.join('resources', 'icons', 'issue-closed-red.svg'))
            ).toString()})`;

    }
}

export interface NewIssue {
    document: vscode.TextDocument;
    lineNumber: number;
    line: string;
    insertIndex: number;
    range: vscode.Range | vscode.Selection;
}

function getRepositoryForFile(gitAPI: GitAPI, file: vscode.Uri): Repository | undefined {
    for (const repository of gitAPI.repositories) {
        if (file.path.toLowerCase().startsWith(repository.rootUri.path.toLowerCase())) {
            return repository;
        }
    }
    return undefined;
}

const HEAD = 'HEAD';
const UPSTREAM = 1;
const UPS = 2;
const ORIGIN = 3;
const OTHER = 4;
const REMOTE_CONVENTIONS = new Map([
    ['upstream', UPSTREAM],
    ['ups', UPS],
    ['origin', ORIGIN],
]);

async function getUpstream(repository: Repository, commit: Commit): Promise<Remote | undefined> {
    const currentRemoteName: string | undefined =
        repository.state.HEAD?.upstream && !REMOTE_CONVENTIONS.has(repository.state.HEAD.upstream.remote)
            ? repository.state.HEAD.upstream.remote
            : undefined;
    let currentRemote: Remote | undefined;
    // getBranches is slow if we don't pass a very specific pattern
    // so we can't just get all branches then filter/sort.
    // Instead, we need to create parameters for getBranches such that there is only ever on possible return value,
    // which makes it much faster.
    // To do this, create very specific remote+branch patterns to look for and sort from "best" to "worst".
    // Then, call getBranches with each pattern until one of them succeeds.
    const remoteNames: { name: string; remote?: Remote }[] = repository.state.remotes
        .map((remote) => {
            return { name: remote.name, remote };
        })
        .filter((value) => {
            // While we're already here iterating through all values, find the current remote for use later.
            if (value.name === currentRemoteName) {
                currentRemote = value.remote;
            }
            return REMOTE_CONVENTIONS.has(value.name);
        })
        .sort((a, b): number => {
            const aVal = REMOTE_CONVENTIONS.get(a.name) ?? OTHER;
            const bVal = REMOTE_CONVENTIONS.get(b.name) ?? OTHER;
            return aVal - bVal;
        });

    if (currentRemoteName) {
        remoteNames.push({ name: currentRemoteName, remote: currentRemote });
    }

    const branchNames = [HEAD];
    if (repository.state.HEAD?.name && repository.state.HEAD.name !== HEAD) {
        branchNames.unshift(repository.state.HEAD?.name);
    }
    let bestRef: Ref | undefined;
    let bestRemote: Remote | undefined;
    for (let branchIndex = 0; branchIndex < branchNames.length && !bestRef; branchIndex++) {
        for (let remoteIndex = 0; remoteIndex < remoteNames.length && !bestRef; remoteIndex++) {
            const remotes = (
                await repository.getBranches({
                    contains: commit.hash,
                    remote: true,
                    pattern: `remotes/${remoteNames[remoteIndex].name}/${branchNames[branchIndex]}`,
                    count: 1,
                })
            ).filter((value) => value.remote && value.name);
            if (remotes && remotes.length > 0) {
                bestRef = remotes[0];
                bestRemote = remoteNames[remoteIndex].remote;
            }
        }
    }

    return bestRemote;
}

// export async function createGithubPermalink(
//     gitAPI: GitAPI,
//     positionInfo?: NewIssue,
// ): Promise<{ permalink: string | undefined; error: string | undefined }> {
//     let document: vscode.TextDocument;
//     let range: vscode.Range;
//     if (!positionInfo && vscode.window.activeTextEditor) {
//         document = vscode.window.activeTextEditor.document;
//         range = vscode.window.activeTextEditor.selection;
//     } else if (positionInfo) {
//         document = positionInfo.document;
//         range = positionInfo.range;
//     } else {
//         return { permalink: undefined, error: 'No active text editor position to create permalink from.' };
//     }

//     const repository = getRepositoryForFile(gitAPI, document.uri);
//     if (!repository) {
//         return { permalink: undefined, error: "The current file isn't part of repository." };
//     }

//     const log = await repository.log({ maxEntries: 1, path: document.uri.fsPath });
//     if (log.length === 0) {
//         return { permalink: undefined, error: 'No branch on a remote contains the most recent commit for the file.' };
//     }

//     const upstream: Remote | undefined = await Promise.race([
//         getUpstream(repository, log[0]),
//         new Promise<Remote | undefined>((resolve) => {
//             setTimeout(() => {
//                 if (repository.state.HEAD?.upstream) {
//                     for (const remote of repository.state.remotes) {
//                         if (repository.state.HEAD.upstream.remote === remote.name) {
//                             resolve(remote);
//                         }
//                     }
//                 }
//             }, 2000);
//         }),
//     ]);
//     if (!upstream) {
//         return { permalink: undefined, error: 'There is no suitable remote.' };
//     }
//     const pathSegment = document.uri.path.substring(repository.rootUri.path.length);
//     const expr = /^((git\@github\.com\:)|(https:\/\/github\.com\/))(.+\/.+)\.git$/;
//     const match = upstream.fetchUrl?.match(expr);
//     if (!match) {
//         return { permalink: undefined, error: "Can't get the owner and repository from the git remote url." };
//     }
//     return {
//         permalink: `https://github.com/${match[4].toLowerCase()}/blob/${log[0].hash}${pathSegment}#L${
//             range.start.line + 1
//         }-L${range.end.line + 1}`,
//         error: undefined,
//     };
// }

const VARIABLE_PATTERN = /\$\{(.*?)\}/g;
export async function variableSubstitution(
    value: string,
    issueModel?: Item,
    user?: string,
): Promise<string> {
    return value.replace(VARIABLE_PATTERN, (match: string, variable: string) => {
        switch (variable) {
            case 'user':
                return user ? user : match;
            case 'issueNumber':
                return issueModel ? `${issueModel.id}` : match;
            case 'issueNumberLabel':
                return issueModel ? `${getItemNumberLabel(issueModel)}` : match;
            case 'issueTitle':
                return issueModel ? issueModel.name : match;
            case 'sanitizedIssueTitle':
                return issueModel
                    ? issueModel.name
                          .replace(/[~^:?*[\]@\\{}]|\/\//g, '')
                          .trim()
                          .replace(/\s+/g, '-')
                    : match; // check what characters are permitted
            default:
                return match;
        }
    });
}

export function getItemNumberLabel(item: ItemPreview) {
    return `#${item.id}`
}

// async function commitWithDefault(manager: PullRequestManager, stateManager: StateManager, all: boolean) {
//     const message = await stateManager.currentIssue?.getCommitMessage();
//     if (message) {
//         return manager.repository.commit(message, { all });
//     }
// }

// const commitStaged = 'Commit Staged';
// const commitAll = 'Commit All';
// export async function pushAndCreatePR(
//     manager: PullRequestManager,
//     reviewManager: ReviewManager,
//     stateManager: StateManager,
//     draft = false,
// ): Promise<boolean> {
//     if (manager.repository.state.workingTreeChanges.length > 0 || manager.repository.state.indexChanges.length > 0) {
//         const responseOptions: string[] = [];
//         if (manager.repository.state.indexChanges) {
//             responseOptions.push(commitStaged);
//         }
//         if (manager.repository.state.workingTreeChanges) {
//             responseOptions.push(commitAll);
//         }
//         const changesResponse = await vscode.window.showInformationMessage(
//             'There are uncommitted changes. Do you want to commit them with the default commit message?',
//             { modal: true },
//             ...responseOptions,
//         );
//         switch (changesResponse) {
//             case commitStaged: {
//                 await commitWithDefault(manager, stateManager, false);
//                 break;
//             }
//             case commitAll: {
//                 await commitWithDefault(manager, stateManager, true);
//                 break;
//             }
//             default:
//                 return false;
//         }
//     }

//     if (manager.repository.state.HEAD?.upstream) {
//         await manager.repository.push();
//         await reviewManager.createPullRequest(draft);
//         return true;
//     } else {
//         let remote: string | undefined;
//         if (manager.repository.state.remotes.length === 1) {
//             remote = manager.repository.state.remotes[0].name;
//         } else if (manager.repository.state.remotes.length > 1) {
//             remote = await vscode.window.showQuickPick(
//                 manager.repository.state.remotes.map((value) => value.name),
//                 { placeHolder: 'Remote to push to' },
//             );
//         }
//         if (remote) {
//             await manager.repository.push(remote, manager.repository.state.HEAD?.name, true);
//             await reviewManager.createPullRequest(draft);
//             return true;
//         } else {
//             vscode.window.showWarningMessage(
//                 'The current repository has no remotes to push to. Please set up a remote and try again.',
//             );
//             return false;
//         }
//     }
// }

export async function isComment(document: vscode.TextDocument, position: vscode.Position): Promise<boolean> {
    if (document.languageId !== 'markdown' && document.languageId !== 'plaintext') {
        // proposed api
        /* const tokenInfo = await vscode.languages.getTokenInformationAtPosition(document, position);
        if (tokenInfo.type !== vscode.StandardTokenType.Comment) { */

        // Handle yaml's and other languages who use '#' as comment
        if (document.languageId === 'yml' || document.languageId === 'yaml') {
            const commentWord = document.getText(
                new vscode.Range(
                    position.translate(0, -position.character),
                    position.translate(0, -position.character + 1),
                ),
            );
            if (commentWord === '#') {
                return true;
            }
        }

        const commentWord = document.getText(
            new vscode.Range(
                position.translate(0, -position.character),
                position.translate(0, -position.character + 2),
            ),
        );

        if (commentWord !== '//') {
            return false;
        }
    }

    return true;
}

export async function shouldShowHover(document: vscode.TextDocument, position: vscode.Position): Promise<boolean> {
    if (document.lineAt(position.line).range.end.character > 10000) {
        return false;
    }

    return isComment(document, position);
}

export class PlainTextRenderer extends marked.Renderer {
    code(code: string): string {
        return code;
    }
    blockquote(quote: string): string {
        return quote;
    }
    html(_html: string): string {
        return '';
    }
    heading(text: string, _level: 1 | 2 | 3 | 4 | 5 | 6, _raw: string, _slugger: marked.Slugger): string {
        return text + ' ';
    }
    hr(): string {
        return '';
    }
    list(body: string, _ordered: boolean, _start: number): string {
        return body;
    }
    listitem(text: string): string {
        return ' ' + text;
    }
    checkbox(_checked: boolean): string {
        return '';
    }
    paragraph(text: string): string {
        return text + ' ';
    }
    table(header: string, body: string): string {
        return header + ' ' + body;
    }
    tablerow(content: string): string {
        return content;
    }
    tablecell(
        content: string,
        _flags: {
            header: boolean;
            align: 'center' | 'left' | 'right' | null;
        },
    ): string {
        return content;
    }
    strong(text: string): string {
        return text;
    }
    em(text: string): string {
        return text;
    }
    codespan(code: string): string {
        return `\\\`${code}\\\``;
    }
    br(): string {
        return ' ';
    }
    del(text: string): string {
        return text;
    }
    image(_href: string, _title: string, _text: string): string {
        return '';
    }
    text(text: string): string {
        return text;
    }
    link(href: string, title: string, text: string): string {
        return text + ' ';
    }
}
