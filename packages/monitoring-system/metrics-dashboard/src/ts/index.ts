// Copyright 2020 Google LLC
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
//

import {FirestoreListener} from './firestore/firestore-listener';

/**
 * Filters on metrics set by the user
 */
export interface UserFilters {
  timeRange?: {
    /* UNIX timestamp */
    start?: number;
    /* UNIX timestamp */
    end?: number;
  };
}

/**
 * Returns the current data filters set by the user
 *
 * TODO: Implement
 * Currently this just returns fixed values
 */
function getCurrentUserFilters(): UserFilters {
  return {
    timeRange: {
      start: new Date().getTime() - 60 * 60 * 1000,
    },
  };
}

/**
 * Start the Firestore listener on page load
 */
window.onload = () => {
  const currentFilters = getCurrentUserFilters();
  new FirestoreListener().resetListeners(currentFilters);
};

/**
 * TODO: Reset and start the Firestore listener
 * when user filters change
 */
