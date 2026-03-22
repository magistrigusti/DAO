module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    testMatch: ['**/*.sandbox.test.ts'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    testTimeout: 30000,
};
