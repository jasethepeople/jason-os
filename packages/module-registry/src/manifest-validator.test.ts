// ============================================================
// Manifest Validator Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { ManifestValidator } from './manifest-validator.js';
import {
  ValidationError,
  type ModuleManifest,
  type ModuleCategory,
} from '@jason-os/shared';

// ------------------------------------------------------------------
// Fixtures
// ------------------------------------------------------------------

function createValidManifest(
  overrides: Partial<ModuleManifest> = {}
): ModuleManifest {
  return {
    id: 'test-module',
    name: 'Test Module',
    version: '1.0.0',
    category: 'PRODUCTIVITY' as ModuleCategory,
    description: 'A test module',
    author: 'Test Author',
    dependencies: [],
    optionalDependencies: [],
    permissions: ['storage'],
    events: {
      emits: ['test:started'],
      listens: ['test:stop'],
    },
    ...overrides,
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------

describe('ManifestValidator', () => {
  let validator: ManifestValidator;

  beforeEach(() => {
    validator = new ManifestValidator();
  });

  // 1. Valid manifest passes validation
  it('should validate a correct manifest', () => {
    const manifest = createValidManifest();
    const result = validator.validate(manifest);

    expect(result.id).toBe('test-module');
    expect(result.name).toBe('Test Module');
    expect(result.version).toBe('1.0.0');
    expect(result.category).toBe('PRODUCTIVITY');
    expect(result.dependencies).toEqual([]);
    expect(result.optionalDependencies).toEqual([]);
    expect(result.permissions).toEqual(['storage']);
    expect(result.events.emits).toEqual(['test:started']);
    expect(result.events.listens).toEqual(['test:stop']);
  });

  // 2. Validation rejects missing required field: id
  it('should reject manifest with missing id', () => {
    const manifest = { ...createValidManifest(), id: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 3. Validation rejects missing required field: name
  it('should reject manifest with missing name', () => {
    const manifest = { ...createValidManifest(), name: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 4. Validation rejects missing required field: version
  it('should reject manifest with missing version', () => {
    const manifest = { ...createValidManifest(), version: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 5. Validation rejects missing required field: category
  it('should reject manifest with missing category', () => {
    const manifest = { ...createValidManifest(), category: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 6. Validation rejects missing required field: dependencies
  it('should reject manifest with missing dependencies', () => {
    const manifest = { ...createValidManifest(), dependencies: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 7. Validation rejects missing required field: permissions
  it('should reject manifest with missing permissions', () => {
    const manifest = { ...createValidManifest(), permissions: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 8. Validation rejects missing required field: events
  it('should reject manifest with missing events', () => {
    const manifest = { ...createValidManifest(), events: undefined };
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 9. Validation rejects non-object input
  it('should reject null manifest', () => {
    expect(() => validator.validate(null)).toThrow(ValidationError);
  });

  it('should reject string manifest', () => {
    expect(() => validator.validate('not-an-object')).toThrow(ValidationError);
  });

  it('should reject number manifest', () => {
    expect(() => validator.validate(42)).toThrow(ValidationError);
  });

  it('should reject array manifest', () => {
    expect(() => validator.validate([])).toThrow(ValidationError);
  });

  // 10. Validation rejects empty id
  it('should reject empty string id', () => {
    const manifest = createValidManifest({ id: '' });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 11. Validation rejects empty name
  it('should reject empty string name', () => {
    const manifest = createValidManifest({ name: '' });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 12. Validation rejects invalid semver
  it('should reject invalid version format', () => {
    const manifest = createValidManifest({ version: 'not-a-version' });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  it('should reject version with only major.minor', () => {
    const manifest = createValidManifest({ version: '1.0' });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  it('should reject version with v prefix', () => {
    const manifest = createValidManifest({ version: 'v1.0.0' });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 13. Validation accepts valid semver
  it('should accept valid semver versions', () => {
    const validVersions = [
      '1.0.0',
      '0.0.1',
      '10.20.30',
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0+build.123',
      '1.0.0-alpha+build.123',
      '0.0.0',
    ];

    for (let i = 0; i < validVersions.length; i++) {
      const v = new ManifestValidator();
      const manifest = createValidManifest({ id: `semver-test-${i}`, version: validVersions[i] });
      const result = v.validate(manifest);
      expect(result.version).toBe(validVersions[i]);
    }
  });

  // 14. Validation rejects invalid category
  it('should reject invalid category', () => {
    const manifest = createValidManifest({ category: 'INVALID' as ModuleCategory });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 15. Validation accepts all valid categories
  it('should accept all valid categories', () => {
    const validCategories: ModuleCategory[] = [
      'EMOTIONAL',
      'IDENTITY',
      'PRODUCTIVITY',
      'NAVIGATION',
      'MEMORY',
      'COMMUNICATION',
      'PRIVACY',
    ];

    for (const category of validCategories) {
      const v = new ManifestValidator();
      const manifest = createValidManifest({
        id: `test-${category.toLowerCase()}`,
        category,
      });
      const result = v.validate(manifest);
      expect(result.category).toBe(category);
    }
  });

  // 16. Validation rejects duplicate IDs
  it('should reject duplicate module IDs', () => {
    const manifest1 = createValidManifest({ id: 'duplicate-id' });
    const manifest2 = createValidManifest({ id: 'duplicate-id' });

    validator.validate(manifest1);
    expect(() => validator.validate(manifest2)).toThrow(ValidationError);
  });

  // 17. Validation rejects empty dependency strings
  it('should reject empty strings in dependencies array', () => {
    const manifest = createValidManifest({ dependencies: [''] });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 18. Validation rejects non-string in dependencies array
  it('should reject non-strings in dependencies array', () => {
    const manifest = createValidManifest({
      dependencies: [123 as unknown as string],
    });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 19. Validation rejects invalid permission
  it('should reject invalid permission values', () => {
    const manifest = createValidManifest({
      permissions: ['invalid-perm' as unknown as 'storage'],
    });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 20. Validation rejects empty event type strings
  it('should reject empty event type strings in emits', () => {
    const manifest = createValidManifest({
      events: { emits: [''], listens: ['test:stop'] },
    });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  it('should reject empty event type strings in listens', () => {
    const manifest = createValidManifest({
      events: { emits: ['test:start'], listens: [''] },
    });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 21. Validation handles optionalDependencies defaults
  it('should default optionalDependencies to empty array when missing', () => {
    const manifest = { ...createValidManifest() };
    delete (manifest as Record<string, unknown>).optionalDependencies;
    const result = validator.validate(manifest);
    expect(result.optionalDependencies).toEqual([]);
  });

  // 22. Validation rejects invalid panelMode
  it('should reject invalid panelMode', () => {
    const manifest = createValidManifest({
      ui: {
        entryPoint: './index.js',
        icon: './icon.svg',
        panelMode: 'invalid' as 'tabbed',
      },
    });
    expect(() => validator.validate(manifest)).toThrow(ValidationError);
  });

  // 23. Validation accepts valid panelMode values
  it('should accept valid panelMode values', () => {
    const validModes = ['tabbed', 'split', 'overlay', 'fullscreen'] as const;

    for (const panelMode of validModes) {
      const v = new ManifestValidator();
      const manifest = createValidManifest({
        id: `test-${panelMode}`,
        ui: {
          entryPoint: './index.js',
          icon: './icon.svg',
          panelMode,
        },
      });
      const result = v.validate(manifest);
      expect(result.ui?.panelMode).toBe(panelMode);
    }
  });

  // 24. Validation handles optional fields
  it('should include optional fields when provided', () => {
    const manifest = createValidManifest({
      description: 'My description',
      author: 'My author',
    });
    const result = validator.validate(manifest);
    expect(result.description).toBe('My description');
    expect(result.author).toBe('My author');
  });

  // 25. Validation with external registered IDs set
  it('should respect externally provided registered IDs', () => {
    const manifest = createValidManifest({ id: 'external-id' });
    const registeredIds = new Set<string>();
    registeredIds.add('external-id');

    expect(() => validator.validate(manifest, registeredIds)).toThrow(
      ValidationError
    );
  });

  // 26. reset() clears internal state
  it('should allow re-registration after reset', () => {
    const manifest = createValidManifest({ id: 'reset-test' });
    validator.validate(manifest);

    // Should fail before reset
    expect(() => validator.validate(manifest)).toThrow(ValidationError);

    // Should succeed after reset
    validator.reset();
    const result = validator.validate(manifest);
    expect(result.id).toBe('reset-test');
  });
});
