import * as fs from 'fs';
import * as zlib from 'zlib';

const data = fs.readFileSync('test-attendance.pdf');
const out: string[] = [];

const findStreams = (buf: Buffer, start: number) => {
  const s = buf.toString('latin1');
  let idx = 0;
  while (idx < s.length) {
    const si = s.indexOf('stream', idx);
    if (si < 0) break;
    const nl = s.indexOf('\n', si);
    const lenStart = s.lastIndexOf('Length', si);
    const lenMatch = s.slice(lenStart, si).match(/Length\s+(\d+)/);
    let streamStart = nl + 1;
    let endIdx = s.indexOf('endstream', streamStart);
    let raw: Buffer;
    if (lenMatch) {
      const len = parseInt(lenMatch[1], 10);
      raw = buf.subarray(streamStart, streamStart + len);
    } else {
      raw = buf.subarray(streamStart, endIdx);
    }
    const head = s.slice(si - 40, si);
    if (head.includes('FlateDecode')) {
      try {
        const inflated = zlib.inflateSync(raw);
        out.push(inflated.toString('latin1'));
      } catch (e) {
        out.push('<<flate error>>');
      }
    }
    idx = endIdx + 10;
  }
};

findStreams(data, 0);
const all = out.join('\n');
// Extract text strings from PDF content: (text) Tj / TJ arrays
const texts: string[] = [];
const re = /\((?:[^()\\]|\\.)*\)/g;
let m;
while ((m = re.exec(all))) {
  texts.push(m[0].replace(/[()]/g, ''));
}
console.log(texts.join(' | '));