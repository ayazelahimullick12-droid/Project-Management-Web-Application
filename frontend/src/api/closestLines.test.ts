import { describe, expect, it } from 'vitest'
import { closestLines } from './documents'

describe('closestLines', () => {
  const lines = ['Automatic daily reconciliation (OBJ-1)', 'Tracing every difference within 2 working days (OBJ-2)', 'One view of open differences for area managers']
  it('puts the line sharing most words with the question first', () => {
    expect(closestLines(lines, 'How fast must differences be traced?', 2)[0]).toBe('Tracing every difference within 2 working days (OBJ-2)')
  })
  it('returns nothing when no words match', () => {
    expect(closestLines(lines, 'What is the budget?', 2)).toEqual([])
  })
})
