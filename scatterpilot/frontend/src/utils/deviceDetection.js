/**
 * Device detection utilities for responsive behavior
 */

/**
 * Detects if the current device is a mobile device
 * Uses a combination of userAgent and touch capability detection
 *
 * @returns {boolean} True if device is mobile, false otherwise
 */
export const isMobileDevice = () => {
  // Check if running in browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Check user agent for mobile devices
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;

  // Check if userAgent indicates mobile
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());

  // Check for touch capability (helps with tablets and hybrid devices)
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Check viewport width (common mobile breakpoint)
  const isNarrowViewport = window.innerWidth <= 768;

  // Consider it mobile if:
  // 1. UserAgent indicates mobile, OR
  // 2. Has touch + narrow viewport (covers tablets in portrait mode)
  return isMobileUA || (hasTouch && isNarrowViewport);
};

/**
 * Detects if device is specifically a tablet
 *
 * @returns {boolean} True if device is a tablet
 */
export const isTablet = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Check for iPad or Android tablets
  return (
    /ipad|android(?!.*mobile)/i.test(userAgent.toLowerCase()) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1024)
  );
};

/**
 * Hook to use mobile detection in React components
 * Re-evaluates on window resize for responsive behavior
 *
 * @returns {boolean} True if device is mobile
 */
export const useIsMobile = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  const [mobile, setMobile] = React.useState(isMobileDevice());

  React.useEffect(() => {
    const handleResize = () => {
      setMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return mobile;
};
