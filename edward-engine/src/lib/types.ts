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

export type MetricSource =
  | "api"
  | "ocr"
  | "manual"
  | "browser"
  | "vision";

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

export type AssetFamily =
  | "no_media"
  | "single_screenshot"
  | "multi_screenshot"
  | "camera_photo"
  | "analytics_screenshot"
  | "product_code_screenshot"
  | "mixed"
  | "unknown";

export type ConfidenceLabel = "low" | "medium" | "high";

export type CtaType =
  | "comment"
  | "follow"
  | "connect"
  | "share"
  | "react"
  | "reply"
  | "none";

export type LengthBucket = "short" | "medium" | "long";

export type SpacingDensity = "tight" | "balanced" | "airy";

export type LocalReaderCaptureMethod =
  | "manual"
  | "ocr"
  | "browser"
  | "vision";

export type LocalReaderSyncMode = "deep" | "snapshot";

export type OptimizationPresetId = "engagement" | "business" | "career";

export type ScoreMetric =
  | "impressions"
  | "likes"
  | "comments"
  | "reposts"
  | "followers"
  | "profileViews"
  | "profileAppearances"
  | "connectionRequests"
  | "founderSignals"
  | "recruiterSignals";

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
  remoteUrl?: string;
  mimeType: string;
  uploadedAt: string;
  source: "composer" | "import" | "browser";
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

export type AccountMetricSnapshot = {
  id: string;
  platform: Platform;
  source: MetricSource;
  capturedAt: string;
  pageUrl?: string;
  followers?: number;
  profileViews?: number;
  profileAppearances?: number;
  postImpressions?: number;
  connectionRequests?: number;
  rawText?: string;
  captureMethod: LocalReaderCaptureMethod;
  confidence: number;
};

export type CommentNote = {
  id: string;
  publicationId: string;
  authorName: string;
  authorType: "founder" | "recruiter" | "engineer" | "friend" | "unknown";
  note: string;
  replyStatus: "not_replied" | "replied" | "manual";
  tags: string[];
  source: "manual" | "browser";
  createdAt: string;
};

export type CaptureArtifact = {
  id: string;
  platform: Platform;
  publicationId?: string;
  pageUrl?: string;
  pageKind: "profile" | "activity" | "post" | "analytics" | "unknown";
  cropKind: "full" | "body" | "metrics" | "media" | "comments" | "unknown";
  filePath: string;
  publicUrl?: string;
  mimeType: string;
  captureMethod: LocalReaderCaptureMethod;
  confidence: number;
  createdAt: string;
};

export type LocalReaderConfig = {
  pairToken?: string;
  appOrigin?: string;
  pairedAt?: string;
  lastSyncedAt?: string;
  profileUrlHint?: string;
  extensionVersion?: string;
  runnerStatus?: "ready" | "busy" | "needs_login" | "missing" | "failed";
  runnerSession?: "unknown" | "valid" | "needs_login";
  recentPostLimit?: number;
  savedTimezones?: string[];
  primaryTimezone?: string;
  snapshotScheduleEnabled?: boolean;
  snapshotCadenceHours?: number;
  preferredBrowserMode?: "headless" | "visible";
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
  localReader?: LocalReaderConfig;
};

export type ManualEvidence = {
  id: string;
  publicationId: string;
  platform: Platform;
  url?: string;
  assetIds: string[];
  ocrText?: string;
  extractedText?: string;
  notes?: string;
  verified: boolean;
  captureMethod: LocalReaderCaptureMethod;
  extractionConfidence: number;
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

export type PostFeatureSet = {
  id: string;
  publicationId: string;
  platform: Platform;
  extractedAt: string;
  hookType: HookType;
  hasQuestionHook: boolean;
  usesNumberedList: boolean;
  paragraphCount: number;
  spacingDensity: SpacingDensity;
  ctaType: CtaType;
  assetCount: number;
  assetFamily: AssetFamily;
  assetFamilyConfidence: ConfidenceLabel;
  proofType: ProofType;
  wordCount: number;
  characterCount: number;
  firstLineLength: number;
  postingHour?: number;
  postingWeekday?: string;
  lengthBucket: LengthBucket;
  lane: ContentLane | "unknown";
};

export type OptimizationPreset = {
  id: OptimizationPresetId;
  name: string;
  description: string;
  weights: Partial<Record<ScoreMetric, number>>;
};

export type LocalSyncRun = {
  id: string;
  platform: Platform;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "succeeded" | "partial" | "failed";
  mode?: LocalReaderSyncMode;
  pagesVisited: number;
  publicationsTouched: number;
  commentsCaptured: number;
  error?: string;
};

export type EngineStore = {
  version: number;
  contentItems: ContentItem[];
  platformVariants: PlatformVariant[];
  mediaAssets: MediaAsset[];
  publications: Publication[];
  metricSnapshots: MetricSnapshot[];
  accountMetricSnapshots: AccountMetricSnapshot[];
  commentNotes: CommentNote[];
  accountConnections: AccountConnection[];
  manualEvidence: ManualEvidence[];
  postFeatureSets: PostFeatureSet[];
  captureArtifacts: CaptureArtifact[];
  localSyncRuns: LocalSyncRun[];
  optimizationPresets: OptimizationPreset[];
  selectedOptimizationPresetId: OptimizationPresetId;
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
