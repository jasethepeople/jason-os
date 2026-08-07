export type ThemeName = 'dim' | 'soft' | 'shadow' | 'quiet';
export interface Theme {
    name: ThemeName;
    bg: string;
    fg: string;
    accent: string;
    card: string;
    border: string;
    radius: string;
    animation: boolean;
    contrast: 'low' | 'normal' | 'high';
}
export type PanelMode = 'tabbed' | 'split' | 'overlay' | 'fullscreen';
export interface SidebarItem {
    id: string;
    label: string;
    icon?: string;
    moduleId: string;
    pinned?: boolean;
    order: number;
    children?: SidebarItem[];
}
export interface HeaderState {
    identitySwitcher: boolean;
    emotionalIndicator: boolean;
    privacyBadge: boolean;
    ghostModeToggle: boolean;
    moduleSearch: boolean;
}
export interface FooterStatus {
    sync: 'synced' | 'syncing' | 'offline';
    llm: 'connected' | 'disconnected' | 'degraded';
    privacyTier: 'PUBLIC' | 'SOFT' | 'SHADOW' | 'GHOST';
}
//# sourceMappingURL=types.d.ts.map