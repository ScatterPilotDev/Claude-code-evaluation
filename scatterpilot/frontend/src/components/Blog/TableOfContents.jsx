import { useState, useEffect } from 'react';

export default function TableOfContents({ headings }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (!headings || headings.length === 0) {
    return null;
  }

  return (
    <nav className="sticky top-24 bg-surface-card border border-surface-border rounded-card p-5 max-h-[calc(100vh-8rem)] overflow-y-auto shadow-card">
      <h3 className="text-body-sm font-semibold text-ink-primary mb-3 uppercase tracking-wider">
        Table of Contents
      </h3>
      <ul className="space-y-1.5">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className={heading.level === 3 ? 'ml-3' : ''}
          >
            <a
              href={`#${heading.id}`}
              className={`block text-body-sm transition-colors duration-150 ${
                activeId === heading.id
                  ? 'text-sage-500 font-medium'
                  : 'text-ink-tertiary hover:text-ink-secondary'
              }`}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
