import { describe, expect, test } from 'bun:test'
import { salonCollections } from '../src/shared/ombrine'

describe('salonCollections', () => {
  test('groups by trimmed name in first-look order, with unnamed looks as one row', () => {
    const looks = [{ id: 1, collection: 'Evening' }, { id: 2, collection: null }, { id: 3, collection: ' Evening ' }, { id: 4, collection: 'Weekend' }, { id: 5, collection: '' }]
    expect(salonCollections(looks).map(({ name, looks }) => [name, looks.map(({ id }) => id)])).toEqual([
      ['Evening', [1, 3]], ['The salon', [2, 5]], ['Weekend', [4]],
    ])
  })
})
