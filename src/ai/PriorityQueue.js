/**
 * A binary min-heap keyed by priority.
 *
 * A\* needs to pull the cheapest node off the open set on every iteration. A
 * sorted array is O(n log n) per insert and `shift()` on a plain array is O(n);
 * a heap keeps both push and pop at O(log n), which is what makes a 25 x 18
 * search cost microseconds instead of milliseconds.
 */
export class PriorityQueue {
  constructor() {
    /** @type {Array<{item: any, priority: number}>} */
    this.heap = [];
  }

  get size() {
    return this.heap.length;
  }

  get isEmpty() {
    return this.heap.length === 0;
  }

  clear() {
    this.heap.length = 0;
  }

  push(item, priority) {
    this.heap.push({ item, priority });
    this._bubbleUp(this.heap.length - 1);
    return this;
  }

  /**
   * Removes and returns the lowest-priority item.
   *
   * @returns {any|undefined} undefined when the queue is empty
   */
  pop() {
    if (this.heap.length === 0) return undefined;

    const top = this.heap[0];
    const last = this.heap.pop();

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }

    return top.item;
  }

  _bubbleUp(index) {
    const node = this.heap[index];
    let i = index;

    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.heap[parent].priority <= node.priority) break;

      this.heap[i] = this.heap[parent];
      i = parent;
    }

    this.heap[i] = node;
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const node = this.heap[index];
    let i = index;

    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;

      // Compare against the priority of the node being sunk, not against
      // `this.heap[i]`. That slot has already been overwritten by the previous
      // iteration of this loop, so reading it here would compare against a
      // value that is on its way up and stop the sink too early.
      let smallest = i;
      let smallestPriority = node.priority;

      if (left < length && this.heap[left].priority < smallestPriority) {
        smallest = left;
        smallestPriority = this.heap[left].priority;
      }

      if (right < length && this.heap[right].priority < smallestPriority) {
        smallest = right;
        smallestPriority = this.heap[right].priority;
      }

      if (smallest === i) break;

      this.heap[i] = this.heap[smallest];
      i = smallest;
    }

    this.heap[i] = node;
  }
}

export default PriorityQueue;
