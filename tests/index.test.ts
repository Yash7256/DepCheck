import { describe, expect, it } from 'vitest';

import { packageName } from '../src/index.js';

describe('project foundation', () => {
  it('exports the package name', () => {
    expect(packageName).toBe('DepCheck');
  });
});
