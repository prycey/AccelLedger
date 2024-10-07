// Generic utility packages and functions.

const __copyright__ = "Copyright (C) 2014-2017  Martin Blais";
const __license__ = "GNU GPLv2";

const { performance } = require('perf_hooks');

function deprecated(message) {
    return function(target, key, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args) {
            console.warn(`Call to deprecated function ${key}: ${message}`);
            return originalMethod.apply(this, args);
        };
        return descriptor;
    };
}

function logTime(operationName, logTimings, indent = 0) {
    return function(target, key, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args) {
            const time1 = performance.now();
            const result = originalMethod.apply(this, args);
            const time2 = performance.now();
            if (logTimings) {
                logTimings(`Operation: ${operationName.padEnd(48)} Time: ${'      '.repeat(indent)}${(time2 - time1).toFixed(0)} ms`);
            }
            return result;
        };
        return descriptor;
    };
}

function box(name = null, file = null) {
    return function(target, key, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args) {
            const output = file || console.log;
            output('\n');
            let header, footer;
            if (name) {
                header = `,--------(${name})--------\n`;
                footer = `\`${'-'.repeat(header.length - 2)}\n`;
            } else {
                header = ',----------------\n';
                footer = '`----------------\n';
            }
            output(header);
            const result = originalMethod.apply(this, args);
            output(footer);
            return result;
        };
        return descriptor;
    };
}

function swallow(...exceptionTypes) {
    return function(target, key, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args) {
            try {
                return originalMethod.apply(this, args);
            } catch (exc) {
                if (!exceptionTypes.some(type => exc instanceof type)) {
                    throw exc;
                }
            }
        };
        return descriptor;
    };
}

function groupby(keyfun, elements) {
    const grouped = {};
    for (const element of elements) {
        const key = keyfun(element);
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(element);
    }
    return grouped;
}

function* filterType(elist, types) {
    for (const element of elist) {
        if (types.some(type => element instanceof type)) {
            yield element;
        }
    }
}

function longest(seq) {
    let longest = null;
    let length = -1;
    for (const element of seq) {
        if (element.length > length) {
            longest = element;
            length = element.length;
        }
    }
    return longest;
}

function* skipiter(iterable, numSkip) {
    let index = 0;
    for (const item of iterable) {
        if (index % numSkip === 0) {
            yield item;
        }
        index++;
    }
}

function* getTupleValues(ntuple, predicate, memo = new Set()) {
    const idNtuple = ntuple.toString();
    if (memo.has(idNtuple)) {
        return;
    }
    memo.add(idNtuple);

    if (predicate(ntuple)) {
        yield ntuple;
    }
    for (const attribute of Object.values(ntuple)) {
        if (predicate(attribute)) {
            yield attribute;
        }
        if (Array.isArray(attribute) || typeof attribute === 'object') {
            yield* getTupleValues(attribute, predicate, memo);
        }
    }
}

function replaceNamedtupleValues(ntuple, predicate, mapper, memo = new Set()) {
    const idNtuple = ntuple.toString();
    if (memo.has(idNtuple)) {
        return null;
    }
    memo.add(idNtuple);

    if (typeof ntuple !== 'object' || ntuple === null) {
        return ntuple;
    }

    const replacements = {};
    for (const [key, value] of Object.entries(ntuple)) {
        if (predicate(value)) {
            replacements[key] = mapper(value);
        } else if (typeof value === 'object' && value !== null) {
            replacements[key] = replaceNamedtupleValues(value, predicate, mapper, memo);
        } else if (Array.isArray(value)) {
            replacements[key] = value.map(item => replaceNamedtupleValues(item, predicate, mapper, memo));
        } else {
            replacements[key] = value;
        }
    }
    return { ...ntuple, ...replacements };
}

function computeUniqueCleanIds(strings) {
    const stringSet = new Set(strings);
    const regexps = [
        [/[^A-Za-z0-9.-]/g, '_'],
        [/[^A-Za-z0-9_]/g, ''],
    ];

    for (const [regexp, replacement] of regexps) {
        const seen = new Set();
        const idmap = {};
        for (const string of stringSet) {
            const id = string.replace(regexp, replacement);
            if (seen.has(id)) {
                break;
            }
            seen.add(id);
            idmap[id] = string;
        }
        if (Object.keys(idmap).length === stringSet.size) {
            return idmap;
        }
    }
    return null;
}

