/**
 * Comment Parser - Provides utilities for parsing comment data from various sources
 * Common patterns:
 * - JSON state extraction from window.__PRELOADED_STATE__
 * - HTML fallback parsing with CSS selectors
 * - Reaction parsing for empathized/understood/questioning
 * - Nested reply extraction
 * - "続きを見る" (View more) expansion
 */

export interface ScrapedCommentReaction {
  empathized: number;
  understood: number;
  questioning: number;
}

export interface CommentReply {
  commentId?: string;
  author?: string;
  content: string;
  postedAt?: string;
  reactions?: ScrapedCommentReaction;
}

export interface ScrapedComment {
  commentId?: string;
  author?: string;
  content: string;
  postedAt?: string;
  likes: number;
  repliesCount: number;
  reactions: ScrapedCommentReaction;
  replies: CommentReply[];
}

/**
 * Extract comments from JSON state (window.__PRELOADED_STATE__)
 * @param page Puppeteer page instance
 * @param reqId Request ID for logging
 * @returns Array of extracted comments
 */
export async function extractCommentsFromJSON(page: any, reqId: string): Promise<ScrapedComment[]> {
  try {
    const comments = await page.evaluate(() => {
      const results: ScrapedComment[] = [];

      // Try to get preloaded state
      const preloadedState = (window as any).__PRELOADED_STATE__;
      if (!preloadedState) {
        return results;
      }

      // Navigate through the state structure to find comments
      const state = preloadedState?.responseCache || preloadedState;
      if (!state) {
        return results;
      }

      // Look for comments data in the state
      const stateKeys = Object.keys(state);
      for (const key of stateKeys) {
        const data = state[key];
        if (data?.comments) {
          const commentsData = data.comments;

          // Process comments based on structure
          const commentsList = commentsData.items || commentsData.data || commentsData;
          if (!Array.isArray(commentsList)) {
            continue;
          }

          for (const comment of commentsList) {
            // Extract comment data from various possible structures
            const commentData = comment.comment || comment;

            // Extract author
            let author: string | undefined;
            if (commentData.author?.nickname) {
              author = commentData.author.nickname;
            } else if (commentData.author?.name) {
              author = commentData.author.name;
            } else if (commentData.userProfile?.nickname) {
              author = commentData.userProfile.nickname;
            }

            // Extract content
            let content = '';
            if (commentData.content?.text) {
              content = commentData.content.text;
            } else if (commentData.body) {
              content = commentData.body;
            } else if (commentData.text) {
              content = commentData.text;
            }

            // Extract postedAt
            let postedAt: string | undefined;
            if (commentData.postedAt || commentData.created_at) {
              postedAt = commentData.postedAt || commentData.created_at;
            } else if (commentData.createdAt) {
              postedAt = commentData.createdAt;
            }

            // Extract reactions
            const reactions: ScrapedCommentReaction = {
              empathized: 0,
              understood: 0,
              questioning: 0
            };

            if (commentData.reactions) {
              if (commentData.reactions.empathized || commentData.reactions.agree) {
                reactions.empathized = commentData.reactions.empathized || commentData.reactions.agree || 0;
              }
              if (commentData.reactions.understood || commentData.reactions.insightful) {
                reactions.understood = commentData.reactions.understood || commentData.reactions.insightful || 0;
              }
              if (commentData.reactions.questioning || commentData.reactions.doubtful) {
                reactions.questioning = commentData.reactions.questioning || commentData.reactions.doubtful || 0;
              }
            } else if (commentData.likes !== undefined) {
              reactions.empathized = commentData.likes;
            }

            // Extract replies count
            let repliesCount = 0;
            if (commentData.repliesCount !== undefined) {
              repliesCount = commentData.repliesCount;
            } else if (commentData.reply_count !== undefined) {
              repliesCount = commentData.reply_count;
            }

            results.push({
              commentId: commentData.id || commentData.comment_id || commentData.pid,
              author,
              content,
              postedAt,
              likes: reactions.empathized, // For backwards compatibility
              repliesCount,
              reactions,
              replies: [] // Will be populated separately
            });
          }
        }
      }

      return results;
    });

    return comments;
  } catch (error) {
    console.error(`[CommentParser] JSON extraction failed:`, error);
    return [];
  }
}

/**
 * Extract comments from HTML elements as fallback
 * @param page Puppeteer page instance
 * @param reqId Request ID for logging
 * @returns Array of extracted comments
 */
