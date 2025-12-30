# ScatterPilot

**Enterprise-Grade Serverless Invoice Generation System**

A production-ready serverless application that uses conversational AI (Amazon Bedrock with Claude Sonnet 4.5) to extract structured invoice data from natural language conversations, then generates professional PDF invoices.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Client Application                              │
│                     (Web/Mobile/API Consumer)                            │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API Gateway                                      │
│                    (Cognito Authorization)                               │
└─────┬──────────────┬────────────┬───────────────┬────────────────┬──────┘
      │              │            │               │                │
      │              │            │               │                │
      ▼              ▼            ▼               ▼                ▼
┌──────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────┐
│Bedrock   │  │ Create   │  │  List   │  │   Get    │  │  Generate    │
│Conversa- │  │ Invoice  │  │Invoices │  │ Invoice  │  │    PDF       │
│tion      │  │          │  │         │  │          │  │              │
│          │  │          │  │         │  │          │  │              │
│Lambda    │  │ Lambda   │  │ Lambda  │  │ Lambda   │  │   Lambda     │
└────┬─────┘  └─────┬────┘  └────┬────┘  └─────┬────┘  └──────┬───────┘
     │              │             │             │              │
     │              │             │             │              │
     │  ┌───────────┴─────────────┴─────────────┘              │
     │  │                                                       │
     ▼  ▼                                                       ▼
┌─────────────────────────────────────────┐            ┌──────────────┐
│          DynamoDB Tables                │            │   S3 Bucket  │
│  ┌────────────────────────────────┐     │            │              │
│  │  Conversations                 │     │            │   Invoice    │
│  │  - conversation_id (PK)        │     │            │   PDFs       │
│  │  - user_id (GSI)               │     │            │              │
│  │  - messages[]                  │     │            │   (AES-256   │
│  │  - state                       │     │            │   Encrypted) │
│  │  - extracted_data              │     │            │              │
│  └────────────────────────────────┘     │            └──────────────┘
│                                          │
│  ┌────────────────────────────────┐     │
│  │  Invoices                      │     │
│  │  - invoice_id (PK)             │     │
│  │  - user_id (GSI)               │     │
│  │  - data (InvoiceData)          │     │
│  │  - status                      │     │
│  │  - pdf_s3_key                  │     │
│  └────────────────────────────────┘     │
│                                          │
│  ┌────────────────────────────────┐     │
│  │  RateLimits (TTL Enabled)      │     │
│  │  - user_id (PK)                │     │
│  │  - request_count               │     │
│  │  - window_start                │     │
│  │  - ttl                         │     │
│  └────────────────────────────────┘     │
└─────────────────────────────────────────┘
              ▲
              │
              │
       ┌──────┴───────┐
       │              │
       │   Amazon     │
       │   Bedrock    │
       │              │
       │   Claude     │
       │   Sonnet     │
       │   4.5        │
       │              │
       └──────────────┘
