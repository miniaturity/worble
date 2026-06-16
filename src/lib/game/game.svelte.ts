import { DynamicEntity, Entity } from "./physics/physics.svelte";


type CreateEntityProps = { name: string, collider: Collider, onDestroy: (e: Entity) => void, despawnAt?: number };

export class GameState {
    private readonly MAX_WORD_LEN = 5;
    private readonly MAX_MULT = 5;

    private _score: number = 0;
    private _mult: number = 1;

    private _maxHealth: number = 100;
    private _health: number = 0;

    private _targetIndex: number = 0;
    private _targetWordList: string[];
    private _targetWord = $state<string>(""); // derived from _targetIndex

    private _solvedList = $state<string[]>([]);

    private _wordHistory: WordHistory;

    private _modifiers = $state<Modifier[]>([]);

    private _dynamicEntities = $state<DynamicEntity[]>([]);
    private _staticEntities: Entity[] = $state<Entity[]>([]);

    private _totalTicks: number = 0;

    private _currentGuess: string[] = [];

    set score(val: number) { this._score = val; }
    get score() { return this._score; }
    public addScore(val: number) { this._score += val * this.mult; }

    set mult(val: number) { this._mult = clamp(0, val, this.MAX_MULT); }
    get mult() { return this._mult; }

    set maxHealth(val: number) { this._maxHealth = val; }
    get maxHealth() { return this._maxHealth; }

    set health(val: number) { this._health = clamp(0, val, this.maxHealth) }
    get health() { return this._health; }

    get modifiers() { return this._modifiers; }

    get totalTicks() { return this._totalTicks; }

    set targetIndex(val: number) {
        this._targetIndex = val;
        this._targetWord = this._targetWordList[val];
    }

    set targetWord(val: string) { 
        if (val.length > this.MAX_WORD_LEN) {
            console.error("Target word exceeds MAX_WORD_LEN val=" + val);
            return;
        }
        this._targetWord = val; 
    }
    get targetWord() { return this._targetWord; }

    get dynamicEntities() { return this._dynamicEntities; }
    get staticEntities() { return this._staticEntities; }

    constructor(
        wordList: string[],
        dynamicEntities: DynamicEntity[],
        staticEntities: Entity[],
        score: number = 0,
    ) {
        this.score = score;
        this._targetWordList = wordList;
        this._targetWord = this._targetWordList[this._targetIndex];
        this._wordHistory = new WordHistory(new LinkedList<Word>(), this._targetWord, this.MAX_WORD_LEN);
        this._staticEntities = [...staticEntities];
        this._dynamicEntities = [...dynamicEntities];
    }

    public gametick(): number {
        for (const m of this.modifiers)
            m.tick();
        for (const e of this.staticEntities)
            e.tick();
        for (const e of this.dynamicEntities)
            e.tick();

        this._totalTicks++;
        return this._totalTicks;
    }

    public guess(): { word: Word, correct: boolean } | null {
        const guess = this._currentGuess.join();
        const word: Word = toWord(guess, this._targetWord);
        let canGuess: boolean = true;

        this.modifiers.forEach((m) => {
            if (m instanceof GuessModifier) {
                if(!m.beforeGuess(guess)) canGuess = false;
            }
        });

        if (!canGuess) return null;

        let correct = false;
        if (guess.toLowerCase() === this._targetWord) correct = true;

        this._wordHistory.append(word);

        this.modifiers.forEach((m) => {
            if (m instanceof GuessModifier) {
                m.onGuess(guess);
            }
        });

        if (correct) {
            this._solvedList.push(guess.toLowerCase());
        }

        this._currentGuess = [];
        return {
            word,
            correct
        }
    }

    public appendLetter(char: string): void {
        if (char.length === 0) return;

        for (const m of this.modifiers) {
            if (m instanceof KeyModifier)
                m.beforeKeySubmit(char, this._currentGuess.join());
        }

        this._currentGuess.push(char.toLowerCase().trim().charAt(0));

        for (const m of this.modifiers) {
            if (m instanceof KeyModifier)
                m.onKeySubmit(char, this._currentGuess.join());
        }
    }

    public deleteLetter(): void {
        const n = this._currentGuess.length;
        const charToDelete = this._currentGuess[n - 1];

        this.modifiers.forEach((m) => {
            if (m instanceof KeyModifier) {
                m.beforeDelete(charToDelete, this._currentGuess.join());
            }
        });

        this._currentGuess.pop();

        this.modifiers.forEach((m) => {
            if (m instanceof KeyModifier) {
                m.onDelete(charToDelete, this._currentGuess.join());
            }
        });
    }

    public hoverKey(char: string): void {
        this.modifiers.forEach((m) => {
            if (m instanceof KeyModifier) {
                m.onHover(char, this._currentGuess.join());
            }
        })
    }

