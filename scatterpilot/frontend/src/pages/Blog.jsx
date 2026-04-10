import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import BlogCard from '../components/Blog/BlogCard';
import { getAllPosts } from '../utils/blogUtils';
import analytics from '../utils/analytics';

// ── Shared blog nav ───────────────────────────────────────────────────────────

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
          <Link to="/" className="text-body-sm text-ink-secondary hover:text-ink-primary transition-colors">
            Home
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

export default function Blog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analytics.event('Blog', 'View', 'Blog_List');

    async function loadPosts() {
      try {
        const allPosts = await getAllPosts();
        setPosts(allPosts);
      } catch (error) {
        console.error('Error loading posts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadPosts();
  }, []);

  const featuredPost = posts.find(post => post.featured);
  const regularPosts = posts.filter(post => !post.featured);

  return (
    <>
      <Helmet>
        <title>ScatterPilot Blog — Invoicing Tips, Guides & Insights</title>
        <meta name="description" content="Expert tips on invoicing, freelancing, and productivity. Learn how to save time, get paid faster, and grow your business." />
        <meta property="og:title" content="ScatterPilot Blog — Invoicing Tips & Guides" />
        <meta property="og:description" content="Expert tips on invoicing, freelancing, and productivity." />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://scatterpilot.com/blog" />
      </Helmet>

      <div className="min-h-screen bg-surface-bg flex flex-col">
        <BlogNav />

        {/* Hero */}
        <section className="bg-white border-b border-surface-border py-16 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-sage-50 border border-sage-200 rounded-pill text-label text-sage-600 font-medium mb-5">
              <div className="w-1.5 h-1.5 rounded-full bg-sage-500" />
              ScatterPilot Blog
            </div>
            <h1 className="text-display font-semibold text-ink-primary mb-3">
              Invoicing tips & insights
            </h1>
            <p className="text-body-lg text-ink-secondary">
              Tips, guides, and insights on invoicing, freelancing, and productivity.
              Learn how to save time, get paid faster, and grow your business.
            </p>
          </div>
        </section>

        {/* Posts */}
        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-8 h-8 rounded-full border-2 border-sage-200 border-t-sage-500 animate-spin" />
              <p className="text-body-sm text-ink-tertiary">Loading posts…</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-body text-ink-secondary">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {featuredPost && (
                <section className="mb-12">
                  <h2 className="text-heading font-semibold text-ink-primary mb-5">Featured</h2>
                  <BlogCard post={featuredPost} featured={true} />
                </section>
              )}
              {regularPosts.length > 0 && (
                <section>
                  <h2 className="text-heading font-semibold text-ink-primary mb-5">Latest Posts</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {regularPosts.map(post => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {/* CTA */}
        <section className="bg-sage-900 py-16 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-display font-semibold text-white mb-3">
              Ready to save hours on invoicing?
            </h2>
            <p className="text-body-lg text-sage-200 mb-8">
              Create professional invoices in 30 seconds with AI-powered ScatterPilot
            </p>
            <Link
              to="/app"
              onClick={() => analytics.event('CTA', 'Click', 'Blog_Bottom_CTA')}
              className="inline-block px-8 py-3 bg-white hover:bg-surface-bg text-sage-900 rounded-button font-semibold text-body transition-colors duration-150"
            >
              Start Free Trial
            </Link>
            <p className="text-label text-sage-300 mt-4">No credit card required</p>
          </div>
        </section>

        <BlogFooter />
      </div>
    </>
  );
}