```

## Features

### Core Capabilities
- **Conversational AI**: Natural language invoice data extraction using Claude Sonnet 4.5
- **Multi-turn Conversations**: Stateful conversation management with context retention
- **Structured Data Extraction**: Automatic JSON parsing from conversational responses
- **PDF Generation**: Professional invoice PDFs with company branding
- **RESTful API**: Complete CRUD operations for invoices

### Enterprise Security
- **Input Sanitization**: XSS and SQL injection prevention
- **Rate Limiting**: Token bucket algorithm with DynamoDB tracking
- **PII Redaction**: Automatic PII removal from logs
- **Encryption**: Server-side encryption for S3 and DynamoDB
- **IAM Least Privilege**: Minimal permission policies
- **Request Tracing**: X-Ray integration for distributed tracing

### Production Features
- **Structured Logging**: AWS Lambda Powertools with correlation IDs
- **Error Handling**: Comprehensive exception handling with retry logic
- **Type Safety**: Full type hints and Pydantic validation
- **Cost Tracking**: Bedrock token usage logging
- **Pagination**: Efficient pagination for list operations
- **Idempotency**: Safe retry mechanisms

## Project Structure

```
scatterpilot/
├── functions/                      # Lambda handlers
│   ├── bedrock/
│   │   └── conversation.py        # Conversation handler
│   ├── invoices/
│   │   ├── create.py              # Create invoice
│   │   ├── list.py                # List invoices
│   │   └── get.py                 # Get invoice
│   └── pdf/
│       └── generate.py            # Generate PDF
├── layers/                         # Shared Lambda layer
│   └── common/
│       ├── bedrock_client.py      # Bedrock API wrapper
│       ├── dynamodb_helper.py     # DynamoDB operations
│       ├── models.py              # Pydantic models
│       ├── security.py            # Security utilities
│       └── logger.py              # Structured logging
├── infrastructure/
│   ├── template.yaml              # AWS SAM template
│   └── policies/
│       └── lambda-execution-policy.json
├── tests/
│   ├── test_bedrock_client.py
│   └── test_conversation_flow.py
├── scripts/
│   └── local-test.py              # Local Bedrock testing
├── requirements.txt
├── Makefile
└── README.md
```

## Prerequisites

- **AWS Account** with the following services enabled:
  - AWS Lambda
  - Amazon Bedrock (with Claude Sonnet 4.5 access)
  - Amazon DynamoDB
  - Amazon S3
  - API Gateway
  - AWS SAM CLI

- **Local Development**:
  - Python 3.11+
  - AWS CLI configured
  - AWS SAM CLI
  - Docker (for local testing)

## 🔐 Security First

**⚠️ CRITICAL: Never commit AWS credentials to Git!**

Before deploying:
- 📖 **Read [SECURITY.md](SECURITY.md)** for credential best practices
- 🔒 Use **GitHub Codespaces Secrets** for public repositories
- 👤 Create a **dedicated IAM user** with minimal permissions
- 🔄 Plan to **rotate credentials** every 90 days

**Using Codespaces?** See [CODESPACES_SETUP.md](CODESPACES_SETUP.md) for secure setup.

---

## Quick Start Deployment

### 🚀 Automated Deployment (Recommended)

Deploy ScatterPilot to AWS in one command:

```bash
cd scatterpilot
./scripts/00-deploy-all.sh
```

This interactive script will:
1. ✅ Check all prerequisites (AWS CLI, SAM CLI, Docker, etc.)
2. ✅ Guide you through Bedrock model access setup
3. ✅ Deploy infrastructure to AWS
4. ✅ Test the deployment
5. ✅ Configure the frontend
6. ✅ Set up cost monitoring and billing alarms

**Time:** ~10-15 minutes | **Estimated Cost:** $5-15/month

📖 **For detailed step-by-step instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

---

### 📋 Manual Deployment Steps

If you prefer manual control, run scripts individually:

#### 1. Check Prerequisites

```bash
./scripts/01-check-prerequisites.sh
```

Verifies AWS CLI, SAM CLI, Python, Docker, and Bedrock access.

#### 2. Enable Bedrock Model Access

```bash
# View setup guide
cat scripts/02-enable-bedrock-access.md

# Then enable in AWS Console:
# 1. Navigate to Amazon Bedrock console
# 2. Click "Model access" → "Enable specific models"
# 3. Enable: Claude Sonnet 4.5
#    Model ID: anthropic.claude-sonnet-4-5-20250929-v1:0
# 4. Wait for approval (typically instant)
```

#### 3. Deploy to AWS

```bash
./scripts/03-deploy.sh
```

Interactive deployment with guided prompts for:
- Stack name
- AWS region selection
- Environment (dev/staging/prod)
- S3 bucket configuration
- Optional Cognito authentication

#### 4. Test Deployment

```bash
./scripts/04-test-deployment.sh
```

Automated tests for:
- API Gateway health
- Bedrock conversation endpoint
- DynamoDB tables
- S3 bucket
- Lambda functions

#### 5. Configure Frontend

```bash
./scripts/05-configure-frontend.sh
```

Updates demo frontend with:
- API endpoint URL
- Configuration file
- API client helper

#### 6. Set Up Cost Monitoring

```bash
./scripts/06-setup-monitoring.sh
```

Creates:
- Billing alarms (warning & critical)
- SNS email notifications
- CloudWatch dashboard
- Lambda error alarms

---

### 🧪 Local Testing (Without Deployment)

Test Bedrock integration locally before deploying:

```bash
# Test Bedrock conversation locally
make test-local

# Or run directly:
python scripts/local-test.py

# Run unit tests
make test
```

---

### 🖥️ Demo Frontend

Test the UI locally:

```bash
cd demo
python3 -m http.server 8000
# Open http://localhost:8000 in browser

