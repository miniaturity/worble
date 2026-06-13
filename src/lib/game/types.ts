interface GameState {
    word: string;
    score: number;
    history: History;
    modifiers: Modifier[];
}

interface History {
    words: Word[];
}

interface Word {
    letters: Letter[];
    submittedAt: number;
    word: string;
}

interface Modifier {
    id: number;
    name: string;
    desc: string;
    icon: string;
}

interface KeyModifier extends Modifier {
    onSelect?: (letter: string, guess: string) => void;
    beforeSubmit?: (letter: string, guess: string) => void; // runs before letter is added to the current guess
    onSubmit?: (letter: string, guess: string) => void; // runs after the letter is added to the current guess
}

interface GuessModifier extends Modifier {
    onLetterAdded?: (letter: string, guess: string) => void;
    beforeGuess?: (guess: string) => void; // runs before guess is submitted
    afterGuess?: (guess: string) => void; // r
}

interface HistoryModifier extends Modifier {
    onGuess?: (guess: string, history: History) => void;
}

type Letter = {
    char: string;
    state: LetterState;
}

type LetterState = "green" | "yellow" | "gray"