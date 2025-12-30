.PHONY: help install install-dev test test-local test-coverage lint format typecheck build deploy deploy-guided clean local-api invoke-local logs validate

# Variables
PYTHON := python3
PIP := pip3
PYTEST := pytest
SAM := sam
AWS := aws
STACK_NAME := scatterpilot-dev
REGION := us-east-1

# Colors for output
CYAN := \033[0;36m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

##@ General

help: ## Display this help message
	@echo "$(CYAN)ScatterPilot - Makefile Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(CYAN)<target>$(NC)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-20s$(NC) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(NC)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development Setup

install: ## Install production dependencies
	@echo "$(GREEN)Installing production dependencies...$(NC)"
	$(PIP) install -r requirements.txt

install-dev: install ## Install development dependencies
	@echo "$(GREEN)Installing development dependencies...$(NC)"
	$(PIP) install pytest pytest-cov pytest-mock black mypy boto3-stubs moto

setup: install-dev ## Complete development setup
	@echo "$(GREEN)Verifying AWS credentials...$(NC)"
	@$(AWS) sts get-caller-identity
	@echo "$(GREEN)Checking SAM CLI...$(NC)"
	@$(SAM) --version
	@echo "$(GREEN)Setup complete!$(NC)"

##@ Testing

test: ## Run unit tests
	@echo "$(GREEN)Running unit tests...$(NC)"
	$(PYTEST) tests/ -v

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	$(PYTEST) tests/ --cov=layers/common --cov-report=html --cov-report=term

test-local: ## Run local Bedrock conversation test
	@echo "$(GREEN)Starting local conversation test...$(NC)"
	@echo "$(YELLOW)Note: Requires AWS credentials and Bedrock access$(NC)"
	$(PYTHON) scripts/local-test.py

test-validate: ## Test invoice validation only (no Bedrock)
	@echo "$(GREEN)Testing invoice validation...$(NC)"
	$(PYTHON) scripts/local-test.py validate

##@ Code Quality

format: ## Format code with black
	@echo "$(GREEN)Formatting code...$(NC)"
	black layers/common/ functions/ tests/ scripts/

lint: ## Run linter (flake8 if installed)
	@echo "$(GREEN)Linting code...$(NC)"
	@if command -v flake8 >/dev/null 2>&1; then \
		flake8 layers/common/ functions/ --max-line-length=100 --ignore=E203,W503; \
	else \
		echo "$(YELLOW)flake8 not installed, skipping lint$(NC)"; \
	fi

typecheck: ## Run type checker (mypy)
	@echo "$(GREEN)Running type checker...$(NC)"
	@if command -v mypy >/dev/null 2>&1; then \
		mypy layers/common/ --ignore-missing-imports; \
	else \
		echo "$(YELLOW)mypy not installed, skipping typecheck$(NC)"; \
	fi

check: format lint typecheck test ## Run all code quality checks

##@ AWS SAM Build & Deploy

validate: ## Validate SAM template
	@echo "$(GREEN)Validating SAM template...$(NC)"
	$(SAM) validate --template infrastructure/template.yaml

build: validate ## Build SAM application
	@echo "$(GREEN)Building SAM application...$(NC)"
	$(SAM) build --template infrastructure/template.yaml

deploy: build ## Deploy to AWS (uses samconfig.toml)
	@echo "$(GREEN)Deploying to AWS...$(NC)"
	$(SAM) deploy

deploy-guided: build ## Deploy with guided setup
	@echo "$(GREEN)Starting guided deployment...$(NC)"
	$(SAM) deploy --guided

deploy-prod: build ## Deploy to production environment
	@echo "$(RED)Deploying to PRODUCTION...$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(SAM) deploy --parameter-overrides Environment=prod --no-confirm-changeset; \
	fi

##@ Local Development

local-api: ## Start local API Gateway
	@echo "$(GREEN)Starting local API Gateway...$(NC)"
	@echo "$(YELLOW)API will be available at http://127.0.0.1:3000$(NC)"
	$(SAM) local start-api --template infrastructure/template.yaml

local-invoke: ## Invoke function locally (specify FUNCTION=name)
	@if [ -z "$(FUNCTION)" ]; then \
		echo "$(RED)Error: Please specify FUNCTION=<function-name>$(NC)"; \
		echo "Example: make local-invoke FUNCTION=ConversationFunction"; \
		exit 1; \
	fi
	@echo "$(GREEN)Invoking $(FUNCTION) locally...$(NC)"
	$(SAM) local invoke $(FUNCTION) --template infrastructure/template.yaml

##@ AWS Operations

logs: ## Tail Lambda function logs (specify FUNCTION=name)
	@if [ -z "$(FUNCTION)" ]; then \
		FUNCTION="ScatterPilot-Conversation-$(ENV)"; \
	fi
	@echo "$(GREEN)Tailing logs for $(FUNCTION)...$(NC)"
	$(AWS) logs tail /aws/lambda/$(FUNCTION) --follow --region $(REGION)

describe-stack: ## Describe CloudFormation stack
	@echo "$(GREEN)Stack information:$(NC)"
	$(AWS) cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(REGION) \
		--query 'Stacks[0].Outputs' \
		--output table

get-api-url: ## Get API Gateway URL
	@$(AWS) cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(REGION) \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
		--output text

##@ Database Operations

dynamodb-list-tables: ## List DynamoDB tables
	@echo "$(GREEN)ScatterPilot DynamoDB tables:$(NC)"
	@$(AWS) dynamodb list-tables --region $(REGION) | grep ScatterPilot || echo "No tables found"

dynamodb-scan-conversations: ## Scan conversations table
	@TABLE_NAME=$$($(AWS) cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(REGION) \
		--query 'Stacks[0].Outputs[?OutputKey==`ConversationsTableName`].OutputValue' \
		--output text); \
	echo "$(GREEN)Scanning $$TABLE_NAME...$(NC)"; \
	$(AWS) dynamodb scan --table-name $$TABLE_NAME --region $(REGION) --max-items 10

s3-list-invoices: ## List invoice PDFs in S3
	@BUCKET_NAME=$$($(AWS) cloudformation describe-stacks \
		--stack-name $(STACK_NAME) \
		--region $(REGION) \
		--query 'Stacks[0].Outputs[?OutputKey==`InvoiceBucketName`].OutputValue' \
		--output text); \
	echo "$(GREEN)Listing invoices in $$BUCKET_NAME...$(NC)"; \
	$(AWS) s3 ls s3://$$BUCKET_NAME/invoices/ --recursive --region $(REGION)

##@ Cleanup

clean: ## Clean build artifacts
	@echo "$(GREEN)Cleaning build artifacts...$(NC)"
	rm -rf .aws-sam/
	rm -rf htmlcov/
	rm -rf .pytest_cache/
	rm -rf .coverage
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "$(GREEN)Clean complete!$(NC)"

delete-stack: ## Delete CloudFormation stack (DANGEROUS)
	@echo "$(RED)WARNING: This will delete all resources!$(NC)"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		$(SAM) delete --stack-name $(STACK_NAME) --region $(REGION) --no-prompts; \
	fi

##@ Utilities

check-bedrock: ## Check Bedrock model access
	@echo "$(GREEN)Checking Bedrock access...$(NC)"
	@$(AWS) bedrock list-foundation-models \
		--region $(REGION) \
		--query 'modelSummaries[?contains(modelId, `claude-sonnet-4-5`)].{ID:modelId,Name:modelName}' \
		--output table

cost-estimate: ## Estimate monthly costs
	@echo "$(CYAN)Cost Estimation for ScatterPilot$(NC)"
	@echo ""
	@echo "$(YELLOW)Bedrock (Claude Sonnet 4.5):$(NC)"
	@echo "  - Input: ~\$$0.003 per 1K tokens"
	@echo "  - Output: ~\$$0.015 per 1K tokens"
	@echo "  - Avg conversation: ~\$$0.05"
	@echo ""
	@echo "$(YELLOW)AWS Lambda:$(NC)"
	@echo "  - Free tier: 1M requests/month"
	@echo "  - Beyond: \$$0.20 per 1M requests"
	@echo ""
	@echo "$(YELLOW)DynamoDB:$(NC)"
	@echo "  - On-demand: \$$1.25 per million writes"
	@echo ""
	@echo "$(YELLOW)S3:$(NC)"
	@echo "  - Storage: \$$0.023/GB/month"
	@echo ""
	@echo "$(GREEN)Estimated: ~\$$50-75 for 1,000 invoices/month$(NC)"

version: ## Show tool versions
	@echo "$(CYAN)Tool Versions:$(NC)"
	@echo "Python: $$($(PYTHON) --version)"
	@echo "AWS CLI: $$($(AWS) --version)"
	@echo "SAM CLI: $$($(SAM) --version)"
	@echo "pip: $$($(PIP) --version)"

##@ Examples

example-conversation: ## Show example conversation API call
	@echo "$(CYAN)Example: Start a conversation$(NC)"
	@echo ""
	@API_URL=$$(make get-api-url 2>/dev/null); \
	echo "curl -X POST $$API_URL/conversation \\"; \
	echo "  -H 'Content-Type: application/json' \\"; \
	echo "  -d '{\"message\": \"I need to create an invoice for Acme Corp\"}'"

example-create-invoice: ## Show example create invoice call
	@echo "$(CYAN)Example: Create an invoice$(NC)"
	@echo ""
	@API_URL=$$(make get-api-url 2>/dev/null); \
	echo "curl -X POST $$API_URL/invoices \\"; \
	echo "  -H 'Content-Type: application/json' \\"; \
	echo "  -d @examples/invoice.json"
