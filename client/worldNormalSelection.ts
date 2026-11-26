import type {Object3D, Scene, WebGLRenderer} from 'three';

type RenderList = ReturnType<WebGLRenderer['renderLists']['get']>;

/** Reuse the preceding world pass's projected items. Room furniture changes to AO proxies between passes. */
export class WorldNormalSelection {
  private readonly refreshRoots: Object3D[];
  private readonly refreshSet: Set<Object3D>;
  private list?: RenderList;
  private children?: Object3D[];
  private originalInit?: RenderList['init'];
  private originalFinish?: RenderList['finish'];

  constructor(private scene: Scene, rooms: readonly {object:Object3D}[]) {
    this.refreshSet = new Set();
    for (const {object} of rooms) {
      let root = object;
      while (root.parent && root.parent !== scene) root = root.parent;
      if (root.parent === scene) this.refreshSet.add(root);
    }
    this.refreshRoots = [...this.refreshSet];
  }

  use(list: RenderList) {
    this.list = list;
    this.originalInit = list.init;
    this.originalFinish = list.finish;
    list.init = this.keepWorldItems;
    list.finish = this.finishProjection;
  }

  private readonly keepWorldItems = () => {
    const list = this.list!;
    // In r170, leaving the item pool cursor after the world's items lets projectObject
    // append fresh room items without overwriting any retained group/material records.
    for (const bucket of [list.opaque, list.transmissive, list.transparent]) {
      let length = 0;
      for (const item of bucket) {
        let node: Object3D | null = item.object;
        while (node && node !== this.scene && node.visible && !this.refreshSet.has(node)) node = node.parent;
        // The sky is detached, and the normal pass has already hidden lines/points.
        if (node === this.scene && item.material.visible) bucket[length++] = item;
      }
      bucket.length = length;
    }
    this.children = this.scene.children;
    this.scene.children = this.refreshRoots;
  };

  private readonly finishProjection = () => {
    if (this.children) this.scene.children = this.children;
    this.children = undefined;
    this.originalFinish!.call(this.list);
  };

  restore() {
    if (!this.list) return;
    if (this.children) this.scene.children = this.children;
    this.list.init = this.originalInit!;
    this.list.finish = this.originalFinish!;
    this.children = undefined;
    this.list = undefined;
  }
}
