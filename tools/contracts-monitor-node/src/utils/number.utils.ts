export function absBigint(value: bigint): bigint {
    if (value < 0n) {
        return -value;
    }

    return value;
}

export function formatUnits(
    value: bigint,
    decimals: number
): string {
    if (decimals <= 0) {
        return value.toString();
    }

    const sign = value < 0n
        ? '-'
        : '';

    const abs = value < 0n
        ? -value
        : value;

    const divider = 10n ** BigInt(decimals);
    const integerPart = abs / divider;
    const fractionPart = abs % divider;

    const rawFraction = fractionPart
        .toString()
        .padStart(decimals, '0');

    const trimmedFraction = rawFraction.replace(/0+$/, '');

    if (!trimmedFraction) {
        return `${sign}${integerPart.toString()}`;
    }

    return `${sign}${integerPart.toString()}.${trimmedFraction}`;
}

export function formatRatio(
    numerator: bigint,
    numeratorDecimals: number,
    denominator: bigint,
    denominatorDecimals: number,
    precision = 9
): string {
    if (denominator === 0n) {
        return '0';
    }

    const safePrecision = precision < 0
        ? 0
        : precision;

    const numeratorScale = 10n ** BigInt(denominatorDecimals + safePrecision);
    const denominatorScale = 10n ** BigInt(numeratorDecimals);

    const scaledNumerator = numerator * numeratorScale;
    const scaledDenominator = denominator * denominatorScale;
    const result = scaledNumerator / scaledDenominator;

    return formatUnits(result, safePrecision);
}
