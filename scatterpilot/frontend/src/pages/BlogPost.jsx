import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getPostBySlug, getRelatedPosts, formatDate } from '../utils/blogUtils';
import TableOfContents from '../components/Blog/TableOfContents';
import ShareButtons from '../components/Blog/ShareButtons';
import BlogCard from '../components/Blog/BlogCard';
import analytics from '../utils/analytics';

// ── Shared blog nav (same as Blog.jsx) ───────────────────────────────────────

function BlogNav() {
  return (
    <header className="sticky top-0 z-50 h-16 flex items-center bg-white/90 backdrop-blur-md border-b border-surface-border">
      <div className="max-w-6xl mx-auto w-full px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-sage-500 rounded-lg flex items-center justify-center">
            <span className="text-ink-inverse font-bold text-sm" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>S</span>
          </div>
          <span className="font-semibold text-ink-primary" style={{ fontFamily: '"DM Sans", system-ui, sans-serif' }}>ScatterPilot</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/blog" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors">
            Blog
          </Link>
          <Link
            to="/app"
            className="px-4 py-2 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button text-body-sm font-medium transition-colors duration-150"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </header>
  );
}

function BlogFooter() {
  return (
    <footer className="bg-ink-primary py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-sage-500 rounded flex items-center justify-center">
            <span className="text-ink-inverse font-bold text-xs">S</span>
          </div>
          <span className="font-semibold text-white text-body-sm">ScatterPilot</span>
        </div>
        <p className="text-label text-sage-400">© 2026 ScatterPilot. All rights reserved.</p>
      </div>
    </footer>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadPost() {
      try {
        setLoading(true);
        setError(null);

        const postData = await getPostBySlug(slug);
        setPost(postData);

        analytics.event('Blog', 'View', `Blog_Post_${slug}`);

        const related = await getRelatedPosts(slug, postData.tags);
        setRelatedPosts(related);

        setTimeout(() => {
          if (postData.headings) {
            postData.headings.forEach(heading => {
              const elements = document.querySelectorAll('h2, h3');
              elements.forEach(el => {
                const text = el.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                if (text === heading.id) {
                  el.id = heading.id;
                }
              });
            });
          }
        }, 100);
      } catch (err) {
        console.error('Error loading post:', err);
        setError('Post not found');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-bg flex flex-col">
        <BlogNav />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-sage-200 border-t-sage-500 animate-spin" />
          <p className="text-body-sm text-ink-tertiary">Loading post…</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-surface-bg flex flex-col">
        <BlogNav />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-4">
          <h1 className="text-heading-lg text-ink-primary">Post Not Found</h1>
          <p className="text-body text-ink-secondary">The blog post you're looking for doesn't exist.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-500 hover:bg-sage-600 text-ink-inverse rounded-button font-medium text-body transition-colors"
          >
            ← Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const postUrl = `https://scatterpilot.com/blog/${post.slug}`;

  return (
    <>
      <Helmet>
        <title>{post.title} | ScatterPilot Blog</title>
        <meta name="description" content={post.description} />
        <meta name="author" content={post.author} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        {post.image && <meta property="og:image" content={`https://scatterpilot.com${post.image}`} />}
        <meta property="og:url" content={postUrl} />
        <meta property="article:published_time" content={post.date} />
        <meta property="article:author" content={post.author} />
        {post.tags && post.tags.map(tag => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.description} />
        {post.image && <meta name="twitter:image" content={`https://scatterpilot.com${post.image}`} />}
        <link rel="canonical" href={postUrl} />
      </Helmet>

      <div className="min-h-screen bg-surface-bg flex flex-col">
        <BlogNav />

        <article className="flex-1 max-w-6xl mx-auto w-full px-6 py-10">
          {/* Back */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-body-sm text-sage-500 hover:text-sage-600 mb-8 transition-colors"
          >
            ← Back to Blog
          </Link>

          {/* Post header */}
          <header className="mb-10">
            {post.image && (
              <img
                src={post.image}
                alt={post.imageAlt || post.title}
                className="w-full max-w-4xl mx-auto rounded-card shadow-modal mb-8"
              />
            )}
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 text-body-sm text-ink-tertiary mb-4">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>·</span>
                <span>{post.readingTime}</span>
                <span>·</span>
                <span>{post.author}</span>
              </div>
              <h1 className="text-display font-bold text-ink-primary mb-5 leading-tight">
                {post.title}
              </h1>
              <p className="text-body-lg text-ink-secondary leading-relaxed mb-6">
                {post.description}
              </p>
              <ShareButtons title={post.title} url={postUrl} />
            </div>
          </header>

          {/* Content + TOC */}
          <div className="grid lg:grid-cols-[1fr_280px] gap-12 max-w-6xl mx-auto">
            <div
              className="prose prose-slate max-w-none
                prose-headings:text-ink-primary prose-headings:font-semibold
                prose-h2:text-heading-lg prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-heading prose-h3:mt-7 prose-h3:mb-3
                prose-p:text-ink-secondary prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-sage-500 prose-a:no-underline hover:prose-a:text-sage-600
                prose-strong:text-ink-primary prose-strong:font-semibold
                prose-ul:my-5 prose-li:text-ink-secondary prose-li:my-1.5
                prose-code:text-sage-600 prose-code:bg-sage-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-body-sm
                prose-pre:bg-sage-900 prose-pre:border prose-pre:border-sage-800
                prose-blockquote:border-l-sage-400 prose-blockquote:text-ink-secondary
                prose-img:rounded-card prose-img:shadow-card"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />
            <aside className="hidden lg:block">
              <TableOfContents headings={post.headings || []} />
            </aside>
          </div>

          {/* Post footer */}
          <footer className="max-w-4xl mx-auto mt-14 pt-8 border-t border-surface-border">
            {post.tags && post.tags.length > 0 && (
              <div className="mb-7">
                <h3 className="text-body-sm font-medium text-ink-tertiary mb-3">Tags:</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-sage-50 text-sage-600 rounded-badge border border-sage-200 text-body-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-10">
              <ShareButtons title={post.title} url={postUrl} />
            </div>

            {/* CTA box */}
            <div className="bg-sage-900 rounded-card p-8 text-center">
              <h3 className="text-heading font-semibold text-white mb-2">
                Ready to save hours on invoicing?
              </h3>
              <p className="text-body text-sage-200 mb-6">
                Create professional invoices in 30 seconds with ScatterPilot
              </p>
              <Link
                to="/app"
                onClick={() => analytics.event('CTA', 'Click', 'Blog_Post_CTA')}
                className="inline-block px-7 py-3 bg-white hover:bg-surface-bg text-sage-900 rounded-button font-semibold text-body transition-colors duration-150"
              >
                Try ScatterPilot Free →
              </Link>
              <p className="text-label text-sage-300 mt-3">No credit card required</p>
            </div>
          </footer>
        </article>

        {/* Related posts */}
        {relatedPosts.length > 0 && (
          <section className="border-t border-surface-border bg-white py-14 px-6">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-heading font-semibold text-ink-primary mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedPosts.map(relatedPost => (
                  <BlogCard key={relatedPost.slug} post={relatedPost} />
                ))}
              </div>
            </div>
          </section>
        )}

        <BlogFooter />
      </div>
    </>
  );
}
