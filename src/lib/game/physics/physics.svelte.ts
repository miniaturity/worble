type Vector = { angle: number, magnitude: number };
type Vec2 = { x: number; y: number };

export function vectorToVec2({ angle, magnitude }: Vector): Vec2 {
    return {
        x: Math.cos(angle) * magnitude,
        y: Math.sin(angle) * magnitude,
    };
}

export function vec2Add(a: Vec2, b: Vec2): Vec2 {
    return { x: a.x + b.x, y: a.y + b.y };
}

class Entity {
    public lifetime: number = 0;
    public readonly spawnedAt: number = Date.now();

    constructor(
        public readonly id: string,
        public name: string,
        public collider: Collider,
        protected onDestroy: (e: Entity) => void,
        
        public despawnAt?: number
    ) {}

    public tick() {
        this.lifetime++;
        if (this.lifetime === this.despawnAt) this.onDestroy(this);
    }

    public destroy() {
        this.onDestroy(this);
    }
}

class DynamicEntity extends Entity {
    private element: HTMLElement;

    public velocity = $state<Vec2>({ x: 0, y: 0 });
    public position = $state<Vec2>({ x: 0, y: 0 });

    private pendingImpulses: Vec2[] = [];
    
    public drag: number = 0;
    public gravity: number = 0;

    constructor(
        ...args: ConstructorParameters<typeof Entity>
    ) {
        super(...args);

        this.element = this.collider.getElement();
        const rect = this.element.getBoundingClientRect();
        this.position = { x: rect.left, y: rect.top };

        $effect(() => {
            this.element.style.transform =
                `translate(${this.position.x}px, ${this.position.y}px)`;
        });
    }

    public applyImpulse(v: Vector): void {
        this.pendingImpulses.push(vectorToVec2(v));
    }

    public setVelocity(v: Vector): void {
        this.velocity = vectorToVec2(v);
    }

    public addVelocity(v: Vector): void {
        const delta = vectorToVec2(v);
        this.velocity = vec2Add(this.velocity, delta);
    }

    public override tick(): void {
        for (const impulse of this.pendingImpulses)
            this.velocity = vec2Add(this.velocity, impulse);
        this.pendingImpulses = [];

        this.velocity = { ...this.velocity, y: this.velocity.y + this.gravity };

        this.velocity = {
            x: this.velocity.x * (1 - this.drag),
            y: this.velocity.y * (1 - this.drag),
        };

        this.position = vec2Add(this.position, this.velocity);

        this.lifetime++;
        if (this.lifetime === this.despawnAt) this.onDestroy(this);
    }
}