export async function extractCommentsFromHTML(page: any, reqId: string): Promise<ScrapedComment[]> {
  try {
    const comments = await page.evaluate(() => {
      const results: ScrapedComment[] = [];

      // Yahoo News comment selectors
      const commentSelectors = [
        '.viewableWrapper article',
        'article[class*="iwTXsY"]',
        '[data-comment-id]',
        '.comment-item',
        '.Comment'
      ];

      for (const selector of commentSelectors) {
        const commentElements = document.querySelectorAll(selector);
        if (commentElements.length > 0) {
          commentElements.forEach(el => {
            // Extract comment ID
            let commentId: string | undefined;
            const articleEl = el.closest('article');
            if (articleEl?.id) {
              commentId = articleEl.id;
            } else {
              commentId = el.getAttribute('data-comment-id') || undefined;
            }

            // Extract author from user link
            let author: string | undefined;
            const authorLink = el.querySelector('a[href*="/users/"]');
            if (authorLink) {
              author = authorLink.textContent?.trim() || undefined;
            }

            // Extract content from p tags (excluding time/dialog classes)
            const pTags = el.querySelectorAll('p');
            let content = '';
            for (const p of pTags) {
              const classList = Array.from(p.classList || []);
              const isTimeOrDialog = classList.some(c =>
                c.includes('time') || c.includes('dialog') || c.includes('meta')
              );
              if (!isTimeOrDialog) {
                const text = p.textContent?.trim();
                if (text) {
                  content += text + '\n';
                }
              }
            }
            content = content.trim();

            // Extract timestamp
            let postedAt: string | undefined;
            const timeEl = el.querySelector('time');
            if (timeEl) {
              postedAt = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || undefined;
            }

            // Extract reactions
            const reactions: ScrapedCommentReaction = {
              empathized: 0,
              understood: 0,
              questioning: 0
            };

            // Try to find reaction counts
            const reactionElements = el.querySelectorAll('[class*="reaction"], [class*="empathize"], [class*="agree"]');
            reactionElements.forEach(reactionEl => {
              const text = reactionEl.textContent || '';
              if (text.includes('共感')) {
                const match = text.match(/\d+/);
                if (match) reactions.empathized = parseInt(match[0], 10);
              } else if (text.includes('なるほど')) {
                const match = text.match(/\d+/);
                if (match) reactions.understood = parseInt(match[0], 10);
              } else if (text.includes('うーん')) {
                const match = text.match(/\d+/);
                if (match) reactions.questioning = parseInt(match[0], 10);
              }
            });

            // Extract replies count
            let repliesCount = 0;
            const replyButton = el.querySelector('button');
            if (replyButton) {
              const replyText = replyButton.textContent || '';
              const match = replyText.match(/返信\s*(\d+)/);
              if (match) {
                repliesCount = parseInt(match[1], 10);
              }
            }

            if (content.length > 0) {
              results.push({
                commentId,
                author,
                content,
                postedAt,
                likes: reactions.empathized,
                repliesCount,
                reactions,
                replies: []
              });
            }
          });

          // Break if we found comments
          if (results.length > 0) {
            break;
          }
        }
      }

      return results;
    });

    return comments;
  } catch (error) {
    console.error(`[CommentParser] HTML extraction failed:`, error);
    return [];
  }
}

/**
 * Expand truncated comments by clicking "続きを見る" (View more) links
 * @param page Puppeteer page instance
 * @param comments Array of comments to expand
 * @param reqId Request ID for logging
 * @returns Updated array of comments with expanded content
 */
export async function expandTruncatedComments(
  page: any,
  comments: ScrapedComment[],
  reqId: string
): Promise<ScrapedComment[]> {
  try {
    const expandedComments = await page.evaluate((commentIds) => {
      const expanded: Array<{ commentId?: string; content: string }> = [];

      for (const id of commentIds) {
        const commentEl = id ? document.getElementById(id) : null;
        if (!commentEl) continue;

        // Look for "続きを見る" (View more) buttons
        const expandButton = commentEl.querySelector('button') as HTMLElement;
        const expandText = expandButton?.textContent || '';

        if (expandText.includes('続き') || expandText.includes('もっと見') || expandText.includes('展開')) {
          expandButton?.click();
        }

        // Extract updated content
        const pTags = commentEl.querySelectorAll('p');
        let content = '';
        for (const p of pTags) {
          const classList = Array.from(p.classList || []);
          const isTimeOrDialog = classList.some(c =>
            c.includes('time') || c.includes('dialog') || c.includes('meta')
          );
          if (!isTimeOrDialog) {
            const text = p.textContent?.trim();
            if (text) {
              content += text + '\n';
            }
          }
        }

        expanded.push({
          commentId: id,
          content: content.trim()
        });
      }

      return expanded;
    }, comments.map(c => c.commentId || ''));

    // Update comments with expanded content
    for (const expanded of expandedComments) {
      const comment = comments.find(c => c.commentId === expanded.commentId);
      if (comment && expanded.content.length > comment.content.length) {
        comment.content = expanded.content;
      }
    }

    return comments;
  } catch (error) {
    console.error(`[CommentParser] Failed to expand truncated comments:`, error);
    return comments;
  }
}

