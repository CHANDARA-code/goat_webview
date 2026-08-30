import { z } from 'zod';

export const SubpackageSchema = z.object({
  root: z.string(),
  name: z.string().optional(),
  pages: z.array(z.string()),
  independent: z.boolean().optional(),
});

export const ManifestWindowSchema = z.object({
  navigationBarTitleText: z.string().optional(),
  navigationBarBackgroundColor: z.string().optional(),
  navigationBarTextStyle: z.enum(['black', 'white']).optional(),
  backgroundColor: z.string().optional(),
  backgroundTextStyle: z.enum(['dark', 'light']).optional(),
  enablePullDownRefresh: z.boolean().optional(),
  onReachBottomDistance: z.number().optional(),
  orientation: z.enum(['portrait', 'landscape', 'auto']).optional(),
});

export const MiniAppManifestSchema = z.object({
  appId: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  entry: z.string().default('index.html'),
  pages: z.array(z.string()).min(1),
  window: ManifestWindowSchema.optional(),
  subpackages: z.array(SubpackageSchema).optional(),
  subPackages: z.array(SubpackageSchema).optional(),
  permissions: z.array(z.string()).optional(),
  signature: z.string().optional(),
  sha256: z.string().optional(),
});

export type MiniAppManifest = z.infer<typeof MiniAppManifestSchema>;

export interface AssetRecord {
  appId: string;
  path: string;
  content: Buffer;
  mimeType: string;
  sha256: string;
  etag: string;
  size: number;
  updatedAt: number;
}