function escapeString(string) {
    return string.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function idify(string) {
    return string.replace(/[ ()]+/g, '_').replace(/_*\._*/g, '.').replace(/^_+|_+$/g, '');
}

function dictmap(mdict, keyfun = x => x, valfun = x => x) {
    return Object.fromEntries(
        Object.entries(mdict).map(([key, val]) => [keyfun(key), valfun(val)])
    );
}

function mapNamedtupleAttributes(attributes, mapper, object) {
    const updates = {};
    for (const attribute of attributes) {
        updates[attribute] = mapper(object[attribute]);
    }
    return { ...object, ...updates };
}

function staticvar(varname, initialValue) {
    return function(target, key, descriptor) {
        descriptor.value[varname] = initialValue;
        return descriptor;
    };
}

function firstParagraph(docstring) {
    const lines = docstring.trim().split('\n');
    const paragraph = [];
    for (const line of lines) {
        if (line.trim() === '') {
            break;
        }
        paragraph.push(line.trim());
    }
    return paragraph.join(' ');
}

// Note: The curses-related functions are not directly translatable to JavaScript
// as they are specific to terminal operations in Python. For a web-based application,
// you might want to use browser APIs or libraries like blessed for similar functionality.

class TypeComparable {
    equals(other) {
        return other.constructor === this.constructor && JSON.stringify(this) === JSON.stringify(other);
    }
}

function cmptuple(name, attributes) {
    const cls = class extends TypeComparable {
        constructor(...args) {
            super();
            attributes.forEach((attr, index) => {
                this[attr] = args[index];
            });
        }
    };
    Object.defineProperty(cls, 'name', { value: name });
    return cls;
}

function* uniquify(iterable, keyfunc = x => x, last = false) {
    const seen = new Set();
    if (last) {
        const uniqueReversedList = [];
        for (const obj of [...iterable].reverse()) {
            const key = keyfunc(obj);
            if (!seen.has(key)) {
                seen.add(key);
                uniqueReversedList.push(obj);
            }
        }
        yield* uniqueReversedList.reverse();
    } else {
        for (const obj of iterable) {
            const key = keyfunc(obj);
            if (!seen.has(key)) {
                seen.add(key);
                yield obj;
            }
        }
    }
}

const UNSET = Symbol('UNSET');

function* sortedUniquify(iterable, keyfunc = x => x, last = false) {
    const sorted = [...iterable].sort((a, b) => {
        const keyA = keyfunc(a);
        const keyB = keyfunc(b);
        return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

    if (last) {
        let prevObj = UNSET;
        let prevKey = UNSET;
        for (const obj of sorted) {
            const key = keyfunc(obj);
            if (key !== prevKey && prevObj !== UNSET) {
                yield prevObj;
            }
            prevObj = obj;
            prevKey = key;
        }
        if (prevObj !== UNSET) {
            yield prevObj;
        }
    } else {
        let prevKey = UNSET;
        for (const obj of sorted) {
            const key = keyfunc(obj);
            if (key !== prevKey) {
                yield obj;
                prevKey = key;
            }
        }
    }
}

function isSorted(iterable, key = x => x, cmp = (x, y) => x <= y) {
    const iterator = iterable[Symbol.iterator]();
    let prev = key(iterator.next().value);
    for (const element of iterator) {
        const current = key(element);
        if (!cmp(prev, current)) {
            return false;
        }
        prev = current;
    }
    return true;
}

class LineFileProxy {
    constructor(lineWriter, prefix = null, writeNewlines = false) {
        this.lineWriter = lineWriter;
        this.prefix = prefix;
        this.writeNewlines = writeNewlines;
        this.data = [];
    }

    write(data) {
        if (data.includes('\n')) {
            this.data.push(data);
            this.flush();
        } else {
            this.data.push(data);
        }
    }

    flush() {
        const data = this.data.join('');
        if (data) {
            const lines = data.split('\n');
            this.data = data[data.length - 1] !== '\n' ? [lines.pop()] : [];
            for (const line of lines) {
                let outputLine = this.prefix ? this.prefix + line : line;
                if (this.writeNewlines) {
                    outputLine += '\n';
                }
                this.lineWriter(outputLine);
            }
        }
    }

    close() {
        this.flush();
    }
}

module.exports = {
    deprecated,
    logTime,
    box,
    swallow,
    groupby,
    filterType,
    longest,
    skipiter,
    getTupleValues,
    replaceNamedtupleValues,
    computeUniqueCleanIds,
    escapeString,
    idify,
    dictmap,
    mapNamedtupleAttributes,
    staticvar,
    firstParagraph,
    TypeComparable,
    cmptuple,
    uniquify,
    sortedUniquify,
    isSorted,
    LineFileProxy,
};
