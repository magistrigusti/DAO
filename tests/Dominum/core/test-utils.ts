import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';

export function readContract(relativePath: string): string {
    const absolutePath = path.resolve(
        process.cwd(),
        relativePath
    );

    return readFileSync(absolutePath, 'utf8');
}

export function assertContains(
    source: string,
    needle: string,
    filePath: string
): void {
    assert.ok(
        source.includes(needle),
        `Ожидался фрагмент в ${filePath}: ${needle}`
    );
}

export function assertNotContains(
    source: string,
    needle: string,
    filePath: string
): void {
    assert.ok(
        !source.includes(needle),
        `Неожиданный фрагмент в ${filePath}: ${needle}`
    );
}

export function assertMatches(
    source: string,
    expression: RegExp,
    filePath: string,
    hint: string
): void {
    assert.ok(
        expression.test(source),
        `Не найдено в ${filePath}: ${hint}`
    );
}
