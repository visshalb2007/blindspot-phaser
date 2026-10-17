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
    const node = this.heap[index];
    const length = this.heap.length;
    let i = index;

    for (;;) {
      const left = 2 * i + 1;
      const right = left + 1;
      let smallest = i;

      if (left < length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest === i) break;

      this.heap[i] = this.heap[smallest];
      i = smallest;
    }

    this.heap[i] = node;
  }
}

export default PriorityQueue;
