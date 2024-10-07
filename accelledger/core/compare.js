import crypto from 'crypto';
import { Price } from './prices';

const IGNORED_FIELD_NAMES = new Set(['meta', 'diff_amount']);

function stableHashObject(obj, ignore = new Set()) {
    const hash = crypto.createHash('md5');
    
    for (const [key, value] of Object.entries(obj)) {
        if (ignore.has(key)) continue;
        
        if (Array.isArray(value) || value instanceof Set) {
            const subhashes = [];
            for (const element of value) {
                if (typeof element === 'object' && element !== null) {
                    subhashes.push(stableHashObject(element, ignore));
                } else {
                    const md5 = crypto.createHash('md5');
                    md5.update(String(element));
                    subhashes.push(md5.digest('hex'));
                }
            }
            subhashes.sort().forEach(subhash => hash.update(subhash));
        } else {
            hash.update(String(value));
        }
    }
    
    return hash.digest('hex');
}

function hashEntry(entry, excludeMeta = false) {
    return stableHashObject(entry, excludeMeta ? IGNORED_FIELD_NAMES : new Set());
}

function hashEntries(entries, excludeMeta = false) {
    const entryHashDict = {};
    const errors = [];
    let numLegalDuplicates = 0;

    for (const entry of entries) {
        const hash = hashEntry(entry, excludeMeta);

        if (hash in entryHashDict) {
            if (entry instanceof Price) {
                numLegalDuplicates++;
            } else {
                const otherEntry = entryHashDict[hash];
                errors.push({
                    source: entry.meta,
                    message: `Duplicate entry: ${entry} == ${otherEntry}`,
                    entry: entry
                });
            }
        }
        entryHashDict[hash] = entry;
    }

    if (errors.length === 0) {
        console.assert(
            Object.keys(entryHashDict).length + numLegalDuplicates === entries.length,
            `Hash count mismatch: ${Object.keys(entryHashDict).length}, ${entries.length}, ${numLegalDuplicates}`
        );
    }

    return { entryHashDict, errors };
}

function compareEntries(oldEntries, newEntries, excludeMeta = false) {
    const { entryHashDict: oldDict } = hashEntries(oldEntries, excludeMeta);
    const { entryHashDict: newDict } = hashEntries(newEntries, excludeMeta);

    const added = [];
    const removed = [];
    const modified = [];

    for (const [hash, entry] of Object.entries(newDict)) {
        if (!(hash in oldDict)) {
            added.push(entry);
        } else if (JSON.stringify(entry) !== JSON.stringify(oldDict[hash])) {
            modified.push({ old: oldDict[hash], new: entry });
        }
    }

    for (const [hash, entry] of Object.entries(oldDict)) {
        if (!(hash in newDict)) {
            removed.push(entry);
        }
    }

    return { added, removed, modified };
}

function includesEntries(subset, superset, excludeMeta = false) {
    const { entryHashDict: subsetDict } = hashEntries(subset, excludeMeta);
    const { entryHashDict: supersetDict } = hashEntries(superset, excludeMeta);

    for (const hash of Object.keys(subsetDict)) {
        if (!(hash in supersetDict)) {
            return false;
        }
    }

    return true;
}

function excludesEntries(excludedSet, mainSet, excludeMeta = false) {
    const { entryHashDict: excludedDict } = hashEntries(excludedSet, excludeMeta);
    const { entryHashDict: mainDict } = hashEntries(mainSet, excludeMeta);

    for (const hash of Object.keys(excludedDict)) {
        if (hash in mainDict) {
            return false;
        }
    }

    return true;
}

export {
    stableHashObject,
    hashEntry,
    hashEntries,
    compareEntries,
    includesEntries,
    excludesEntries,
};