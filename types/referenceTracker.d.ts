import { Scope } from 'eslint';
import { Node } from 'estree';

export interface ReferenceTrackerOptions {
    /**
     * The variable names for Global Object.
     */
    globalObjectNames?: string[];

    /**
     * The mode to determine the ImportDeclaration's behavior for CJS modules.
     */
    mode?: 'legacy' | 'strict';
    multiLevelWildcard?: symbol;
    singleLevelWildcard?: symbol;
}

export interface TraceMap {
    [i: string]: TraceMapObject;
    [i: symbol]: TraceMapObject;
}

export interface TraceMapObject {
    [i: string]: TraceMapObject;
    [i: symbol]: unknown;
}

export const CALL: unique symbol;
export const CONSTRUCT: unique symbol;
export const ESM: unique symbol;
export const READ: unique symbol;
export const MultiLevelWildcard: unique symbol;
export const SingleLevelWildcard: unique symbol;

export interface TrackedReferences {
    entry: unknown;
    node: Node;
    path: string[];
    type: symbol;
}

export class ReferenceTracker {
    static readonly CALL: typeof CALL;
    static readonly CONSTRUCT: typeof CONSTRUCT;
    static readonly ESM: typeof ESM;
    static readonly READ: typeof READ;
    static readonly MultiLevelWildcard: typeof MultiLevelWildcard;
    static readonly SingleLevelWildcard: typeof SingleLevelWildcard;

    constructor(globalScope: Scope.Scope, options?: ReferenceTrackerOptions);

    /**
     * Iterate the references of CommonJS modules.
     */
    iterateCjsReferences(traceMap: TraceMap): IterableIterator<TrackedReferences>;

    /**
     * Iterate the references of ES modules.
     */
    iterateEsmReferences(traceMap: TraceMap): IterableIterator<TrackedReferences>;

    /**
     * Iterate the references of global variables.
     */
    iterateGlobalReferences(traceMap: TraceMap): IterableIterator<TrackedReferences>;
}
