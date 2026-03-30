export type Platform = "x" | "linkedin";

export type ContentLane =
  | "build_receipt"
  | "builder_story"
  | "industry_take"
  | "spicy_sidecar"
  | "conviction_story";

export type PublicationStatus =
  | "draft"
  | "published"
  | "imported"
  | "failed";

export type PublishMode = "through_app" | "imported";

export type MetricSource = "api" | "ocr" | "manual";

export type HookType =
  | "number_hook"
  | "question_hook"
  | "confession_hook"
  | "statement_hook";

export type ProofType =
  | "visual_proof"
  | "numeric_proof"
  | "story_proof"
  | "no_clear_proof";

export type CapabilityFlags = {
  canPublish: boolean;
  canReadProfile: "none" | "limited" | "full";
  canReadPosts: boolean;
  canReadComments: boolean;
  canReadPostAnalytics: boolean;
  requiresManualBackfill: boolean;
  privateLocalReaderAvailable: boolean;
};

export type ContentItem = {
  id: string;
  createdAt: string;
  updatedAt: string;
  rawIdea: string;
  thesis: string;
  sourceStory: string;
  relatedProduct: string;
  lane: ContentLane;
  tags: string[];
};

export type PlatformVariant = {
  id: string;
  contentItemId: string;
  platform: Platform;
  text: string;
  cta: string;
  assetIds: string[];
  guardrailIssues: string[];
  generationNotes: string[];
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: string;
  originalName: string;
  storedPath: string;
  publicUrl: string;
  mimeType: string;
  uploadedAt: string;
  source: "composer" | "import";
};

export type Publication = {
  id: string;
  contentItemId?: string;
  variantId?: string;
  platform: Platform;
  mode: PublishMode;
  status: PublicationStatus;
  title: string;
  finalText: string;
  assetIds: string[];
  externalId?: string;
  externalUrn?: string;
  canonicalUrl?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
};

export type MetricSnapshot = {
  id: string;
  publicationId: string;
  platform: Platform;
  source: MetricSource;
  capturedAt: string;
  impressions?: number;
  likes?: number;
  comments?: number;
  reposts?: number;
  membersReached?: number;
  followers?: number;
  profileViews?: number;
  rawText?: string;
};

export type CommentNote = {
  id: string;
  publicationId: string;
  authorName: string;
  authorType: "founder" | "recruiter" | "engineer" | "friend" | "unknown";
  note: string;
  replyStatus: "not_replied" | "replied" | "manual";
  tags: string[];
  createdAt: string;
};

export type AccountConnection = {
  id: string;
  platform: Platform;
  status: "connected" | "needs_setup";
  displayName: string;
  externalAccountId?: string;
  profileUrl?: string;
  authorUrn?: string;
  username?: string;
  scopes: string[];
  capabilityFlags: CapabilityFlags;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  connectedAt?: string;
};

export type ManualEvidence = {
  id: string;
  publicationId: string;
  platform: Platform;
  url?: string;
  assetIds: string[];
  ocrText?: string;
  notes?: string;
  verified: boolean;
  parsedMetrics: Partial<
    Pick<
      MetricSnapshot,
      | "impressions"
      | "likes"
      | "comments"
      | "reposts"
      | "membersReached"
      | "followers"
      | "profileViews"
    >
  >;
  createdAt: string;
};

export type EngineStore = {
  version: number;
  contentItems: ContentItem[];
  platformVariants: PlatformVariant[];
  mediaAssets: MediaAsset[];
  publications: Publication[];
  metricSnapshots: MetricSnapshot[];
  commentNotes: CommentNote[];
  accountConnections: AccountConnection[];
  manualEvidence: ManualEvidence[];
};

export type PublicationAnalysis = {
  hookType: HookType;
  proofType: ProofType;
  likelyReason: string;
  suggestedNextStep: string;
};

export type RepoSummary = {
  publishedCount: number;
  draftCount: number;
  latestPublished: { date: string; topic: string }[];
};
