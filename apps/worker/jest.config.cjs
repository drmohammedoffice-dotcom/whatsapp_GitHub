module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^@watsapp/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@watsapp/database$': '<rootDir>/../../packages/database/src/index.ts',
  },
  testEnvironment: 'node',
};
