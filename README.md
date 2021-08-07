# eslint-utils2

[![npm version](https://img.shields.io/npm/v/eslint-utils2.svg)](https://www.npmjs.com/package/eslint-utils2)
[![Downloads/month](https://img.shields.io/npm/dm/eslint-utils2.svg)](http://www.npmtrends.com/eslint-utils2)
[![Build Status](https://github.com/imhele/eslint-utils/workflows/CI/badge.svg)](https://github.com/imhele/eslint-utils/actions)
[![Coverage Status](https://codecov.io/gh/imhele/eslint-utils/branch/master/graph/badge.svg)](https://codecov.io/gh/imhele/eslint-utils)
[![Dependency Status](https://david-dm.org/imhele/eslint-utils.svg)](https://david-dm.org/imhele/eslint-utils)

在 [eslint-utils](https://github.com/mysticatea/eslint-utils) 基础上优化 ReferenceTracker ，以支持通配符，例如：

```js
import { ReferenceTracker } from "eslint-utils";

export default {
  meta: {},
  create(context) {
    return {
      "Program:exit"() {
        const tracker = new ReferenceTracker(context.getScope());
        const traceMap = {
          // Find `console.*` .
          console: {
            [ReferenceTracker.SingleLevelWildcard]: {
              [ReferenceTracker.READ]: true,
            },
          },
          // Find `Object.prototype.**.bind()` .
          Object: {
            prototype: {
              [ReferenceTracker.MultiLevelWildcard]: {
                bind: {
                  [ReferenceTracker.CALL]: true,
                },
              },
            },
          },
        };

        for (const { node, path } of tracker.iterateGlobalReferences(
          traceMap
        )) {
          context.report({
            node,
            message: "disallow {{name}}.",
            data: { name: path.join(".") },
          });
        }
      },
    };
  },
};
```

> 以下是 [eslint-utils](https://github.com/mysticatea/eslint-utils) README 原文。

## 🏁 Goal

This package provides utility functions and classes for make ESLint custom rules.

For examples:

- [getStaticValue](https://eslint-utils.mysticatea.dev/api/ast-utils.html#getstaticvalue) evaluates static value on AST.
- [ReferenceTracker](https://eslint-utils.mysticatea.dev/api/scope-utils.html#referencetracker-class) checks the members of modules/globals as handling assignments and destructuring.

## 📖 Usage

See [documentation](https://eslint-utils.mysticatea.dev/).

## 📰 Changelog

See [releases](https://github.com/mysticatea/eslint-utils/releases).

## ❤️ Contributing

Welcome contributing!

Please use GitHub's Issues/PRs.

### Development Tools

- `npm test` runs tests and measures coverage.
- `npm run clean` removes the coverage result of `npm test` command.
- `npm run coverage` shows the coverage result of the last `npm test` command.
- `npm run lint` runs ESLint.
- `npm run watch` runs tests on each file change.
