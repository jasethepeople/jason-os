export interface ChainLink {
    id: string;
    content: string;
    parentId: string | null;
    children: string[];
    createdAt: number;
    moduleId: string;
    strength: number;
}
export interface QuietChainState {
    links: Map<string, ChainLink>;
    roots: string[];
    lastLinkAt: number | null;
}
export interface ChainConfig {
    defaultModuleId: string;
    initialStrength: number;
    strengthIncrement: number;
    maxDepth: number;
}
export interface ChainTraversalResult {
    link: ChainLink;
    depth: number;
    path: string[];
}
export interface RelatedLink {
    link: ChainLink;
    relationStrength: number;
}
//# sourceMappingURL=types.d.ts.map