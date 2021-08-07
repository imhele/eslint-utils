import assert from "assert"
import eslint from "eslint"
import semver from "semver"
import { CALL, CONSTRUCT, ESM, READ, ReferenceTracker } from "../src/"

const isESLint6 = semver.gte(eslint.Linter.version, "6.0.0")
const isESLint7 = semver.gte(eslint.Linter.version, "7.0.0")

const config = {
    parserOptions: {
        ecmaVersion: isESLint7 ? 2022 : isESLint6 ? 2020 : 2018,
        sourceType: "module",
    },
    globals: { Reflect: false },
    rules: { test: "error" },
}

describe("The 'ReferenceTracker' class:", () => {
    describe("the 'iterateGlobalReferences' method", () => {
        for (const { description, code, traceMap, expected } of [
            {
                description:
                    "should iterate the references of a given global variable.",
                code: "var x = Object; { let Object; var y = Object }",
                traceMap: {
                    Object: {
                        [READ]: 1,
                        foo: { [CALL]: 2 },
                        Foo: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given single level wildcard.",
                code: "var x = Object; { let Object; var y = Object }",
                traceMap: {
                    [ReferenceTracker.SingleLevelWildcard]: {
                        [READ]: 1,
                        foo: { [CALL]: 2 },
                        Foo: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given multi level wildcard.",
                code: "var x = Object; var y = Object.freeze[unknown]; Object(); new Object()",
                traceMap: {
                    [ReferenceTracker.MultiLevelWildcard]: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                    },
                },
                expected: [
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "Identifier" },
                        path: ["Object"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "freeze"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with MemberExpression",
                code: [
                    "Object.a; Object.a(); new Object.a();",
                    "Object.b; Object.b(); new Object.b();",
                    "Object.c; Object.c(); new Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate any member references of a given global variable, with MemberExpression",
                code: [
                    "Object.a; Object.a(); new Object.a();",
                    "Object.b; Object.b(); new Object.b();",
                    "Object.c; Object.c(); new Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        [ReferenceTracker.SingleLevelWildcard]: { [CALL]: 1 },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "a"],
                        type: CALL,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "c"],
                        type: CALL,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with VariableDeclarator",
                code: [
                    "var x = Object;",
                    "x.a; x.a(); new x.a();",
                    "x.b; x.b(); new x.b();",
                    "x.c; x.c(); new x.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with VariableDeclarator 2",
                code: [
                    "var x = Object, a = x.a, b = x.b, c = x.c;",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate any member references of a given global variable, with VariableDeclarator 2",
                code: [
                    "var x = Object, a = x.a, b = x.b, c = x.c;",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        [ReferenceTracker.SingleLevelWildcard]: {
                            [CONSTRUCT]: 1,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "a"],
                        type: CONSTRUCT,
                        info: 1,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "b"],
                        type: CONSTRUCT,
                        info: 1,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with AssignmentExpression",
                code: [
                    "var x, a, b, c;",
                    "a = (x = Object).a; b = x.b; c = x.c;",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with destructuring",
                code: [
                    "var {a, b, c, d} = Object;",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                    "d; d(); new d();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "Property" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate any member references of a given global variable, with destructuring",
                code: ["var {a} = Object;", "a();"].join("\n"),
                traceMap: {
                    Object: {
                        [ReferenceTracker.SingleLevelWildcard]: { [CALL]: 2 },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "a"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
            {
                description:
                    "should iterate any member references of a given global variable, with destructuring",
                code: ["var {a} = Object;", "a.b();"].join("\n"),
                traceMap: {
                    Object: {
                        [ReferenceTracker.MultiLevelWildcard]: { [CALL]: 2 },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "a", "b"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with AssignmentPattern",
                code: [
                    "var {x: {a, b, c} = Object} = {};",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "Property" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with 'window'.",
                code: [
                    "/*global window */",
                    "var {Object: {a, b, c}} = window;",
                    "a; a(); new a();",
                    "b; b(); new b();",
                    "c; c(); new c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "Property" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with 'global'.",
                code: [
                    "/*global global */",
                    "global.Object.a;",
                    "global.Object.b; global.Object.b(); new global.Object.b();",
                    "global.Object.c; global.Object.c(); new global.Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with 'globalThis'.",
                code: [
                    "/*global globalThis */",
                    "globalThis.Object.a;",
                    "globalThis.Object.b; globalThis.Object.b(); new globalThis.Object.b();",
                    "globalThis.Object.c; globalThis.Object.c(); new globalThis.Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with 'self'.",
                code: [
                    "/*global self */",
                    "self.Object.a;",
                    "self.Object.b; self.Object.b(); new self.Object.b();",
                    "self.Object.c; self.Object.c(); new self.Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the member references of a given global variable, with 'window'.",
                code: [
                    "/*global window */",
                    "window.Object.a;",
                    "window.Object.b; window.Object.b(); new window.Object.b();",
                    "window.Object.c; window.Object.c(); new window.Object.c();",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["Object", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["Object", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["Object", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should not iterate the references of a given global variable if it's modified.",
                code: [
                    "Object = {}",
                    "Object.a",
                    "Object.b()",
                    "new Object.c()",
                ].join("\n"),
                traceMap: {
                    Object: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [],
            },
            {
                description:
                    "should not iterate the references of a given single level wildcard if it's modified.",
                code: [
                    "Object = {}",
                    "Object.a",
                    "Object.b()",
                    "new Object.c()",
                ].join("\n"),
                traceMap: {
                    [ReferenceTracker.SingleLevelWildcard]: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                    },
                },
                expected: [],
            },
            {
                description:
                    "should not iterate the references through unary/binary expressions.",
                code: [
                    'var construct = typeof Reflect !== "undefined" ? Reflect.construct : undefined',
                    "construct()",
                ].join("\n"),
                traceMap: {
                    Reflect: { [CALL]: 1 },
                },
                expected: [],
            },
            ...(isESLint7
                ? [
                      {
                          description:
                              "should not mix up public and private identifiers.",
                          code: [
                              "class C { #value; wrap() { var value = MyObj.#value; } }",
                          ].join("\n"),
                          traceMap: {
                              MyObj: {
                                  value: { [READ]: 1 },
                              },
                          },
                          expected: [],
                      },
                  ]
                : []),
        ]) {
            it(description, () => {
                const linter = new eslint.Linter()

                let actual = null
                linter.defineRule("test", (context) => ({
                    "Program:exit"() {
                        const tracker = new ReferenceTracker(context.getScope())
                        actual = Array.from(
                            tracker.iterateGlobalReferences(traceMap),
                        ).map((x) =>
                            Object.assign(x, {
                                node: {
                                    type: x.node.type,
                                    ...(x.node.optional
                                        ? { optional: x.node.optional }
                                        : {}),
                                },
                            }),
                        )
                    },
                }))
                linter.verify(code, config)

                assert.deepStrictEqual(actual, expected)
            })
        }
    })

    describe("the 'iterateCjsReferences' method", () => {
        for (const { description, code, traceMap, expected } of [
            {
                description:
                    "should iterate the references of a given CJS modules.",
                code: [
                    "/*global require */",
                    "require('xxx');",
                    "const abc = require('abc');",
                    "const def = require();", // no require id
                    "require('ghi')();", // direct call
                    "abc();",
                    "new abc();",
                    "(abc.xyz || abc.ghi ? abc.jkl : abc.mno), abc.pqr;",
                    ...(isESLint6
                        ? [
                              "abc?.xyz;",
                              "abc?.();",
                              "abc?.xyz?.();",
                              "(abc.def).ghi;",
                              "(abc?.def)?.ghi;",
                          ]
                        : []),
                ].join("\n"),
                traceMap: {
                    abc: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                        xyz: { [READ]: 4 },
                        ghi: { [READ]: 6 },
                        jkl: { [READ]: 7 },
                        mno: { [READ]: 8 },
                        pqr: { [READ]: 9 },
                        def: { ghi: { [READ]: 5 } },
                    },
                    def: {
                        [READ]: 1,
                    },
                    ghi: {
                        [CALL]: 2,
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["abc"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["abc"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "xyz"],
                        type: READ,
                        info: 4,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "ghi"],
                        type: READ,
                        info: 6,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "jkl"],
                        type: READ,
                        info: 7,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "mno"],
                        type: READ,
                        info: 8,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "pqr"],
                        type: READ,
                        info: 9,
                    },
                    ...(isESLint6
                        ? [
                              {
                                  node: {
                                      type: "MemberExpression",
                                      optional: true,
                                  },
                                  path: ["abc", "xyz"],
                                  type: READ,
                                  info: 4,
                              },
                              {
                                  node: {
                                      type: "CallExpression",
                                      optional: true,
                                  },
                                  path: ["abc"],
                                  type: CALL,
                                  info: 2,
                              },
                              {
                                  node: {
                                      type: "MemberExpression",
                                      optional: true,
                                  },
                                  path: ["abc", "xyz"],
                                  type: READ,
                                  info: 4,
                              },
                              {
                                  node: { type: "MemberExpression" },
                                  path: ["abc", "def", "ghi"],
                                  type: READ,
                                  info: 5,
                              },
                              {
                                  node: {
                                      type: "MemberExpression",
                                      optional: true,
                                  },
                                  path: ["abc", "def", "ghi"],
                                  type: READ,
                                  info: 5,
                              },
                          ]
                        : []),
                    {
                        node: { type: "CallExpression" },
                        path: ["ghi"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
            {
                description:
                    "should NOT iterate the references of a given CJS modules if the 'require' variable wasn't defined.",
                code: [
                    "const abc = require('abc');",
                    "abc();",
                    "new abc();",
                    "abc.xyz;",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                        xyz: { [READ]: 4 },
                    },
                },
                expected: [],
            },
            {
                description:
                    "should NOT iterate the references of a given CJS modules if the 'require' variable was overrided.",
                code: [
                    "/*global require */",
                    "const require = () => {};",
                    "const abc = require('abc');",
                    "abc();",
                    "new abc();",
                    "abc.xyz;",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                        xyz: { [READ]: 4 },
                    },
                },
                expected: [],
            },
            {
                description:
                    "should iterate the references of a given CJS modules with single level wildcard.",
                code: [
                    "/*global require */",
                    "const def = require('abc');",
                    "def()",
                ].join("\n"),
                traceMap: {
                    [ReferenceTracker.SingleLevelWildcard]: {
                        [READ]: 1,
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["abc"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
        ]) {
            it(description, () => {
                const linter = new eslint.Linter()

                let actual = null
                linter.defineRule("test", (context) => ({
                    "Program:exit"() {
                        const tracker = new ReferenceTracker(context.getScope())
                        actual = Array.from(
                            tracker.iterateCjsReferences(traceMap),
                        ).map((x) =>
                            Object.assign(x, {
                                node: {
                                    type: x.node.type,
                                    ...(x.node.optional
                                        ? { optional: x.node.optional }
                                        : {}),
                                },
                            }),
                        )
                    },
                }))
                linter.verify(code, config)

                assert.deepStrictEqual(actual, expected)
            })
        }
    })

    describe("the 'iterateEsmReferences' method", () => {
        for (const { description, code, traceMap, expected } of [
            {
                description:
                    "should iterate the references of a given ES modules (with CJS module and the default export).",
                code: [
                    "import abc from 'abc';",
                    "import unused from 'unused';",
                    "abc();",
                    "new abc();",
                    "abc.xyz;",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [READ]: 1,
                        [CALL]: 2,
                        [CONSTRUCT]: 3,
                        xyz: { [READ]: 4 },
                    },
                },
                expected: [
                    {
                        node: { type: "ImportDeclaration" },
                        path: ["abc"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["abc"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "xyz"],
                        type: READ,
                        info: 4,
                    },
                ],
            },
            {
                description: "should map CJS module to the default export.",
                code: [
                    "import {default as x} from 'abc';",
                    "x.a;",
                    "x.b();",
                    "new x.c();",
                ].join("\n"),
                traceMap: {
                    abc: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["abc", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description: "should NOT map CJS module to the named exports.",
                code: [
                    "import {a, b, c} from 'abc';",
                    "a;",
                    "b();",
                    "new c();",
                ].join("\n"),
                traceMap: {
                    abc: {
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [],
            },
            {
                description:
                    "should iterate the references of a given ES modules.",
                code: [
                    "import x, {a, b, c, y} from 'abc';",
                    "x.a;",
                    "x.y;",
                    "a;",
                    "b();",
                    "new c();",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [ESM]: true,
                        default: {
                            y: { [READ]: 4 },
                        },
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "default", "y"],
                        type: READ,
                        info: 4,
                    },
                    {
                        node: { type: "ImportSpecifier" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["abc", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given ES modules, with ImportNamespaceSpecifier.",
                code: [
                    "import * as x from 'abc';",
                    "x.default.a;",
                    "x.default.y;",
                    "x.a;",
                    "x.b();",
                    "new x.c();",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [ESM]: true,
                        default: {
                            y: { [READ]: 4 },
                        },
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                    },
                },
                expected: [
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "default", "y"],
                        type: READ,
                        info: 4,
                    },
                    {
                        node: { type: "MemberExpression" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "b"],
                        type: CALL,
                        info: 2,
                    },
                    {
                        node: { type: "NewExpression" },
                        path: ["abc", "c"],
                        type: CONSTRUCT,
                        info: 3,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given ES modules, with ExportNamedDeclaration.",
                code: "export {a, b, c, e} from 'abc';",
                traceMap: {
                    abc: {
                        [ESM]: true,
                        default: {
                            y: { [READ]: 4 },
                        },
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                        d: { [READ]: 5 },
                    },
                },
                expected: [
                    {
                        node: { type: "ExportSpecifier" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate all references of a given ES modules, with ExportNamedDeclaration.",
                code: "export {a} from 'abc';",
                traceMap: {
                    abc: {
                        [ESM]: true,
                        [ReferenceTracker.SingleLevelWildcard]: {
                            [READ]: 1,
                            [CALL]: 2,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "ExportSpecifier" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate all references of a given ES modules, with ExportNamedDeclaration.",
                code: "export {a} from 'abc';",
                traceMap: {
                    abc: {
                        [ESM]: true,
                        [ReferenceTracker.MultiLevelWildcard]: {
                            [READ]: 1,
                            [CALL]: 2,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "ExportSpecifier" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given ES modules, with ExportAllDeclaration.",
                code: "export * from 'abc';",
                traceMap: {
                    abc: {
                        [ESM]: true,
                        default: {
                            y: { [READ]: 4 },
                        },
                        a: { [READ]: 1 },
                        b: { [CALL]: 2 },
                        c: { [CONSTRUCT]: 3 },
                        d: { [READ]: 5 },
                    },
                },
                expected: [
                    {
                        node: { type: "ExportAllDeclaration" },
                        path: ["abc", "a"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "ExportAllDeclaration" },
                        path: ["abc", "d"],
                        type: READ,
                        info: 5,
                    },
                ],
            },
            {
                description:
                    "should ignore the references of a given ES modules with single level wildcard and ExportAllDeclaration.",
                code: "export * from 'abc';",
                traceMap: {
                    abc: {
                        [ESM]: true,
                        [ReferenceTracker.SingleLevelWildcard]: { [READ]: 1 },
                    },
                },
                expected: [],
            },
            {
                description:
                    "should iterate all references of a given ES modules with single level wildcard.",
                code: [
                    "import {default as abc} from 'abc';",
                    "abc();",
                    "abc.def();",
                ].join("\n"),
                traceMap: {
                    abc: {
                        [ESM]: true,
                        [ReferenceTracker.SingleLevelWildcard]: {
                            [CALL]: 2,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "default"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
            {
                description:
                    "should iterate all references of a given ES modules with multi level wildcard.",
                code: ["import abc from 'abc';", "abc.def();"].join("\n"),
                traceMap: {
                    abc: {
                        [ESM]: true,
                        [ReferenceTracker.MultiLevelWildcard]: {
                            [CALL]: 2,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "default", "def"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
            {
                description:
                    "should iterate the references of a given ES modules with single level wildcard.",
                code: ["import def from 'abc';", "def();"].join("\n"),
                traceMap: {
                    [ReferenceTracker.SingleLevelWildcard]: {
                        [ESM]: true,
                        default: {
                            [READ]: 1,
                            [CALL]: 2,
                        },
                    },
                },
                expected: [
                    {
                        node: { type: "ImportDefaultSpecifier" },
                        path: ["abc", "default"],
                        type: READ,
                        info: 1,
                    },
                    {
                        node: { type: "CallExpression" },
                        path: ["abc", "default"],
                        type: CALL,
                        info: 2,
                    },
                ],
            },
        ]) {
            it(description, () => {
                const linter = new eslint.Linter()

                let actual = null
                linter.defineRule("test", (context) => ({
                    "Program:exit"() {
                        const tracker = new ReferenceTracker(context.getScope())
                        actual = Array.from(
                            tracker.iterateEsmReferences(traceMap),
                        ).map((x) =>
                            Object.assign(x, {
                                node: {
                                    type: x.node.type,
                                    ...(x.node.optional
                                        ? { optional: x.node.optional }
                                        : {}),
                                },
                            }),
                        )
                    },
                }))
                linter.verify(code, config)

                assert.deepStrictEqual(actual, expected)
            })
        }
    })
})