# Features:
# - Toggle between Demo Mode and Live API
# - Real-time conversation with AI
# - Invoice preview
# - PDF generation (now with real PDFs!)
```

## API Reference

### POST /conversation
Start or continue a conversation for invoice creation.

**Request:**
```json
{
  "conversation_id": "optional-existing-id",
  "message": "I need to create an invoice"
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "message": "Sure! Let me help you...",
  "invoice_ready": false
}
```

### POST /invoices
Create an invoice from conversation or direct data.

**Request (from conversation):**
```json
{
  "conversation_id": "uuid"
}
```

**Request (direct):**
```json
{
  "invoice_data": {
    "customer_name": "Acme Corp",
    "due_date": "2024-02-15",
    "line_items": [...]
  }
}
```

### GET /invoices
List user's invoices with pagination.

**Query Parameters:**
- `limit`: Number of items (default: 20, max: 100)
- `last_key`: Pagination token
- `status`: Filter by status (draft, pending, paid, cancelled)

### GET /invoices/{invoice_id}
Get single invoice details.

### POST /invoices/{invoice_id}/pdf
Generate PDF for an invoice.

**Response:**
```json
{
  "invoice_id": "uuid",
  "download_url": "presigned-s3-url",
  "pdf_generated": true
}
```

## Development

### Running Tests

```bash
# Run all tests
make test

# Run specific test file
pytest tests/test_bedrock_client.py -v

# Run with coverage
pytest --cov=layers/common tests/
```

### Code Quality

```bash
# Format code
make format

# Type checking
make typecheck

# Lint
make lint
```

### Local SAM Testing

```bash
# Start local API
sam local start-api

# Invoke function locally
sam local invoke ConversationFunction --event events/conversation.json
```

## Configuration

### Environment Variables

Set in SAM template or locally:

- `CONVERSATIONS_TABLE`: DynamoDB conversations table name
- `INVOICES_TABLE`: DynamoDB invoices table name
- `RATE_LIMITS_TABLE`: DynamoDB rate limits table name
- `INVOICE_BUCKET`: S3 bucket for PDFs
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
- `RATE_LIMIT_WINDOW_SECONDS`: Rate limit window (default: 3600)
- `LOG_LEVEL`: Logging level (INFO, DEBUG, WARNING, ERROR)

## Cost Estimation

### Bedrock Costs
- Claude Sonnet 4.5: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens
- Average conversation: 5 turns × 500 tokens = ~$0.05 per invoice

### AWS Lambda
- Free tier: 1M requests/month, 400K GB-seconds
- Beyond free tier: $0.20 per 1M requests

### DynamoDB
- On-demand pricing: $1.25 per million writes
- Typical usage: <$5/month for development

### S3
- Storage: $0.023/GB/month
- Requests: Minimal cost for PDF storage

**Estimated cost for 1,000 invoices/month: ~$50-75**

## Security Best Practices

### Implemented
- ✅ Input validation and sanitization
- ✅ Rate limiting per user
- ✅ PII redaction in logs
- ✅ Encrypted data at rest (S3, DynamoDB)
- ✅ Encrypted data in transit (HTTPS)
- ✅ IAM least privilege policies
- ✅ Request tracing with X-Ray
- ✅ Security headers in API responses

### Recommended for Production
- [ ] Enable Cognito user pool authentication
- [ ] Implement API key rotation
- [ ] Set up WAF rules for API Gateway
- [ ] Enable GuardDuty for threat detection
- [ ] Configure CloudTrail for audit logging
- [ ] Implement backup and disaster recovery
- [ ] Set up monitoring and alerting

## Monitoring and Observability

### CloudWatch Dashboards
```bash
# View logs
aws logs tail /aws/lambda/ScatterPilot-Conversation-dev --follow

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace ScatterPilot \
  --metric-name ConversationDuration \
  --statistics Average \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 3600
```

### Key Metrics
- Conversation completion rate
- Average tokens per conversation
- Invoice generation success rate
- API latency (p50, p99)
- Error rates by function

## Troubleshooting

### Bedrock Access Denied
```
Error: AccessDeniedException
```
**Solution:** Enable model access in Bedrock console for your region

### Lambda Timeout
```
Error: Task timed out after 30.00 seconds
```
**Solution:** Increase timeout in template.yaml or optimize conversation turns

### Rate Limit Errors
```
Error: Rate limit exceeded
```
**Solution:** Implement exponential backoff or request limit increase

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with [AWS SAM](https://aws.amazon.com/serverless/sam/)
- Powered by [Amazon Bedrock](https://aws.amazon.com/bedrock/)
- Uses [Claude Sonnet 4.5](https://www.anthropic.com/claude) by Anthropic
- Logging with [AWS Lambda Powertools](https://awslabs.github.io/aws-lambda-powertools-python/)

## Contact

For questions or support, please open an issue on GitHub.

---

**Built for scalability, security, and production workloads** 🚀
