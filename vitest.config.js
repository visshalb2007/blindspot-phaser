import { defineConfig } from 'vitest/config';

// The AI and world layers are deliberately Phaser-free, so the suite runs in a
// plain Node environment with no jsdom and no canvas stub.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/ai/**', 'src/world/**', 'src/utils/**'],
    },
  },
});
