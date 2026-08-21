import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAttendancePreflight, validateCupQuantity } from '../src/modules/favy/favyGuards.js'

test('attendance accepts both required photos without geolocation', () => {
  assert.equal(validateAttendancePreflight({
    selfie: 'data:image/jpeg;base64,a',
    facade: 'data:image/jpeg;base64,b',
  }).ok, true)
})

test('attendance rejects a missing required photo', () => {
  assert.equal(validateAttendancePreflight({
    selfie: '',
    facade: 'data:image/jpeg;base64,b',
  }).ok, false)
})

test('cup quantity must be a positive integer', () => {
  assert.equal(validateCupQuantity(0).ok, false)
  assert.equal(validateCupQuantity(3.5).ok, false)
  assert.equal(validateCupQuantity(12).ok, true)
})
