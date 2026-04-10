import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/blogUtils';
import analytics from '../../utils/analytics';

export default function BlogCard({ post, featured = false }) {
  const handleClick = () => {
    analytics.event('Blog', 'Click', `Blog_Card_${post.slug}`);
  };

  return (
    <article
      className={`group bg-surface-card border border-surface-border rounded-card overflow-hidden hover:border-sage-300 hover:shadow-card-hover transition-all duration-200 ${
        featured ? 'md:col-span-2 md:grid md:grid-cols-2 md:gap-0' : ''
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
              featured ? 'h-full min-h-[240px]' : 'h-48'
            }`}
            loading="lazy"
          />
        </Link>
      )}

      <div className="p-6">
        <div className="flex items-center gap-3 text-body-sm text-ink-tertiary mb-3">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span>·</span>
          <span>{post.readingTime}</span>
        </div>

        <h2
          className={`font-semibold text-ink-primary mb-3 group-hover:text-sage-600 transition-colors duration-150 ${
            featured ? 'text-heading-lg' : 'text-heading'
          }`}
        >
          <Link to={`/blog/${post.slug}`} onClick={handleClick}>
            {post.title}
          </Link>
        </h2>

        <p className="text-body text-ink-secondary mb-4 leading-relaxed">
          {post.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {post.tags?.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="px-2.5 py-0.5 text-label bg-sage-50 text-sage-600 rounded-badge border border-sage-200"
              >
                {tag}
              </span>
            ))}
          </div>

          <Link
            to={`/blog/${post.slug}`}
            onClick={handleClick}
            className="text-body-sm text-sage-500 hover:text-sage-600 font-medium flex items-center gap-1 transition-colors duration-150 flex-shrink-0"
          >
            Read more
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
