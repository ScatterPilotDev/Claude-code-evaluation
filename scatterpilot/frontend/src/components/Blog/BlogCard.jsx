import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/blogUtils';
import analytics from '../../utils/analytics';

export default function BlogCard({ post, featured = false }) {
  const handleClick = () => {
    analytics.event('Blog', 'Click', `Blog_Card_${post.slug}`);
  };

  return (
    <article
      className={`group bg-slate-900 border border-slate-700 rounded-xl overflow-hidden hover:border-purple-500 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 ${
        featured ? 'md:col-span-2 md:grid md:grid-cols-2 md:gap-8' : ''
      }`}
    >
      {post.image && (
        <Link
          to={`/blog/${post.slug}`}
          onClick={handleClick}
          className="block overflow-hidden"
        >
          <img
            src={post.image}
            alt={post.imageAlt || post.title}
            className={`w-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              featured ? 'h-full' : 'h-48'
            }`}
            loading="lazy"
          />
        </Link>
      )}

      <div className="p-6">
        <div className="flex items-center gap-3 text-sm text-slate-400 mb-3">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>•</span>
          <span>{post.readingTime}</span>
        </div>

        <h2
          className={`font-bold text-slate-100 mb-3 group-hover:text-transparent group-hover:bg-gradient-brand group-hover:bg-clip-text transition-all ${
            featured ? 'text-3xl' : 'text-xl'
          }`}
        >
          <Link to={`/blog/${post.slug}`} onClick={handleClick}>
            {post.title}
          </Link>
        </h2>

        <p className="text-slate-400 mb-4 leading-relaxed">
          {post.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {post.tags?.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-3 py-1 text-xs bg-slate-800 text-purple-400 rounded-full border border-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>

          <Link
            to={`/blog/${post.slug}`}
            onClick={handleClick}
            className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 transition-colors"
          >
            Read more
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
