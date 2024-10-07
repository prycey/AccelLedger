import fs from 'fs';
import readline from 'readline';

class LexerError extends Error {
  constructor(source, message, entry) {
    super(message);
    this.source = source;
    this.entry = entry;
  }
}

class LexBuilder {
  constructor() {
    this.errors = [];
  }

  buildLexerError(filename, lineno, message) {
    this.errors.push(new LexerError(
      { filename, lineno }, // Simplified metadata
      message,
      null
    ));
  }
}

async function* lexIter(file, builder = null) {
  if (!builder) {
    builder = new LexBuilder();
  }

  const fileStream = typeof file === 'string'
    ? fs.createReadStream(file)
    : file;

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineno = 0;

  for await (const line of rl) {
    lineno++;
    const words = line.split(/\s+/);
    for (const word of words) {
      if (word) {
        yield { token: 'WORD', lineno, text: word, value: word };
      }
    }
  }
}

function lexIterString(string, builder = null) {
  const buffer = Buffer.from(string, 'utf8');
  const stream = require('stream');
  const readableStream = new stream.Readable();
  readableStream.push(buffer);
  readableStream.push(null);

  return lexIter(readableStream, builder);
}

export { LexerError, LexBuilder, lexIter, lexIterString };