export class Game {
    private readonly MAX_WORD_LEN = 5;
    private readonly MAX_MULT = 5;
    private _score: number = 0;
    private _mult: number = 1;
    private _maxHealth: number = 100;
    private _health: number = 0;
    private _targetWord: string;

    set score(val: number) { this._score = val; }
    get score() { return this._score; }
    public addScore(val: number) { this._score += val * this.mult; }

    set mult(val: number) { this._mult = clamp(0, val, this.MAX_MULT); }
    get mult() { return this._mult; }

    set maxHealth(val: number) { this._maxHealth = val; }
    get maxHealth() { return this._maxHealth; }

    set health(val: number) { this._health = clamp(0, val, this.maxHealth) }
    get health() { return this._health; }

    set targetWord(val: string) { 
        if (val.length > this.MAX_WORD_LEN) {
            console.error("Target word exceeds MAX_WORD_LEN val=" + val);
            return;
        }
        this._targetWord = val; 
    }
    get targetWord() { return this._targetWord; }

    constructor(
        word: string,
        score: number = 0,
    ) {
        this.score = score;
        this._targetWord = word;
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

    public clear(): void { this.words.clear() }
    
    public setFromArray(arr: Word[]): void {
        this.clear();

        for (const w of arr) 
            this.words.append(w);
    }


}

export function toWord(guess: string, target: string): Word {
    const guessChars = guess.toLowerCase().trim().split('');
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

type ModifierTicker = (tick: number) => void;
type EndHandler = (m: Modifier) => void;

class Modifier {
    private static nextid: number = 0;
    public readonly id: number;

    private lifespan: number = 0;

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
        this._tick(this.lifespan);
        this.lifespan++;
        if (this.lifespan === this.lifetime) {
            this.onEnd(this);
            this.lifespan = -1;
        }
    }
}

export class KeyboardModifier extends Modifier {

    constructor(
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