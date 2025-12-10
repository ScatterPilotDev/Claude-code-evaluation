import matter from 'gray-matter';
import { marked } from 'marked';

// Calculate reading time
function calculateReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} min read`;
}

// Get all blog posts using Vite's import.meta.glob
export async function getAllPosts() {
  // Import all markdown files from content/blog directory
  const postFiles = import.meta.glob('../content/blog/*.md', { query: '?raw', import: 'default', eager: true });

  const posts = Object.entries(postFiles).map(([filepath, content]) => {
    const { data, content: markdown } = matter(content);

    // Extract slug from filename
    const slug = filepath.split('/').pop().replace('.md', '');

    return {
      slug,
      ...data,
      readingTime: calculateReadingTime(markdown),
      wordCount: markdown.trim().split(/\s+/).length,
      excerpt: data.description || markdown.substring(0, 160) + '...'
    };
  });

  // Filter unpublished posts and sort by date
  return posts
    .filter(post => post.published !== false)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Get single post by slug
export async function getPostBySlug(slug) {
  try {
    // Dynamically import the specific markdown file
    const postFiles = import.meta.glob('../content/blog/*.md', { query: '?raw', import: 'default', eager: true });

    // Find the post that matches the slug
    const entry = Object.entries(postFiles).find(([path]) =>
      path.includes(`/${slug}.md`)
    );

    if (!entry) {
      throw new Error(`Post not found: ${slug}`);
    }

    const [, content] = entry;
    const { data, content: markdown } = matter(content);

    // Configure marked for better security and features
    marked.setOptions({
      gfm: true, // GitHub Flavored Markdown
      breaks: true, // Convert \n to <br>
      headerIds: true, // Add IDs to headers for TOC
      mangle: false, // Don't escape autolinked email addresses
      sanitize: false // We trust our own markdown
    });

    // Convert markdown to HTML
    const contentHtml = marked(markdown);

    // Extract headings for table of contents
    const headings = extractHeadings(markdown);

    return {
      slug,
      contentHtml,
      headings,
      readingTime: calculateReadingTime(markdown),
      wordCount: markdown.trim().split(/\s+/).length,
      ...data
    };
  } catch (error) {
    console.error('Error loading post:', error);
    throw error;
  }
}

// Extract headings from markdown for table of contents
function extractHeadings(markdown) {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length; // Number of # characters
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    headings.push({
      level,
      text,
      id
    });
  }

  return headings;
}

// Get related posts by tags
export async function getRelatedPosts(currentSlug, tags, limit = 3) {
  const allPosts = await getAllPosts();

  if (!tags || tags.length === 0) {
    // If no tags, return most recent posts
    return allPosts
      .filter(post => post.slug !== currentSlug)
      .slice(0, limit);
  }

  return allPosts
    .filter(post => post.slug !== currentSlug)
    .map(post => ({
      ...post,
      matchScore: post.tags?.filter(tag => tags.includes(tag)).length || 0
    }))
    .sort((a, b) => {
      // Sort by match score first, then by date
      if (b.matchScore !== a.matchScore) {
        return b.matchScore - a.matchScore;
      }
      return new Date(b.date) - new Date(a.date);
    })
    .slice(0, limit);
}

// Format date
export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Generate blog sitemap data (for future use)
export async function getBlogSitemapData() {
  const posts = await getAllPosts();
  return posts.map(post => ({
    url: `https://scatterpilot.com/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: 'monthly',
    priority: 0.7
  }));
}
