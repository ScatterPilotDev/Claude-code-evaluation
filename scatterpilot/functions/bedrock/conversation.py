"""
Lambda function: Bedrock Conversation Handler
Manages multi-turn conversations for invoice data extraction using Claude
"""

import json
import os
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.bedrock_client import BedrockClient, BedrockException
from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.models import Conversation, ConversationState, Invoice, InvoiceStatus
from common.security import (
    extract_user_id_from_event,
    sanitize_input,
    create_error_response,
    create_success_response,
    InputValidationError,
    RateLimitExceeded,
    RateLimiter
)
from common.logger import get_logger

logger = get_logger("conversation_handler")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for conversational invoice creation

    Event structure:
    {
        "conversation_id": "optional-existing-conversation-id",
        "message": "user message text"
    }

    Returns:
        API Gateway response with assistant message
    """
    # Log invocation
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract and validate user ID from Cognito authorizer
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Check rate limiting
        rate_limiter = RateLimiter(
            max_requests=int(os.environ.get('RATE_LIMIT_MAX_REQUESTS', '100')),
            window_seconds=int(os.environ.get('RATE_LIMIT_WINDOW_SECONDS', '3600'))
        )

        db_helper = DynamoDBHelper()

        # Check rate limit
        rate_limit_record = db_helper.get_rate_limit(user_id)
        if rate_limit_record:
            if not rate_limit_record.is_expired():
                if not rate_limiter.check_limit(
                    rate_limit_record.request_count,
                    rate_limit_record.window_start
                ):
                    reset_time = rate_limiter.get_reset_time(rate_limit_record.window_start)
                    logger.warning(
                        "Rate limit exceeded",
                        user_id=user_id,
                        count=rate_limit_record.request_count
                    )
                    return create_error_response(
                        429,
                        f"Rate limit exceeded. Try again after {reset_time.isoformat()}",
                        "RateLimitExceeded"
                    )
                # Increment within window
                rate_limit_record.increment()
                db_helper.update_rate_limit(rate_limit_record)
            else:
                # Start new window
                from common.models import RateLimit
                rate_limit_record = RateLimit.create_new(
                    user_id,
                    window_seconds=rate_limiter.window_seconds
                )
                db_helper.update_rate_limit(rate_limit_record)
        else:
            # Create first rate limit record
            from common.models import RateLimit
            rate_limit_record = RateLimit.create_new(
                user_id,
                window_seconds=rate_limiter.window_seconds
            )
            db_helper.update_rate_limit(rate_limit_record)

        # Parse request body
        body = event.get('body', {})
        if isinstance(body, str):
            body = json.loads(body)

        # Get or create conversation
        conversation_id = body.get('conversation_id')

        if conversation_id:
            # Retrieve existing conversation
            conversation = db_helper.get_conversation(conversation_id)
            if not conversation:
                logger.warning(
                    "Conversation not found",
                    conversation_id=conversation_id
                )
                return create_error_response(
                    404,
                    "Conversation not found",
                    "NotFound"
                )

            # Verify ownership
            if conversation.user_id != user_id:
                logger.warning(
                    "Unauthorized conversation access",
                    conversation_id=conversation_id,
                    user_id=user_id
                )
                return create_error_response(
                    403,
                    "Not authorized to access this conversation",
                    "Forbidden"
                )

            logger.info("Retrieved existing conversation", conversation_id=conversation_id)

        else:
            # Create new conversation
            conversation = Conversation(
                user_id=user_id,
                state=ConversationState.INITIATED
            )
            db_helper.create_conversation(conversation)
            logger.info("Created new conversation", conversation_id=conversation.conversation_id)

        # Validate and sanitize user message
        user_message = body.get('message', '').strip()
        if not user_message:
            return create_error_response(
                400,
                "Message is required",
                "ValidationError"
            )

        # Sanitize input (XSS protection)
        try:
            user_message = sanitize_input(user_message, max_length=2000)
        except InputValidationError as e:
            logger.warning("Input validation failed", error=str(e))
            return create_error_response(400, str(e), "ValidationError")

        # Process conversation turn with Bedrock
        bedrock_client = BedrockClient(
            region_name=os.environ.get('AWS_REGION', 'us-east-1')
        )

        try:
            assistant_response, extracted_data = bedrock_client.process_conversation_turn(
                conversation=conversation,
                user_message=user_message
            )

            # Update conversation state based on extracted data
            if extracted_data:
                action = extracted_data.get('action')

                if action == 'create_invoice':
                    # CRITICAL: Check subscription and usage limits BEFORE creating invoice
                    subscription = db_helper.check_and_reset_monthly_count(user_id)
                    is_pro = subscription.get('subscription_status') == 'pro'
                    invoices_this_month = subscription.get('invoices_this_month', 0)
                    FREE_TIER_INVOICE_LIMIT = 5

                    if not is_pro and invoices_this_month >= FREE_TIER_INVOICE_LIMIT:
                        logger.info(
                            "Free tier limit reached in conversation",
                            user_id=user_id,
                            invoices_this_month=invoices_this_month
                        )
                        # Return friendly message to user about upgrade
                        conversation.state = ConversationState.COMPLETED
                        response_data = {
                            "conversation_id": conversation.conversation_id,
                            "message": f"🚀 You've used all {FREE_TIER_INVOICE_LIMIT} free invoices this month!\n\nUpgrade to Pro for unlimited invoices at just $18/month.",
                            "invoice_ready": False,
                            "usage_limit_reached": True,
                            "invoices_this_month": int(invoices_this_month),
                            "limit": FREE_TIER_INVOICE_LIMIT,
                            "upgrade_url": "/pricing"
                        }
                        # Save conversation and return
                        db_helper.update_conversation(conversation)
                        return create_success_response(response_data)

                    # Validate invoice data
                    try:
                        invoice_data = bedrock_client.validate_and_parse_invoice_data(extracted_data)
                        conversation.extracted_data = extracted_data
                        conversation.state = ConversationState.COMPLETED

                        logger.info(
                            "Invoice data extracted successfully",
                            conversation_id=conversation.conversation_id
                        )

                        # Create invoice record automatically
                        invoice = Invoice(
                            user_id=user_id,
                            conversation_id=conversation.conversation_id,
                            data=invoice_data,
                            status=InvoiceStatus.DRAFT
                        )

                        db_helper.create_invoice(invoice)

                        # CRITICAL: Increment monthly invoice count
                        new_count = db_helper.increment_monthly_invoice_count(user_id)

                        logger.info(
                            "Invoice created automatically",
                            invoice_id=invoice.invoice_id,
                            customer=invoice_data.customer_name,
                            total=str(invoice_data.total),
                            monthly_count=new_count
                        )

                        # Generate summary
                        summary = bedrock_client.generate_invoice_summary(invoice_data)

                        # Return success with invoice data and ID
                        response_data = {
                            "conversation_id": conversation.conversation_id,
                            "message": assistant_response,
                            "invoice_ready": True,
                            "invoice_id": invoice.invoice_id,
                            "invoice_data": invoice_data.to_dynamodb(),
                            "invoices_remaining": FREE_TIER_INVOICE_LIMIT - new_count if not is_pro else None
                        }

                    except ValueError as e:
                        logger.warning("Invalid invoice data", error=str(e))
                        # Continue conversation to fix issues
                        conversation.state = ConversationState.GATHERING_INFO
                        response_data = {
                            "conversation_id": conversation.conversation_id,
                            "message": f"I found some issues with the data: {str(e)}. Let's fix that.",
                            "invoice_ready": False
                        }

                elif action == 'cancel':
                    conversation.state = ConversationState.ABANDONED
                    response_data = {
                        "conversation_id": conversation.conversation_id,
                        "message": assistant_response,
                        "cancelled": True
                    }
                    logger.info("Conversation cancelled", conversation_id=conversation.conversation_id)

                else:
                    # Unknown action, continue gathering
                    conversation.state = ConversationState.GATHERING_INFO
                    response_data = {
                        "conversation_id": conversation.conversation_id,
                        "message": assistant_response,
                        "invoice_ready": False
                    }

            else:
                # No structured data yet, continue gathering
                conversation.state = ConversationState.GATHERING_INFO
                response_data = {
                    "conversation_id": conversation.conversation_id,
                    "message": assistant_response,
                    "invoice_ready": False
                }

            # Save conversation state
            db_helper.update_conversation(conversation)

            logger.info(
                "Conversation turn completed",
                conversation_id=conversation.conversation_id,
                state=conversation.state.value,
                message_count=len(conversation.messages)
            )

            return create_success_response(response_data)

        except BedrockException as e:
            logger.error("Bedrock API error", error=e)
            return create_error_response(
                500,
                "Failed to process your message. Please try again.",
                "BedrockError"
            )

    except InputValidationError as e:
        logger.warning("Input validation error", error=e)
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(
            500,
            "Database error occurred",
            "DatabaseError"
        )

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(
            500,
            "An unexpected error occurred",
            "InternalError"
        )
