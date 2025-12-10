# ScatterPilot Frontend

Minimal React frontend for AI-powered invoice generation.

## Tech Stack

- React 18
- Vite (build tool)
- Tailwind CSS
- AWS S3 + CloudFront (deployment)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Endpoint

Copy `.env.example` to `.env` and update with your API Gateway URL:

```bash
cp .env.example .env
```

Get your API URL:
```bash
aws cloudformation describe-stacks \
  --stack-name scatterpilot-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

Update `.env`:
```
VITE_API_URL=https://your-api-gateway-url.amazonaws.com/prod
```

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173`

## Deployment to AWS S3

### Option 1: Simple S3 Static Hosting (Fastest)

```bash
chmod +x deploy-s3.sh
./deploy-s3.sh scatterpilot-frontend us-east-1
```

This will:
- Build the React app
- Create S3 bucket
- Enable static website hosting
- Upload files
- Make bucket publicly accessible

Access your site at:
```
http://scatterpilot-frontend.s3-website-us-east-1.amazonaws.com
```

### Option 2: S3 + CloudFront (Production - HTTPS)

```bash
chmod +x deploy-cloudfront.sh
./deploy-cloudfront.sh scatterpilot-frontend us-east-1
```

Then manually create CloudFront distribution:

1. Go to CloudFront Console
2. Create Distribution
3. Origin: `scatterpilot-frontend.s3.amazonaws.com`
4. Enable Origin Access Identity (OAI)
5. Default Root Object: `index.html`
6. Custom Error Response: 404 → `/index.html` (for React Router)
7. Deploy and wait 10-15 minutes

### Option 3: Manual Deployment

```bash
# Build
npm run build

# Create bucket
aws s3 mb s3://scatterpilot-frontend

# Upload
aws s3 sync dist/ s3://scatterpilot-frontend --delete

# Enable website hosting
aws s3 website s3://scatterpilot-frontend \
  --index-document index.html \
  --error-document index.html

# Make public
aws s3api put-bucket-policy \
  --bucket scatterpilot-frontend \
  --policy file://bucket-policy.json
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ChatInterface.jsx    # AI chat for invoice generation
│   │   └── InvoicePreview.jsx   # Live invoice preview
│   ├── services/
│   │   └── api.js                # API Gateway integration
│   ├── App.jsx                   # Main app component
│   ├── main.jsx                  # Entry point
│   ├── config.js                 # API configuration
│   └── index.css                 # Tailwind imports
├── deploy-s3.sh                  # Simple S3 deployment
├── deploy-cloudfront.sh          # CloudFront deployment
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## Features

- Chat interface for conversational invoice creation
- Real-time invoice preview
- Minimal, clean UI
- Mobile responsive
- Fast build times with Vite
- API-ready (connects to your API Gateway)

## API Integration

The app expects these API endpoints:

```
POST /conversation          # Chat with AI
POST /invoices             # Create invoice
GET  /invoices             # List invoices
GET  /invoices/:id         # Get invoice details
POST /invoices/:id/pdf     # Generate PDF
```

Update `src/services/api.js` if your endpoints differ.

## Authentication

Currently no authentication (MVP). To add Cognito auth:

1. Update `src/services/api.js` to include JWT token
2. Add Cognito User Pool client configuration
3. Implement sign-in/sign-up components

## Build for Production

```bash
npm run build
```

Output in `dist/` folder, ready for S3 upload.

## Troubleshooting

### CORS Errors
Ensure your API Gateway has CORS enabled:
```yaml
Cors:
  AllowOrigins: ['*']
  AllowHeaders: ['Content-Type', 'Authorization']
  AllowMethods: ['GET', 'POST', 'OPTIONS']
```

### S3 Access Denied
Check bucket policy allows public read:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::scatterpilot-frontend/*"
  }]
}
```

### CloudFront 403 Errors
Add custom error response: 404 → `/index.html` with 200 status

## Cost Estimate

- S3 Storage: ~$0.023/GB/month
- S3 Requests: ~$0.0004 per 1000 requests
- CloudFront: ~$0.085/GB data transfer
- **Total for small app: < $5/month**

## Next Steps

1. Deploy backend stack: `cd ../infrastructure && sam deploy`
2. Get API URL and update `.env`
3. Build frontend: `npm run build`
4. Deploy to S3: `./deploy-s3.sh`
5. Test the app
6. Set up CloudFront for production
7. Add custom domain (Route53)
8. Implement Cognito authentication

## License

MIT
