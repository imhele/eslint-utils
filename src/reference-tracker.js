import { findVariable } from "./find-variable"
import { getPropertyName } from "./get-property-name"
import { getStringIfConstant } from "./get-string-if-constant"

const IMPORT_TYPE = /^(?:Import|Export(?:All|Default|Named))Declaration$/u
const has = Function.call.bind(Object.hasOwnProperty)

export const READ = Symbol("read")
export const CALL = Symbol("call")
export const CONSTRUCT = Symbol("construct")
export const ESM = Symbol("esm")
export const MultiLevelWildcard = Symbol("MultiLevelWildcard")
export const SingleLevelWildcard = Symbol("SingleLevelWildcard")

const requireCall = { require: { [CALL]: true } }

/**
 * Check whether a given variable is modified or not.
 * @param {Variable} variable The variable to check.
 * @returns {boolean} `true` if the variable is modified.
 */
function isModifiedGlobal(variable) {
    return (
        variable == null ||
        variable.defs.length !== 0 ||
        variable.references.some((r) => r.isWrite())
    )
}

/**
 * Check if the value of a given node is passed through to the parent syntax as-is.
 * For example, `a` and `b` in (`a || b` and `c ? a : b`) are passed through.
 * @param {Node} node A node to check.
 * @returns {boolean} `true` if the node is passed through.
 */
function isPassThrough(node) {
    const parent = node.parent

    switch (parent && parent.type) {
        case "ConditionalExpression":
            return parent.consequent === node || parent.alternate === node
        case "LogicalExpression":
            return true
        case "SequenceExpression":
            return parent.expressions[parent.expressions.length - 1] === node
        case "ChainExpression":
            return true

        default:
            return false
    }
}

/**
 * Get own property names and symbols of the given object.
 * @param {object} object
 * @returns {(string | symbol)[]} Own property names and symbols.
 */
function ownKeys(object) {
    return Object.getOwnPropertyNames(object).concat(
        Object.getOwnPropertySymbols(object),
    )
}

/**
 * The reference tracker.
 */
export class ReferenceTracker {
    /**
     * Initialize this tracker.
     * @param {Scope} globalScope The global scope.
     * @param {object} [options] The options.
     * @param {symbol} [options.multiLevelWildcard]
     * @param {symbol} [options.singleLevelWildcard]
     * @param {"legacy"|"strict"} [options.mode="strict"] The mode to determine the ImportDeclaration's behavior for CJS modules.
     * @param {string[]} [options.globalObjectNames=["global","globalThis","self","window"]] The variable names for Global Object.
     */
    constructor(
        globalScope,
        {
            mode = "strict",
            multiLevelWildcard = MultiLevelWildcard,
            singleLevelWildcard = SingleLevelWildcard,
            globalObjectNames = ["global", "globalThis", "self", "window"],
        } = {},
    ) {
        this.variableStack = []
        this.globalScope = globalScope
        this.mode = mode
        this.globalObjectNames = globalObjectNames.slice(0)
        this.multiLevelWildcard = multiLevelWildcard
        this.singleLevelWildcard = singleLevelWildcard
    }

