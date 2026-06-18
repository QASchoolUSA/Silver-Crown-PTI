/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages/shared/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', 'firestore.rules.test.ts'],
  moduleNameMapper: {
    '^@silver-crown/shared$': '<rootDir>/packages/shared/src/index.ts',
  },
};
