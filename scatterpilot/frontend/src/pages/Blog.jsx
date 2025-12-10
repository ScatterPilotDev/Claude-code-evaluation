import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SparklesIcon } from '@heroicons/react/24/outline';
import BlogCard from '../components/Blog/BlogCard';
import { getAllPosts } from '../utils/blogUtils';
import analytics from '../utils/analytics';

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
        <title>ScatterPilot Blog - Invoicing Tips, Guides & Insights</title>
        <meta
          name="description"
          content="Expert tips on invoicing, freelancing, and productivity. Learn how to save time, get paid faster, and grow your business."
        />
        <meta property="og:title" content="ScatterPilot Blog - Invoicing Tips & Guides" />
        <meta
          property="og:description"
          content="Expert tips on invoicing, freelancing, and productivity."
        />
        <meta property="og:type" content="website" />
        <link rel="canonical" href="https://scatterpilot.com/blog" />
      </Helmet>

      <div className="min-h-screen bg-slate-950">
        {/* Navigation */}
        <nav className="border-b border-slate-700 bg-slate-900/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center">
                <SparklesIcon className="h-8 w-8 text-purple-400" />
                <span className="ml-2 text-xl font-bold bg-gradient-brand bg-clip-text text-transparent">
                  ScatterPilot
                </span>
              </Link>
              <div className="flex items-center space-x-4">
                <Link
                  to="/"
                  className="font-medium text-slate-400 hover:text-slate-100 transition-colors"
                >
                  Home
                </Link>
                <Link
                  to="/app"
                  className="px-6 py-2.5 bg-gradient-brand text-white rounded-lg font-semibold hover:bg-gradient-brand-hover transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  Get Started Free
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Header */}
        <header className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
              ScatterPilot Blog
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed">
              Tips, guides, and insights on invoicing, freelancing, and productivity.
              <br />
              Learn how to save time, get paid faster, and grow your business.
            </p>
          </div>
        </header>

        {/* Blog Posts */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
              <p className="mt-4 text-slate-400">Loading posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-xl text-slate-400">No blog posts yet. Check back soon!</p>
            </div>
          ) : (
            <>
              {/* Featured Post */}
              {featuredPost && (
                <section className="mb-16">
                  <h2 className="text-2xl font-bold text-slate-100 mb-6">Featured Post</h2>
                  <BlogCard post={featuredPost} featured={true} />
                </section>
              )}

              {/* Regular Posts Grid */}
              {regularPosts.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold text-slate-100 mb-6">Latest Posts</h2>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {regularPosts.map(post => (
                      <BlogCard key={post.slug} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>

        {/* CTA Section */}
        <section className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-white mb-4">
              Ready to save hours on invoicing?
            </h2>
            <p className="text-xl text-purple-100 mb-8">
              Create professional invoices in 30 seconds with AI-powered ScatterPilot
            </p>
            <Link
              to="/app"
              onClick={() => analytics.event('CTA', 'Click', 'Blog_Bottom_CTA')}
              className="inline-block px-10 py-5 bg-white text-purple-600 rounded-lg font-bold text-xl hover:bg-slate-100 transition-all duration-300 transform hover:scale-105 shadow-2xl"
            >
              Start Free Trial
            </Link>
            <p className="text-purple-200 mt-4">No credit card required</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-slate-900 text-slate-400 border-t border-slate-800">
          <div className="max-w-7xl mx-auto text-center">
            <div className="flex items-center justify-center mb-4">
              <SparklesIcon className="h-8 w-8 text-purple-400" />
              <span className="ml-2 text-xl font-bold text-white">ScatterPilot</span>
            </div>
            <p className="text-sm">&copy; 2025 ScatterPilot. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </>
  );
}
