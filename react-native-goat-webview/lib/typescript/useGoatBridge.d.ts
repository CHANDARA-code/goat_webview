export declare function useGoatBridge(): {
    isPrewarmed: boolean;
    bundleVersion: string | null;
    clearCache: () => Promise<boolean>;
};
