import type { ChainLink, QuietChainState, ChainConfig, ChainTraversalResult, RelatedLink } from './types.js';
export declare class QuietChain {
    private links;
    private roots;
    private lastLinkAt;
    private accessPairs;
    private readonly config;
    constructor(options?: Partial<ChainConfig>);
    /**
     * Add a new link to the chain. If parentId is provided, links as child.
     * Otherwise creates a new root.
     */
    addLink(content: string, parentId?: string, moduleId?: string): ChainLink;
    /**
     * Get the full chain starting from a root link.
     */
    getChain(rootId: string): ChainLink[];
    /**
     * Find related links based on co-access patterns and parent-child relationships.
     */
    findRelated(linkId: string): RelatedLink[];
    /**
     * Get all root link IDs.
     */
    getRoots(): string[];
    /**
     * Get all root link objects.
     */
    getRootLinks(): ChainLink[];
    /**
     * Traverse the chain depth-first from a starting link.
     */
    traverseDepthFirst(startId: string): ChainTraversalResult[];
    /**
     * Get a single link by ID.
     */
    getLink(id: string): ChainLink | null;
    /**
     * Get current state snapshot.
     */
    getState(): QuietChainState;
    /**
     * Remove a link and all its descendants.
     */
    removeLink(id: string): boolean;
    /**
     * Update content of a link.
     */
    updateContent(id: string, content: string): ChainLink | null;
    /**
     * Move a link to a new parent.
     */
    reparentLink(id: string, newParentId: string | null): ChainLink | null;
    /**
     * Get total number of links.
     */
    size(): number;
    /**
     * Clear all links.
     */
    clear(): void;
    private generateId;
    private strengthenPair;
    private getPairStrength;
    private cleanupPairs;
}
//# sourceMappingURL=module.d.ts.map