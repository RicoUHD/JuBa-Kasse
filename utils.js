export function parseAmount(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    // Replace comma with dot
    const normalized = val.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
}

export function parseAmountStrict(val) {
    if (!val) return NaN;
    if (typeof val === 'number') return val;
    // Replace comma with dot
    const normalized = val.replace(',', '.');
    return parseFloat(normalized);
}
