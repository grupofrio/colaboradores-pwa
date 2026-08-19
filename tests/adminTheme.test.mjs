import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ADMIN_THEME_SCOPE_STYLE,
  getAdminThemeScopeStyle,
} from '../src/modules/admin/adminTheme.js'

test('admin theme scope uses a light background, no inversion filter', () => {
  assert.deepEqual(ADMIN_THEME_SCOPE_STYLE, {
    minHeight: '100dvh',
    background: '#F0F9FF',
  })
})

test('getAdminThemeScopeStyle merges overrides last', () => {
  assert.deepEqual(
    getAdminThemeScopeStyle({ paddingBottom: '24px', background: '#111111' }),
    {
      minHeight: '100dvh',
      background: '#111111',
      paddingBottom: '24px',
    },
  )
})
