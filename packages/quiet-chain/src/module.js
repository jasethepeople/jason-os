export class QuietChain {
    links = new Map();
    roots = [];
    lastLinkAt = null;
    accessPairs = new Map();
    config;
    constructor(options = {}) {
        this.config = {
            defaultModuleId: 'default',
            initialStrength: 1.0,
            strengthIncrement: 0.1,
            maxDepth: 100,
            ...options,
        };
    }
    /**
     * Add a new link to the chain. If parentId is provided, links as child.
     * Otherwise creates a new root.
     */
    addLink(content, parentId, moduleId) {
        const id = this.generateId();
        const now = Date.now();
        const link = {
            id,
            content,
            parentId: parentId ?? null,
            children: [],
            createdAt: now,
            moduleId: moduleId ?? this.config.defaultModuleId,
            strength: this.config.initialStrength,
        };
        this.links.set(id, link);
        if (parentId) {
            const parent = this.links.get(parentId);
            if (parent && !parent.children.includes(id)) {
                parent.children.push(id);
                this.strengthenPair(parent.id, id);
            }
        }
        else {
            this.roots.push(id);
        }
        this.lastLinkAt = now;
        return link;
    }
    /**
     * Get the full chain starting from a root link.
     */
    getChain(rootId) {
        if (!this.links.has(rootId))
            return [];
        const result = [];
        const visited = new Set();
        const queue = [rootId];
        while (queue.length > 0 && result.length < this.config.maxDepth) {
            const id = queue.shift();
            if (visited.has(id))
                continue;
            visited.add(id);
            const link = this.links.get(id);
            if (link) {
                result.push({ ...link });
                queue.push(...link.children);
            }
        }
        return result;
    }
    /**
     * Find related links based on co-access patterns and parent-child relationships.
     */
    findRelated(linkId) {
        const link = this.links.get(linkId);
        if (!link)
            return [];
        const related = new Map();
        // Parent is related
        if (link.parentId && this.links.has(link.parentId)) {
            const strength = this.getPairStrength(link.parentId, linkId);
            related.set(link.parentId, strength + 0.5);
        }
        // Children are related
        for (const childId of link.children) {
            if (this.links.has(childId)) {
                const strength = this.getPairStrength(linkId, childId);
                related.set(childId, strength + 0.5);
            }
        }
        // Co-accessed links
        for (const [pairKey, accessCount] of this.accessPairs) {
            const [a, b] = pairKey.split('|');
            if (a === linkId && this.links.has(b)) {
                const current = related.get(b) ?? 0;
                related.set(b, current + accessCount * 0.1);
            }
            else if (b === linkId && this.links.has(a)) {
                const current = related.get(a) ?? 0;
                related.set(a, current + accessCount * 0.1);
            }
        }
        return Array.from(related.entries())
            .map(([id, relationStrength]) => ({
            link: { ...this.links.get(id) },
            relationStrength: Math.round(relationStrength * 100) / 100,
        }))
            .filter((r) => r.link.id !== linkId)
            .sort((a, b) => b.relationStrength - a.relationStrength);
    }
    /**
     * Get all root link IDs.
     */
    getRoots() {
        return [...this.roots];
    }
    /**
     * Get all root link objects.
     */
    getRootLinks() {
        return this.roots
            .map((id) => this.links.get(id))
            .filter((link) => link !== undefined)
            .map((link) => ({ ...link }));
    }
    /**
     * Traverse the chain depth-first from a starting link.
     */
    traverseDepthFirst(startId) {
        if (!this.links.has(startId))
            return [];
        const result = [];
        const visited = new Set();
        const visit = (id, depth, path) => {
            if (visited.has(id) || depth >= this.config.maxDepth)
                return;
            visited.add(id);
            const link = this.links.get(id);
            if (!link)
                return;
            result.push({ link: { ...link }, depth, path: [...path] });
            for (const childId of link.children) {
                visit(childId, depth + 1, [...path, id]);
            }
        };
        visit(startId, 0, []);
        return result;
    }
    /**
     * Get a single link by ID.
     */
    getLink(id) {
        const link = this.links.get(id);
        return link ? { ...link } : null;
    }
    /**
     * Get current state snapshot.
     */
    getState() {
        const linksCopy = new Map();
        for (const [id, link] of this.links) {
            linksCopy.set(id, { ...link });
        }
        return {
            links: linksCopy,
            roots: [...this.roots],
            lastLinkAt: this.lastLinkAt,
        };
    }
    /**
     * Remove a link and all its descendants.
     */
    removeLink(id) {
        const link = this.links.get(id);
        if (!link)
            return false;
        // Remove from parent's children
        if (link.parentId) {
            const parent = this.links.get(link.parentId);
            if (parent) {
                parent.children = parent.children.filter((c) => c !== id);
            }
        }
        else {
            // Remove from roots
            this.roots = this.roots.filter((r) => r !== id);
        }
        // Recursively remove children
        for (const childId of [...link.children]) {
            this.removeLink(childId);
        }
        this.links.delete(id);
        this.cleanupPairs(id);
        return true;
    }
    /**
     * Update content of a link.
     */
    updateContent(id, content) {
        const link = this.links.get(id);
        if (!link)
            return null;
        link.content = content;
        return { ...link };
    }
    /**
     * Move a link to a new parent.
     */
    reparentLink(id, newParentId) {
        const link = this.links.get(id);
        if (!link)
            return null;
        if (newParentId !== null && !this.links.has(newParentId))
            return null;
        if (newParentId === id)
            return null; // Cannot be own parent
        // Remove from old parent's children
        if (link.parentId) {
            const oldParent = this.links.get(link.parentId);
            if (oldParent) {
                oldParent.children = oldParent.children.filter((c) => c !== id);
            }
        }
        else {
            this.roots = this.roots.filter((r) => r !== id);
        }
        // Add to new parent
        if (newParentId) {
            const newParent = this.links.get(newParentId);
            if (newParent && !newParent.children.includes(id)) {
                newParent.children.push(id);
            }
        }
        else {
            this.roots.push(id);
        }
        link.parentId = newParentId ?? null;
        return { ...link };
    }
    /**
     * Get total number of links.
     */
    size() {
        return this.links.size;
    }
    /**
     * Clear all links.
     */
    clear() {
        this.links.clear();
        this.roots = [];
        this.lastLinkAt = null;
        this.accessPairs.clear();
    }
    generateId() {
        return `link_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
    strengthenPair(a, b) {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        const current = this.accessPairs.get(key) ?? 0;
        this.accessPairs.set(key, current + 1);
    }
    getPairStrength(a, b) {
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        return (this.accessPairs.get(key) ?? 0) * this.config.strengthIncrement;
    }
    cleanupPairs(removedId) {
        for (const key of this.accessPairs.keys()) {
            if (key.includes(removedId)) {
                this.accessPairs.delete(key);
            }
        }
    }
}
//# sourceMappingURL=module.js.map