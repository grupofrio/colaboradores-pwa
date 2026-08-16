import { readFileSync } from 'node:fs'

/** Canonical LF text so contract tests no dependen de autocrlf/Windows. */
export function readUtf8Lf(urlOrPath) {
  return readFileSync(urlOrPath).toString('utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function bufferUtf8Lf(urlOrPath) {
  return Buffer.from(readUtf8Lf(urlOrPath), 'utf8')
}
