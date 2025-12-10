import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SparklesIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { getPostBySlug, getRelatedPosts, formatDate } from '../utils/blogUtils';
import TableOfContents from '../components/Blog/TableOfContents';
import ShareButtons from '../components/Blog/ShareButtons';
import BlogCard from '../components/Blog/BlogCard';
import analytics from '../utils/analytics';

export default function BlogPost() {
  const { slug } = useParams();
  const navigate = useNavigate();
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

        // Track blog post view
        analytics.event('Blog', 'View', `Blog_Post_${slug}`);

        // Load related posts
        const related = await getRelatedPosts(slug, postData.tags);
        setRelatedPosts(related);

        // Add IDs to headings in the DOM for table of contents linking
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading post...</p>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-100 mb-4">Post Not Found</h1>
          <p className="text-slate-400 mb-8">The blog post you're looking for doesn't exist.</p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-brand text-white rounded-lg font-semibold hover:bg-gradient-brand-hover transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Blog
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

        {/* Open Graph / Facebook */}
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

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.description} />
        {post.image && <meta name="twitter:image" content={`https://scatterpilot.com${post.image}`} />}

        <link rel="canonical" href={postUrl} />
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
                  to="/blog"
                  className="font-medium text-slate-400 hover:text-slate-100 transition-colors"
                >
                  Blog
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

        {/* Article */}
        <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Back Button */}
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-8 transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Blog
          </Link>

          {/* Post Header */}
          <header className="mb-12">
            {post.image && (
              <img
                src={post.image}
                alt={post.imageAlt || post.title}
                className="w-full max-w-4xl mx-auto rounded-2xl shadow-2xl mb-8"
              />
            )}

            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-3 text-sm text-slate-400 mb-4">
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span>•</span>
                <span>{post.readingTime}</span>
                <span>•</span>
                <span>{post.author}</span>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                {post.title}
              </h1>

              <p className="text-xl text-slate-400 leading-relaxed mb-8">
                {post.description}
              </p>

              <ShareButtons title={post.title} url={postUrl} />
            </div>
          </header>

          {/* Post Content with Sidebar */}
          <div className="grid lg:grid-cols-[1fr_300px] gap-12 max-w-7xl mx-auto">
            {/* Main Content */}
            <div
              className="prose prose-invert prose-purple max-w-none
                prose-headings:text-slate-100 prose-headings:font-bold
                prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-4
                prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300
                prose-strong:text-slate-100 prose-strong:font-semibold
                prose-ul:my-6 prose-li:text-slate-300 prose-li:my-2
                prose-code:text-purple-400 prose-code:bg-slate-900 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-700
                prose-blockquote:border-l-purple-500 prose-blockquote:text-slate-300
                prose-img:rounded-xl prose-img:shadow-xl"
              dangerouslySetInnerHTML={{ __html: post.contentHtml }}
            />

            {/* Sidebar - Table of Contents */}
            <aside className="hidden lg:block">
              <TableOfContents headings={post.headings || []} />
            </aside>
          </div>

          {/* Post Footer */}
          <footer className="max-w-4xl mx-auto mt-16 pt-8 border-t border-slate-800">
            {/* Tags */}
            {post.tags && post.tags.length > 0 && (
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-slate-400 mb-3">Tags:</h3>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-4 py-2 bg-slate-900 text-purple-400 rounded-full border border-slate-700 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Share Again */}
            <div className="mb-12">
              <ShareButtons title={post.title} url={postUrl} />
            </div>

            {/* CTA Box */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-8 text-center text-white">
              <h3 className="text-2xl font-bold mb-3">Ready to save hours on invoicing?</h3>
              <p className="text-purple-100 mb-6">
                Create professional invoices in 30 seconds with ScatterPilot
              </p>
              <Link
                to="/app"
                onClick={() => analytics.event('CTA', 'Click', 'Blog_Post_CTA')}
                className="inline-block px-8 py-4 bg-white text-purple-600 rounded-lg font-bold text-lg hover:bg-slate-100 transition-all duration-300 transform hover:scale-105 shadow-lg"
              >
                Try ScatterPilot Free →
              </Link>
              <p className="text-purple-200 text-sm mt-4">No credit card required</p>
            </div>
          </footer>
        </article>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="bg-slate-900/50 py-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h2 className="text-3xl font-bold text-white mb-8">Related Articles</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {relatedPosts.map(relatedPost => (
                  <BlogCard key={relatedPost.slug} post={relatedPost} />
                ))}
              </div>
            </div>
          </section>
        )}

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
