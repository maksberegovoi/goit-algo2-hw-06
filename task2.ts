import * as fs from "fs";
import * as readline from "readline";
import * as crypto from "crypto";
import { performance } from "perf_hooks";


async function loadIPsFromLog(filePath: string): Promise<string[]> {
    const ips: string[] = [];

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
    });

    for await (const line of rl) {
        try {
            const parsed = JSON.parse(line);
            if (typeof parsed.remote_addr === "string") {
                ips.push(parsed.remote_addr);
            }
        } catch {
            console.log('incorrect line: ', line)
        }
    }

    return ips;
}


function exactCountUnique(ips: string[]): number {
    return new Set(ips).size;
}


class HyperLogLog {
    private readonly p: number;
    private readonly m: number;
    private readonly registers: Uint8Array;
    private readonly alphaMM: number;

    constructor(p: number = 10) {
        this.p = p;
        this.m = 1 << p;
        this.registers = new Uint8Array(this.m);

        const alpha =
            this.m === 16
                ? 0.673
                : this.m === 32
                    ? 0.697
                    : this.m === 64
                        ? 0.709
                        : 0.7213 / (1 + 1.079 / this.m);

        this.alphaMM = alpha * this.m * this.m;
    }

    private hash(value: string): number {
        const hash = crypto.createHash("sha1").update(value).digest();
        return hash.readUInt32BE(0);
    }

    add(value: string): void {
        const hash = this.hash(value);
        const index = hash >>> (32 - this.p);
        const remaining = (hash << this.p) | (1 << (this.p - 1));

        const rank = Math.clz32(remaining) + 1;
        this.registers[index] = Math.max(this.registers[index], rank);
    }

    count(): number {
        let sum = 0;
        let zeros = 0;

        for (const reg of this.registers) {
            sum += Math.pow(2, -reg);
            if (reg === 0) zeros++;
        }

        let estimate = this.alphaMM / sum;

        if (estimate <= 2.5 * this.m && zeros !== 0) {
            estimate = this.m * Math.log(this.m / zeros);
        }

        return Math.round(estimate);
    }
}


async function compare(filePath: string): Promise<void> {
    const ips = await loadIPsFromLog(filePath);

    const exactStart = performance.now();
    const exactCount = exactCountUnique(ips);
    const exactTime = (performance.now() - exactStart) / 1000;

    const hll = new HyperLogLog(10);
    const hllStart = performance.now();
    for (const ip of ips) {
        hll.add(ip);
    }
    const hllCount = hll.count();
    const hllTime = (performance.now() - hllStart) / 1000;

    console.log("\nРезультати порівняння:");
    console.table({
        "Точний підрахунок": {
            "Унікальні елементи": exactCount,
            "Час виконання (сек.)": exactTime.toFixed(3),
        },
        HyperLogLog: {
            "Унікальні елементи": hllCount,
            "Час виконання (сек.)": hllTime.toFixed(3),
        },
    });
}

if (require.main === module) {
    compare("lms-stage-access.log").catch(console.error);
}
