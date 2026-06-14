class ListNode<T> {
    public next: ListNode<T> | null = null;

    constructor(public value: T, next: ListNode<T> | null = null) {
        this.next = next;
    }
}

class LinkedList<T> {
    private head: ListNode<T> | null = null;
    private tail: ListNode<T> | null = null;
    private _size: number = 0;

    public get size(): number { return this._size; }
    public isEmpty(): boolean { return this._size === 0; }
    
    public prepend(value: T): void {
        const newNode = new ListNode<T>(value, this.head);
        this.head = newNode;

        if (!this.tail) {
            this.tail = newNode;
        }

        this._size++;
    }

    public append(value: T): void {
        const newNode = new ListNode<T>(value);

        if (!this.head || !this.tail) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }

        this._size++;
    }

    public deleteHead(): T | null {
        if (!this.head) return null;

        const deletedValue = this.head.value;
        this.head = this.head.next;
        this._size--;

        if (this._size === 0) {
        this.tail = null;
        }

        return deletedValue;
    }

    public find(value: T): ListNode<T> | null {
        let current = this.head;

        while (current) {
            if (current.value === value) 
                return current;
            current = current.next;
        }

        return null;
    }

    public toArray(): T[] {
        const elements: T[] = [];
        let current = this.head;

        while (current) {
        elements.push(current.value);
        current = current.next;
        }

        return elements;
    }

    public clear(): T[] {
        const arr = this.toArray();

        this.head = null;
        this.tail = null;

        this._size = 0;
        return arr;
    }
}
