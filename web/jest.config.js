module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@cli/(.*)$': '<rootDir>/../src/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathPattern: '__tests__',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'commonjs' } }],
  },
};