    public createStaticEntity(args: CreateEntityProps) {
        const e = new Entity(   
            crypto.randomUUID(),
            args.name,
            args.collider,
            args.onDestroy,
            args.despawnAt
        )

        this._staticEntities.push(e);
    }

    public createDynamicEntity(args: CreateEntityProps) {
        const e = new DynamicEntity(   
            crypto.randomUUID(),
            args.name,
            args.collider,
            args.onDestroy,
            args.despawnAt
        )

        this._dynamicEntities.push(e);
    }

    
}

function clamp(min: number, val: number, max: number): number {
    return Math.min(Math.max(val, min), max);
};

export class WordHistory {
    constructor(
        public words = new LinkedList<Word>(),
        private target: string,
        private readonly WORD_LENGTH = target.length
    ) {}

    append(w: Word): void;
    append(word: string): void;

    public append(payload: Word | string): Word[] {
        if (typeof payload === "string") {
            if (payload.length > this.WORD_LENGTH) { 
                console.error("Payload length exceeds set word length.");
                return this.words.toArray(); 
            } 
            this.words.append(toWord(payload, this.target));
        } else {
            if (payload.word.length > this.WORD_LENGTH) {
                console.error("Payload length exceeds set word length.");
                return this.words.toArray();; 
            } 
            this.words.append(payload);
        }

        return this.words.toArray();
    }

    public clear(): Word[] { 
        return this.words.clear(); 
    }
    
    public fromArray(arr: Word[]): void {
        this.clear();
        for (const w of arr) 
            this.words.append(w);
    }
}

export function toWord(guess: string, target?: string): Word {
    const guessChars = guess.toLowerCase().trim().split('');

    if (!target) {
        const letters: Letter[] = new Array(guessChars.length);
        for (let i = 0; i < guessChars.length; i++) {
            letters[i] = { char: guessChars[i], state: "gray" };
        }

        return {
            letters,
            submittedAt: Date.now(),
            word: guess
        }
    }

    const targetChars = target.toLowerCase().trim().split('');
    const letters: Letter[] = new Array(guessChars.length);
    
    const remaining: (string | null)[ ] = [...targetChars];
    const isMatched = new Array(targetChars.length).fill(false);

    for (let i = 0; i < guessChars.length; i++) {
        if (guessChars[i] === targetChars[i]) {
            letters[i] = { char: guessChars[i], state: "green" };
            isMatched[i] = true;
            remaining[i] = null; 
        }
    }

    for (let i = 0; i < guessChars.length; i++) {
        if (letters[i]) continue; 

        const char = guessChars[i];
        const secretIndex = remaining.indexOf(char);

        if (secretIndex !== -1) {
            letters[i] = { char, state: "yellow" };
            remaining[secretIndex] = null;
        } else {
            letters[i] = { char, state: "gray" };
        }
    }

    return { 
        letters,
        submittedAt: Date.now(),
        word: guess 
    };
}

interface Word {
    letters: Letter[];
    submittedAt: number;
    word: string;
}

type ModifierTicker = (tick: number, m: Modifier) => void;
type EndHandler = (m: Modifier) => void;

class Modifier {
    private static nextid: number = 0;
    public readonly id: number;

    private lifespan: number = 0;

    public static assertModType<T extends Modifier>(m: Modifier, constructor: new (...args: any[]) => T): asserts m is T {
        if (!(m instanceof constructor)) {
            throw new Error("Modifier type assertion failed");
        }
    }

    constructor(
        private _name: string,
        private _lifetime: number = -1,
        private _tick: ModifierTicker,
        private onEnd: EndHandler
    ) {
        this.id = Modifier.nextid++;
    }

    get name() { return this._name; }
    get lifetime() { return this._lifetime; }

    public tick() {
        if (this.lifespan === -1) return;
        this._tick(this.lifespan, this);
        this.lifespan++;
        if (this.lifespan === this.lifetime) {
            this.onEnd(this);
            this.lifespan = -1;
        }
    }
}

export class GuessModifier extends Modifier {
    constructor(
        public readonly beforeGuess: (word: string) => boolean,
        public readonly onGuess: (word: string) => void,
        ...args: ConstructorParameters<typeof Modifier>
    ) {
        super(...args);
    }
}

export class KeyModifier extends Modifier {
    constructor(
        public readonly onHover: (char: string, word: string) => void,
        public readonly beforeKeySubmit: (charToSubmit: string, word: string) => boolean,
        public readonly onKeySubmit: (char: string, word: string) => void,
        public readonly beforeDelete: (charToDelete: string, word: string) => boolean,
        public readonly onDelete: (deletedChar: string, word: string) => void,
        ...args: ConstructorParameters<typeof Modifier>
    ) {
        super(...args);
    }
}


type Letter = {
    char: string;
    state: LetterState;
}

type LetterState = "green" | "yellow" | "gray"