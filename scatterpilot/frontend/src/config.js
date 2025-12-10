// API Configuration
// To deploy: Update this with your API Gateway URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Cognito Configuration
// These will be populated from CloudFormation outputs after deployment
export const COGNITO_CONFIG = {
  userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
  clientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
  region: import.meta.env.VITE_AWS_REGION || 'us-east-1'
};

// Stripe Configuration
export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  clientId: import.meta.env.VITE_STRIPE_CLIENT_ID || 'ca_TTES0zNbc9MQ9hJIeYvD65yUc08qLqEb',
  redirectUri: import.meta.env.VITE_STRIPE_REDIRECT_URI || 'https://scatterpilot.com/stripe-callback'
};

// Google Analytics 4 Configuration
export const GA4_CONFIG = {
  measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || ''
};

// Pricing Configuration
export const PRICING = {
  free: {
    name: 'Free',
    price: 0,
    invoicesPerMonth: 5,
    features: [
      '5 invoices per month',
      'AI-powered invoice generation',
      'Professional invoice templates',
      'PDF export',
      'Basic support'
    ]
  },
  pro: {
    name: 'Pro',
    price: 18,
    invoicesPerMonth: null, // Unlimited
    features: [
      'Unlimited invoices',
      'AI-powered invoice generation',
      'Custom business name on invoices',
      'Add your contact information',
      'Custom invoice colors',
      'PDF export',
      'Priority support',
      'Team collaboration (coming soon)'
    ]
  }
};

// When you deploy your backend, run:
// aws cloudformation describe-stacks --stack-name scatterpilot-dev --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text
// aws cloudformation describe-stacks --stack-name scatterpilot-dev --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' --output text
// aws cloudformation describe-stacks --stack-name scatterpilot-dev --query 'Stacks[0].Outputs[?OutputKey==`UserPoolClientId`].OutputValue' --output text
// Then update environment variables in .env
