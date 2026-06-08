import DiffMatchPatch from 'diff-match-patch'

export interface DiffToken {
  text: string
  changed: boolean
}

const dmp = new DiffMatchPatch.diff_match_patch()

export function computeDiff(original: string, corrected: string): DiffToken[] {
  if (original === corrected) {
    return [{ text: original, changed: false }]
  }

  const diffs = dmp.diff_main(original, corrected)
  dmp.diff_cleanupSemantic(diffs)

  const result: DiffToken[] = []
  for (const [type, text] of diffs) {
    if (type === -1) {
      // deletado — não incluir no resultado
      continue
    }
    result.push({
      text,
      changed: type !== 0,
    })
  }
  return result
}
