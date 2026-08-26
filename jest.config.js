/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.test.json" }],
  },
  moduleNameMapper: {
    "^azure-devops-extension-sdk$": "<rootDir>/src/__mocks__/azure-devops-extension-sdk.ts",
    "^azure-devops-extension-api.*$": "<rootDir>/src/__mocks__/azure-devops-extension-api.ts",
    "\\.(css|scss)$": "<rootDir>/src/__mocks__/styleMock.ts",
  },
  forceExit: true,
};
