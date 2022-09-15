// Copyright 2022 Google LLC
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

/**
 * A class for limiting flow for Cloud Task.
 *
 * @param delayInSeconds - The delay per batch.
 * @param batch - The number of items in a batch.
 *
 * This is a naive implementation for controling the flow into
 * Cloud Task.
 *
 * Caller should use the value returned from `getDelay()` and pass it to
 * `GCFBootstrapper.enqueueTask()` as `delayInSeconds` parameter.
 *
 * Here is how it works:
 *
 * Upon initialization, `itemSent` and `baseTime` is both set to 0.
 *
 * When (currentTime - baseTime) becomes bigger than `delayInSeconds`
 * (the first call should fall into this case), it will reset the
 * `baseTime` to the currentTime and reset the `itemSent` to 0.
 *
 * Then the `delay` is calculated as:
 * max (0, (baseTime - currentTime))
 *
 * Then increment the `itemSent` by 1.
 *
 * When number of item reaches the batch number, it will increment the
 * baseTime by `delayInSeconds` and reset the `itemSent`.
 */
export class FlowLimiter {
  delayInSeconds: number;
  batch: number;
  itemSent: number;
  baseTime: number;

  constructor(delayInSeconds: number, batch: number) {
    this.delayInSeconds = delayInSeconds;
    this.batch = batch;
    this.itemSent = 0;
    this.baseTime = 0;
  }

  getDelay(): number {
    const currentTime = Date.now() / 1000;
    if (currentTime - this.baseTime > this.delayInSeconds) {
      this.baseTime = currentTime;
      this.itemSent = 0;
    }
    const ret = Math.max(0, this.baseTime - currentTime);
    this.itemSent += 1;
    if (this.itemSent >= this.batch) {
      this.baseTime += this.delayInSeconds;
      this.itemSent = 0;
    }
    return ret;
  }
}
