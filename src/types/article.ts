/**
 * Type definitions for article scraper
 */

// Article status values
export type ArticleStatus = 'pending' | 'not_available' | 'retry_1' | 'retry_2' | 'error' | 'scraped_v1' | 'scraped_v2';

// Database article record
export interface Article {
  id: number;
  pickId: string;
  articleId?: string;
  articleUrl?: string;
  status: ArticleStatus;
  title?: string;
  source?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  detectedAt: string;
  firstScrapedAt?: string;
  secondScrapedAt?: string;
  scheduledRescrapeAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Database article version record
export interface ArticleVersion {
  id: number;
  articleId: number;
  version: number;
  content: string;
  contentText?: string;
  pageCount: number;
  images?: string; // JSON string of image URLs
  scrapedAt: string;
  createdAt: string;
}

// Reaction breakdown for Yahoo News comments
export interface CommentReactions {
  empathized: number;   // "共感した" count
  understood: number;   // "なるほど" count
  questioning: number;  // "うーん" count
}

// Reply data structure (nested within parent comment)
export interface CommentReply {
  commentId?: string;
  author?: string;
  content: string;
  postedAt?: string;
  reactions?: CommentReactions;
}

// Database article comment record
export interface ArticleComment {
  id: number;
  articleId: number;
  version: number;
  commentId?: string;
  author?: string;
  content: string;
  postedAt?: string;
  likes: number;
  repliesCount: number;
  reactionsEmpathized: number;
  reactionsUnderstood: number;
  reactionsQuestioning: number;
  replies?: string; // JSON string of CommentReply[]
  scrapedAt: string;
  createdAt: string;
}

// Scraped article data (from scraping)
export interface ScrapedArticleData {
  articleUrl: string;
  articleId?: string;
  title: string;
  source?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  content: string;
  contentText?: string;
  pageCount: number;
  images: string[];
}

// Scraped comment data (from scraping)
export interface ScrapedComment {
  commentId?: string;
  author?: string;
  content: string;
  postedAt?: string;
  likes: number;
  repliesCount: number;
  reactions: CommentReactions;     // Reaction breakdown
  replies: CommentReply[];          // Embedded nested replies
}

// Workflow input parameters
export interface ArticleScraperParams {
  pickId: string;
  isRescrape?: boolean;
}

// Workflow result
export interface ArticleScraperResult {
  success: boolean;
  pickId: string;
  status?: ArticleStatus;
  articleUrl?: string;
  title?: string;
  error?: string;
}

// Rescrape workflow input (empty - triggered by cron)
export interface ArticleRescrapeParams {
  // Empty - cron triggered
}

// Rescrape workflow result
export interface ArticleRescrapeResult {
  success: boolean;
  triggeredCount: number;
  pickIds: string[];
  error?: string;
}

// Article API response (for frontend)
export interface ArticleApiResponse {
  article: Article;
  versions: ArticleVersion[];
  comments: ArticleComment[];
}