    /**
     * Iterate the references of global variables.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    *iterateGlobalReferences(traceMap) {
        for (const key of ownKeys(traceMap)) {
            if (
                key === this.singleLevelWildcard ||
                key === this.multiLevelWildcard
            ) {
                const nextTraceMap = traceMap[key]
                const variableEntries = Array.from(this.globalScope.set)

                for (const variableEntry of variableEntries) {
                    if (isModifiedGlobal(variableEntry[1])) {
                        continue
                    }

                    const variable = variableEntry[1]
                    const path = [variableEntry[0]]

                    yield* this._iterateVariableReferences(
                        variable,
                        path,
                        nextTraceMap,
                        true,
                    )

                    if (key === this.multiLevelWildcard) {
                        yield* this._iterateVariableReferences(
                            variable,
                            path,
                            traceMap,
                            true,
                        )
                    }
                }

                continue
            }

            const nextTraceMap = traceMap[key]
            const path = [key]
            const variable = this.globalScope.set.get(key)

            if (isModifiedGlobal(variable)) {
                continue
            }

            yield* this._iterateVariableReferences(
                variable,
                path,
                nextTraceMap,
                true,
            )
        }

        for (const key of this.globalObjectNames) {
            const path = []
            const variable = this.globalScope.set.get(key)

            if (isModifiedGlobal(variable)) {
                continue
            }

            yield* this._iterateVariableReferences(
                variable,
                path,
                traceMap,
                false,
            )
        }
    }

    /**
     * Iterate the references of CommonJS modules.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    *iterateCjsReferences(traceMap) {
        for (const { node } of this.iterateGlobalReferences(requireCall)) {
            const key = getStringIfConstant(node.arguments[0])
            if (key == null) {
                continue
            }

            const path = [key]
            let nextTraceMap = null

            if (has(traceMap, key)) {
                nextTraceMap = traceMap[key]
            } else if (has(traceMap, this.singleLevelWildcard)) {
                nextTraceMap = traceMap[this.singleLevelWildcard]
            }

            if (nextTraceMap == null) {
                continue
            }

            if (nextTraceMap[READ]) {
                yield {
                    node,
                    path,
                    type: READ,
                    info: nextTraceMap[READ],
                }
            }
            yield* this._iteratePropertyReferences(node, path, nextTraceMap)
        }
    }

    /**
     * Iterate the references of ES modules.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    // eslint-disable-next-line complexity
    *iterateEsmReferences(traceMap) {
        const programNode = this.globalScope.block

        for (const node of programNode.body) {
            if (!IMPORT_TYPE.test(node.type) || node.source == null) {
                continue
            }
            const moduleId = node.source.value

            const path = [moduleId]
            let nextTraceMap = null

            if (has(traceMap, moduleId)) {
                nextTraceMap = traceMap[moduleId]
            } else if (has(traceMap, this.singleLevelWildcard)) {
                nextTraceMap = traceMap[this.singleLevelWildcard]
            }

            if (nextTraceMap == null) {
                continue
            }

            if (nextTraceMap[READ]) {
                yield { node, path, type: READ, info: nextTraceMap[READ] }
            }

            if (node.type === "ExportAllDeclaration") {
                for (const key of ownKeys(nextTraceMap)) {
                    if (
                        key === this.multiLevelWildcard ||
                        key === this.singleLevelWildcard
                    ) {
                        continue
                    }

                    const exportTraceMap = nextTraceMap[key]
                    if (exportTraceMap[READ]) {
                        yield {
                            node,
                            path: path.concat(key),
                            type: READ,
                            info: exportTraceMap[READ],
                        }
                    }
                }
            } else {
                for (const specifier of node.specifiers) {
                    const esm = nextTraceMap[ESM]
                    const it = this._iterateImportReferences(
                        specifier,
                        path,
                        esm
                            ? nextTraceMap
                            : this.mode === "legacy"
                            ? { default: nextTraceMap, ...nextTraceMap }
                            : { default: nextTraceMap },
                    )

                    if (esm) {
                        yield* it
                    } else {
                        for (const report of it) {
                            report.path = report.path.filter(exceptDefault)
                            if (
                                report.path.length >= 2 ||
                                report.type !== READ
                            ) {
                                yield report
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Iterate the references for a given variable.
     * @param {Variable} variable The variable to iterate that references.
     * @param {string[]} path The current path.
     * @param {object} traceMap The trace map.
     * @param {boolean} shouldReport = The flag to report those references.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    *_iterateVariableReferences(variable, path, traceMap, shouldReport) {
        if (this.variableStack.includes(variable)) {
            return
        }
        this.variableStack.push(variable)
        try {
            for (const reference of variable.references) {
                if (!reference.isRead()) {
                    continue
                }
                const node = reference.identifier

                if (shouldReport && traceMap[READ]) {
                    yield { node, path, type: READ, info: traceMap[READ] }
                }
                yield* this._iteratePropertyReferences(node, path, traceMap)
            }
        } finally {
            this.variableStack.pop()
        }
    }

    /**
     * Iterate the references for a given AST node.
     * @param rootNode The AST node to iterate references.
     * @param {string[]} path The current path.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    //eslint-disable-next-line complexity
    *_iteratePropertyReferences(rootNode, path, traceMap) {
        let node = rootNode
        while (isPassThrough(node)) {
            node = node.parent
        }

        const parent = node.parent
        if (parent.type === "MemberExpression") {
            if (parent.object === node) {
                const key = getPropertyName(parent)
                if (key == null) {
                    return
                }

                let nextTraceMap = null
                let isMultiWildcard = false
                if (has(traceMap, key)) {
                    nextTraceMap = traceMap[key]
                } else if (has(traceMap, this.singleLevelWildcard)) {
                    nextTraceMap = traceMap[this.singleLevelWildcard]
                } else if (has(traceMap, this.multiLevelWildcard)) {
                    isMultiWildcard = true
                    nextTraceMap = traceMap[this.multiLevelWildcard]
                }

                if (nextTraceMap == null) {
                    return
                }

                path = path.concat(key) //eslint-disable-line no-param-reassign
                if (nextTraceMap[READ]) {
                    yield {
                        node: parent,
                        path,
                        type: READ,
                        info: nextTraceMap[READ],
                    }
                }
                yield* this._iteratePropertyReferences(
                    parent,
                    path,
                    nextTraceMap,
                )
                if (isMultiWildcard) {
                    yield* this._iteratePropertyReferences(
                        parent,
                        path,
                        traceMap,
                    )
                }
            }
            return
        }
        if (parent.type === "CallExpression") {
            if (parent.callee === node && traceMap[CALL]) {
                yield { node: parent, path, type: CALL, info: traceMap[CALL] }
            }
            return
        }
        if (parent.type === "NewExpression") {
            if (parent.callee === node && traceMap[CONSTRUCT]) {
                yield {
                    node: parent,
                    path,
                    type: CONSTRUCT,
                    info: traceMap[CONSTRUCT],
                }
            }
            return
        }
        if (parent.type === "AssignmentExpression") {
            if (parent.right === node) {
                yield* this._iterateLhsReferences(parent.left, path, traceMap)
                yield* this._iteratePropertyReferences(parent, path, traceMap)
            }
            return
        }
        if (parent.type === "AssignmentPattern") {
            if (parent.right === node) {
                yield* this._iterateLhsReferences(parent.left, path, traceMap)
            }
            return
        }
        if (parent.type === "VariableDeclarator") {
            if (parent.init === node) {
                yield* this._iterateLhsReferences(parent.id, path, traceMap)
            }
        }
    }

    /**
     * Iterate the references for a given Pattern node.
     * @param {Node} patternNode The Pattern node to iterate references.
     * @param {string[]} path The current path.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    *_iterateLhsReferences(patternNode, path, traceMap) {
        if (patternNode.type === "Identifier") {
            const variable = findVariable(this.globalScope, patternNode)
            if (variable != null) {
                yield* this._iterateVariableReferences(
                    variable,
                    path,
                    traceMap,
                    false,
                )
            }
            return
        }
        if (patternNode.type === "ObjectPattern") {
            for (const property of patternNode.properties) {
                const key = getPropertyName(property)

                if (key == null) {
                    continue
                }

                let nextTraceMap = null
                let isMultiWildcard = false
                if (has(traceMap, key)) {
                    nextTraceMap = traceMap[key]
                } else if (has(traceMap, this.singleLevelWildcard)) {
                    nextTraceMap = traceMap[this.singleLevelWildcard]
                } else if (has(traceMap, this.multiLevelWildcard)) {
                    isMultiWildcard = true
                    nextTraceMap = traceMap[this.multiLevelWildcard]
                }

                if (nextTraceMap == null) {
                    continue
                }

                const nextPath = path.concat(key)
                if (nextTraceMap[READ]) {
                    yield {
                        node: property,
                        path: nextPath,
                        type: READ,
                        info: nextTraceMap[READ],
                    }
                }
                yield* this._iterateLhsReferences(
                    property.value,
                    nextPath,
                    nextTraceMap,
                )
                if (isMultiWildcard) {
                    yield* this._iterateLhsReferences(
                        property.value,
                        nextPath,
                        traceMap,
                    )
                }
            }
            return
        }
        if (patternNode.type === "AssignmentPattern") {
            yield* this._iterateLhsReferences(patternNode.left, path, traceMap)
        }
    }

    /**
     * Iterate the references for a given ModuleSpecifier node.
     * @param {Node} specifierNode The ModuleSpecifier node to iterate references.
     * @param {string[]} path The current path.
     * @param {object} traceMap The trace map.
     * @returns {IterableIterator<{node:Node,path:(string | symbol)[],type:symbol,info:any}>} The iterator to iterate references.
     */
    // eslint-disable-next-line complexity
    *_iterateImportReferences(specifierNode, path, traceMap) {
        const type = specifierNode.type

        if (type === "ImportSpecifier" || type === "ImportDefaultSpecifier") {
            const key =
                type === "ImportDefaultSpecifier"
                    ? "default"
                    : specifierNode.imported.name

            let nextTraceMap = null
            let isMultiWildcard = false
            if (has(traceMap, key)) {
                nextTraceMap = traceMap[key]
            } else if (has(traceMap, this.singleLevelWildcard)) {
                nextTraceMap = traceMap[this.singleLevelWildcard]
            } else if (has(traceMap, this.multiLevelWildcard)) {
                isMultiWildcard = true
                nextTraceMap = traceMap[this.multiLevelWildcard]
            }

            if (nextTraceMap == null) {
                return
            }

            path = path.concat(key) //eslint-disable-line no-param-reassign
            if (nextTraceMap[READ]) {
                yield {
                    node: specifierNode,
                    path,
                    type: READ,
                    info: nextTraceMap[READ],
                }
            }
            yield* this._iterateVariableReferences(
                findVariable(this.globalScope, specifierNode.local),
                path,
                nextTraceMap,
                false,
            )
            if (isMultiWildcard) {
                yield* this._iterateVariableReferences(
                    findVariable(this.globalScope, specifierNode.local),
                    path,
                    traceMap,
                    false,
                )
            }

            return
        }

        if (type === "ImportNamespaceSpecifier") {
            yield* this._iterateVariableReferences(
                findVariable(this.globalScope, specifierNode.local),
                path,
                traceMap,
                false,
            )
            return
        }

        if (type === "ExportSpecifier") {
            const key = specifierNode.local.name

            let nextTraceMap = null
            if (has(traceMap, key)) {
                nextTraceMap = traceMap[key]
            } else if (has(traceMap, this.singleLevelWildcard)) {
                nextTraceMap = traceMap[this.singleLevelWildcard]
            } else if (has(traceMap, this.multiLevelWildcard)) {
                nextTraceMap = traceMap[this.multiLevelWildcard]
            }

            if (nextTraceMap == null) {
                return
            }

            path = path.concat(key) //eslint-disable-line no-param-reassign
            if (nextTraceMap[READ]) {
                yield {
                    node: specifierNode,
                    path,
                    type: READ,
                    info: nextTraceMap[READ],
                }
            }
        }
    }
}

ReferenceTracker.READ = READ
ReferenceTracker.CALL = CALL
ReferenceTracker.CONSTRUCT = CONSTRUCT
ReferenceTracker.ESM = ESM
ReferenceTracker.MultiLevelWildcard = MultiLevelWildcard
ReferenceTracker.SingleLevelWildcard = SingleLevelWildcard

/**
 * This is a predicate function for Array#filter.
 * @param {string} name A name part.
 * @param {number} index The index of the name.
 * @returns {boolean} `false` if it's default.
 */
function exceptDefault(name, index) {
    return !(index === 1 && name === "default")
}
