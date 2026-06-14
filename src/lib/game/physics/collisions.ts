type Coordinate = { x: number, y: number };
type BoundarySide = 'left' | 'right' | 'top' | 'bottom';
type CollisionType = 'enter' | 'stay' | 'exit';
type UnsubscribeFn = () => void;

interface CollisionEvent {
    self: Collider;
    other: Collider;
    type: CollisionType;
}

interface BoundaryEvent {
    self: Collider;
    side: BoundarySide;
}

type CollisionHandler = (e: CollisionEvent) => void;
type BoundaryHandler = (e: BoundaryEvent) => void;

let _nextColliderId = 0;

/**
 * Collider class that handles collisions between DOM elements.
 * 
 * @param element - The DOM Element the collider is attached to
 * @param checkLayers - What layers to check for collisions
 * @param layers - The layer tags this collider is attached to
 * 
 */
class Collider {
    public readonly id = _nextColliderId++;
    public location!: Coordinate;

    private readonly collisionHandlers = new Set<CollisionHandler>();
    private readonly boundaryHandlers = new Set<BoundaryHandler>();
    
    constructor(
        private readonly element: HTMLElement, 
        public checkLayers: string[],
        public layers: string[], 
    ) {
        this.pollLocation();
    }


    /** Subscribe to collision lifecycle events.
     * 
     *  @returns Unsubscribe function (call it to stop listening)
     */
    public onCollision(handler: CollisionHandler): UnsubscribeFn {
        this.collisionHandlers.add(handler);
        return () => this.collisionHandlers.delete(handler);
    }

    /** Subscribe to boundary hit events.
     * 
     * @returns Unsubscribe function (call it to stop listening)
     */
    public onBoundary(handler: BoundaryHandler): UnsubscribeFn {
        this.boundaryHandlers.add(handler);
        return () => this.boundaryHandlers.delete(handler);
    }

    /** Returns true when this collider's AABB overlaps with another's */
    public isColliding(other: Collider): boolean {
        const a = this.element.getBoundingClientRect();
        const b = other.element.getBoundingClientRect();
 
        return (
            a.left   < b.right  &&
            a.right  > b.left   &&
            a.top    < b.bottom &&
            a.bottom > b.top
        );
    }

    /** Refresh the location. */
    public pollLocation(): void {
        const { left, top } = this.element.getBoundingClientRect();
        this.location = { x: left, y: top };
    }

    public getRect(): DOMRect { return this.element.getBoundingClientRect(); }
    public getElement(): HTMLElement { return this.element; }

    /** @internal */ public _emitCollision(e: CollisionEvent): void { this.collisionHandlers.forEach(h => h(e)); }
    /** @internal */ public _emitBoundary (e: BoundaryEvent ): void { this.boundaryHandlers .forEach(h => h(e)); }
}


class CollisionEngine {
    protected colliders: Collider[] = [];
    private activeCollisions = new Map<string, Set<number>>(); // id, set<id>
    private grid: SpatialGrid;

    constructor(
        public innerWidth: number,
        public innerHeight: number,
        gridCellSize: number = 100
    ) {
        this.grid = new SpatialGrid(gridCellSize);
    }

    public addCollider(c: Collider): void {
        this.colliders.push(c);
        this.activeCollisions.set(String(c.id), new Set());
    }

    public removeCollider(c: Collider): void {
        this.colliders = this.colliders.filter(x => x !== c);
        this.activeCollisions.delete(String(c.id));
    }

    public tick(): void {
        this.grid.clear();
        for (const c of this.colliders) {
            c.pollLocation();
            this.grid.insert(c);
        }

        const checked = new Set<string>();
        for (const a of this.colliders) {
            const candidates = this.broadPhase(a);

            for (const b of candidates) {
                const pairKey = a.id < b.id
                    ? `${a.id}:${b.id}`
                    : `${b.id}:${a.id}`;
                if (checked.has(pairKey)) continue;
                checked.add(pairKey);

                this.narrowPhase(a, b);
            }
        }

        for (const c of this.colliders) this.checkBoundary(c);
    }

    private broadPhase(a: Collider): Collider[] {
        const candidates = this.grid.query(a);
        return [...candidates].filter(b =>
            b.layers.some(layer => a.checkLayers.includes(layer))
        );
    }

    private narrowPhase(a: Collider, b: Collider): void {
        const aActive = this.activeCollisions.get(String(a.id))!;
        const bActive = this.activeCollisions.get(String(b.id))!;
        const wasColliding = aActive.has(b.id);
        const nowColliding  = a.isColliding(b);

        // WARNING: if statement chain incoming....
        if (nowColliding && !wasColliding) {
            aActive.add(b.id);
            bActive.add(a.id);
            a._emitCollision({ self: a, other: b, type: 'enter' });
            b._emitCollision({ self: b, other: a, type: 'enter' });
        } else if (nowColliding && wasColliding) {
            a._emitCollision({ self: a, other: b, type: 'stay' });
            b._emitCollision({ self: b, other: a, type: 'stay' });

        } else if (!nowColliding && wasColliding) {
            aActive.delete(b.id);
            bActive.delete(a.id);
            a._emitCollision({ self: a, other: b, type: 'exit' });
            b._emitCollision({ self: b, other: a, type: 'exit' });
        }
    }

    private checkBoundary(c: Collider): void {
        const rect = c.getRect();
        if (rect.left <= 0) c._emitBoundary({ self: c, side: 'left' });
        if (rect.right >= this.innerWidth) c._emitBoundary({ self: c, side: 'right' });
        if (rect.top <= 0) c._emitBoundary({ self: c, side: 'top' });
        if (rect.bottom >= this.innerHeight) c._emitBoundary({ self: c, side: 'bottom' });
    }
}

class SpatialGrid {
    private cells = new Map<string, Set<Collider>>();

    constructor(
        private cellSize: number = 100
    ) {}

    private key(cx: number, cy: number): string {
        return `${cx},${cy}`;
    }

    private cellsForRect(rect: DOMRect): [number, number][] {
        const minCX = Math.floor(rect.left   / this.cellSize);
        const maxCX = Math.floor(rect.right  / this.cellSize);
        const minCY = Math.floor(rect.top    / this.cellSize);
        const maxCY = Math.floor(rect.bottom / this.cellSize);

        const cells: [number, number][] = [];
        for (let cx = minCX; cx <= maxCX; cx++)
            for (let cy = minCY; cy <= maxCY; cy++)
                cells.push([cx, cy]);
        return cells;
    }

    public insert(collider: Collider): void {
        for (const [cx, cy] of this.cellsForRect(collider.getRect())) {
            const k = this.key(cx, cy);
            if (!this.cells.has(k)) this.cells.set(k, new Set());
            this.cells.get(k)!.add(collider);
        }
    }

    /** Returns candidate colliders near `collider`, excluding itself */
    public query(collider: Collider): Set<Collider> {
        const candidates = new Set<Collider>();
        for (const [cx, cy] of this.cellsForRect(collider.getRect())) {
            const cell = this.cells.get(this.key(cx, cy));
            if (!cell) continue;
            for (const c of cell)
                if (c !== collider) candidates.add(c);
        }
        return candidates;
    }

    public clear(): void {
        this.cells.clear();
    }


}