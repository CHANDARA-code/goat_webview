module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  moduleNameMapper: {
    "^react-native/Libraries/Utilities/codegenNativeComponent$":
      "<rootDir>/__mocks__/codegenNativeComponent.ts",
    "^react-native/Libraries/Utilities/codegenNativeCommands$":
      "<rootDir>/__mocks__/codegenNativeCommands.ts",
    "^react-native$": "<rootDir>/__mocks__/react-native.ts",
  },
};