/**
 * Extract nested replies by clicking "返信" (Reply) buttons
 * @param page Puppeteer page instance
 * @param comments Array of comments to extract replies for
 * @param reqId Request ID for logging
 * @returns Updated array of comments with nested replies
 */
export async function extractNestedReplies(
  page: any,
  comments: ScrapedComment[],
  reqId: string
): Promise<ScrapedComment[]> {
  try {
    const commentsWithReplies = await page.evaluate((commentIds) => {
      const results: Array<{ commentId?: string; replies: CommentReply[] }> = [];

      for (const id of commentIds) {
        if (!id) continue;

        const commentEl = document.getElementById(id);
        if (!commentEl) continue;

        // Look for reply buttons
        const buttons = commentEl.querySelectorAll('button');
        for (const button of buttons) {
          const text = button.textContent || '';
          const match = text.match(/返信\s*(\d+)/);

          if (match) {
            const replyCount = parseInt(match[1], 10);
            if (replyCount > 0) {
              button.click();

              // Extract reply content
              const replies: CommentReply[] = [];
              const replyElements = commentEl.querySelectorAll('article article, .reply, [class*="reply"]');

              replyElements.forEach(replyEl => {
                // Extract reply ID
                const replyArticle = replyEl.closest('article');
                const replyId = replyArticle?.id || replyEl.getAttribute('data-comment-id') || undefined;

                // Extract reply author
                let author: string | undefined;
                const authorLink = replyEl.querySelector('a[href*="/users/"]');
                if (authorLink) {
                  author = authorLink.textContent?.trim() || undefined;
                }

                // Extract reply content
                const pTags = replyEl.querySelectorAll('p');
                let content = '';
                for (const p of pTags) {
                  const classList = Array.from(p.classList || []);
                  const isTimeOrDialog = classList.some(c =>
                    c.includes('time') || c.includes('dialog') || c.includes('meta')
                  );
                  if (!isTimeOrDialog) {
                    const text = p.textContent?.trim();
                    if (text) {
                      content += text + '\n';
                    }
                  }
                }

                // Extract reply timestamp
                let postedAt: string | undefined;
                const timeEl = replyEl.querySelector('time');
                if (timeEl) {
                  postedAt = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || undefined;
                }

                // Extract reply reactions
                const reactions: ScrapedCommentReaction = {
                  empathized: 0,
                  understood: 0,
                  questioning: 0
                };

                const reactionElements = replyEl.querySelectorAll('[class*="reaction"]');
                reactionElements.forEach(reactionEl => {
                  const rText = reactionEl.textContent || '';
                  if (rText.includes('共感')) {
                    const rMatch = rText.match(/\d+/);
                    if (rMatch) reactions.empathized = parseInt(rMatch[0], 10);
                  } else if (rText.includes('なるほど')) {
                    const rMatch = rText.match(/\d+/);
                    if (rMatch) reactions.understood = parseInt(rMatch[0], 10);
                  } else if (rText.includes('うーん')) {
                    const rMatch = rText.match(/\d+/);
                    if (rMatch) reactions.questioning = parseInt(rMatch[0], 10);
                  }
                });

                if (content.trim().length > 0) {
                  replies.push({
                    commentId: replyId,
                    author,
                    content: content.trim(),
                    postedAt,
                    reactions
                  });
                }
              });

              results.push({
                commentId: id,
                replies
              });
            }
          }
        }
      }

      return results;
    }, comments.map(c => c.commentId || ''));

    // Update comments with replies
    for (const item of commentsWithReplies) {
      const comment = comments.find(c => c.commentId === item.commentId);
      if (comment) {
        comment.replies = item.replies;
      }
    }

    return comments;
  } catch (error) {
    console.error(`[CommentParser] Failed to extract nested replies:`, error);
    return comments;
  }
}

/**
 * Main comment extraction pipeline with multiple strategies
 * @param page Puppeteer page instance
 * @param reqId Request ID for logging
 * @returns Array of fully extracted comments
 */
export async function extractAllComments(page: any, reqId: string): Promise<ScrapedComment[]> {
  let comments: ScrapedComment[] = [];

  // Strategy 1: Try JSON extraction first
  comments = await extractCommentsFromJSON(page, reqId);

  if (comments.length === 0) {
    // Strategy 2: Fallback to HTML parsing
    comments = await extractCommentsFromHTML(page, reqId);
  }

  // Strategy 3: Expand truncated comments
  comments = await expandTruncatedComments(page, comments, reqId);

  // Strategy 4: Extract nested replies
  comments = await extractNestedReplies(page, comments, reqId);

  return comments;
}
