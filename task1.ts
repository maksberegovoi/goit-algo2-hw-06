class BloomFilter {
    private size: number;
    private numHashes: number;
    private bitArray: Uint8Array;

    constructor(size: number, numHashes: number) {
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error("size must be a positive integer");
        }
        if (!Number.isInteger(numHashes) || numHashes <= 0) {
            throw new Error("numHashes must be a positive integer");
        }

        this.size = size;
        this.numHashes = numHashes;
        this.bitArray = new Uint8Array(size);
    }

    private hash(value: string, seed: number): number {
        let hash = seed;
        for (let i = 0; i < value.length; i++) {
            hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
        }
        return hash % this.size;
    }

    add(value: unknown): void {
        if (typeof value !== "string" || value.length === 0) {
            return;
        }

        for (let i = 0; i < this.numHashes; i++) {
            const index = this.hash(value, i + 1);
            this.bitArray[index] = 1;
        }
    }

    contains(value: unknown): boolean {
        if (typeof value !== "string" || value.length === 0) {
            return false;
        }

        for (let i = 0; i < this.numHashes; i++) {
            const index = this.hash(value, i + 1);
            if (this.bitArray[index] === 0) {
                return false;
            }
        }
        return true;
    }
}

type PasswordCheckResult = "вже використаний" | "унікальний";

function check_password_uniqueness(
    bloom: BloomFilter,
    passwords: unknown[]
): Record<string, PasswordCheckResult> {
    const result: Record<string, PasswordCheckResult> = {};

    for (const password of passwords) {
        const key = String(password);

        if (bloom.contains(password)) {
            result[key] = "вже використаний";
        } else {
            result[key] = "унікальний";
            bloom.add(password);
        }
    }

    return result;
}

if (require.main === module) {
    const bloom = new BloomFilter(1000, 3);

    const existing_passwords = ["password123", "admin123", "qwerty123"];
    for (const password of existing_passwords) {
        bloom.add(password);
    }

    const new_passwords_to_check = [
        "password123",
        "newpassword",
        "admin123",
        "guest",
    ];

    const results = check_password_uniqueness(
        bloom,
        new_passwords_to_check
    );

    for (const [password, status] of Object.entries(results)) {
        console.log(`Пароль '${password}' — ${status}.`);
    }
}
