export async function ignoreFailure(
  promise: Promise<unknown>
): Promise<void> {
  try {
    await promise;
  } catch {}
}

export function expectAddress(
  actual: { toString(): string },
  expected: { toString(): string }
): void {
  expect(actual.toString()).toEqual(
    expected.toString()
  );
}

export function expectOptionalAddress(
  actual: { toString(): string } | null,
  expected: { toString(): string }
): void {
  expect(actual).not.toBeNull();

  expect(actual!.toString()).toEqual(
    expected.toString()
  );
}