// Copyright 2024 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {ConfigurationOptions} from './config';

const CONTRIBUTOR_AUTHOR_ASSOCIATIONS = new Set(['OWNER', 'COLLABORATOR']);
/**
 * Determine whether or not the PR author is considered a repository contributor.
 *
 * @param {string} authorAssociation The type of user that the PR author is
 * @return {boolean} Whether or not the author is considered a repository contributor
 */
export function isContributor(authorAssociation: string): boolean {
  return CONTRIBUTOR_AUTHOR_ASSOCIATIONS.has(authorAssociation);
}

/**
 * For a given configuration, build instructions for what labels/comments a
 * maintainer should make to do the equivalent of what this bot would do if
 * the contributor was trusted.
 *
 * @param {ConfigurationOptions} configuration The bot configuration
 * @return {string|undefined} Returns undefined if no comment should be made.
 *   Otherwise returns a string message to comment.
 */
export function buildComment(
  configuration: ConfigurationOptions
): string | undefined {
  const annotations = configuration.annotations ?? [];
  const activities: string[] = [];
  for (const annotation of annotations) {
    // The annotation text could be a string or array of strings. Normalize to
    // an array of strings and enumerate.
    const textEntries =
      typeof annotation.text === 'string' ? [annotation.text] : annotation.text;
    for (const textEntry of textEntries) {
      if (annotation.type === 'comment') {
        activities.push(`comment on this pull request with \`${textEntry}\``);
      } else if (annotation.type === 'label') {
        activities.push(`add the \`${textEntry}\` label to this pull request`);
      }
    }
  }
  if (activities.length === 0) {
    return undefined;
  }
  // oxford comma
  const activityList =
    activities.length === 2
      ? activities.join(' and ')
      : activities.length > 2
      ? activities
          .slice(0, activities.length - 1)
          .concat(`and ${activities.slice(-1)}`)
          .join(', ')
      : activities.join(', ');
  return `Reviewers, you may need to ${activityList}.`;
}
