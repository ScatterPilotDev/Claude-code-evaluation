"""
Lambda function: Submit Feedback
Handles user feedback and bug reports with email notifications
"""

import json
import os
import sys
import uuid
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    create_error_response,
    create_success_response,
)
from common.logger import get_logger

logger = get_logger("submit_feedback")

# Environment variables
FEEDBACK_TABLE = os.environ['FEEDBACK_TABLE']
RATE_LIMITS_TABLE = os.environ['RATE_LIMITS_TABLE']
SUBSCRIPTIONS_TABLE = os.environ['SUBSCRIPTIONS_TABLE']
NOTIFICATION_EMAIL = os.environ.get('NOTIFICATION_EMAIL', 'ale@mayrod.tech')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@scatterpilot.com')

# Rate limiting - max 3 feedback submissions per hour per user/email
FEEDBACK_RATE_LIMIT = 3
FEEDBACK_WINDOW_SECONDS = 3600

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
ses_client = boto3.client('ses', region_name='us-east-1')  # SES typically in us-east-1


def check_rate_limit(email: str, db_helper: DynamoDBHelper) -> tuple[bool, int]:
    """
    Check if user has exceeded feedback rate limit

    Returns:
        (is_allowed, remaining_submissions)
    """
    try:
        rate_limit_key = f"feedback_{email}"
        table = dynamodb.Table(RATE_LIMITS_TABLE)

        # Get current rate limit record
        response = table.get_item(Key={'user_id': rate_limit_key})

        current_time = int(datetime.utcnow().timestamp())

        if 'Item' not in response:
            # No record exists - create new one
            table.put_item(Item={
                'user_id': rate_limit_key,
                'request_count': 1,
                'window_start': current_time,
                'ttl': current_time + FEEDBACK_WINDOW_SECONDS + 86400  # TTL 24h after window
            })
            return True, FEEDBACK_RATE_LIMIT - 1

        item = response['Item']
        window_start = item.get('window_start', current_time)
        request_count = item.get('request_count', 0)

        # Check if window has expired
        if current_time - window_start >= FEEDBACK_WINDOW_SECONDS:
            # Reset window
            table.put_item(Item={
                'user_id': rate_limit_key,
                'request_count': 1,
                'window_start': current_time,
                'ttl': current_time + FEEDBACK_WINDOW_SECONDS + 86400
            })
            return True, FEEDBACK_RATE_LIMIT - 1

        # Within window - check limit
        if request_count >= FEEDBACK_RATE_LIMIT:
            remaining = 0
            return False, remaining

        # Increment count
        table.put_item(Item={
            'user_id': rate_limit_key,
            'request_count': request_count + 1,
            'window_start': window_start,
            'ttl': current_time + FEEDBACK_WINDOW_SECONDS + 86400
        })

        return True, FEEDBACK_RATE_LIMIT - (request_count + 1)

    except Exception as e:
        logger.error(f"Rate limit check failed: {str(e)}")
        # On error, allow the request (fail open)
        return True, FEEDBACK_RATE_LIMIT


def get_user_subscription_status(user_id: Optional[str], db_helper: DynamoDBHelper) -> str:
    """Get user subscription status if user_id is provided"""
    if not user_id:
        return "Anonymous"

    try:
        subscription = db_helper.get_user_subscription(user_id)
        if subscription:
            return subscription.get('subscription_status', 'free').capitalize()
        return "Free"
    except Exception as e:
        logger.warning(f"Failed to get subscription status: {str(e)}")
        return "Unknown"


def send_email_notification(feedback_data: Dict[str, Any]) -> bool:
    """
    Send email notification to admin

    Returns:
        True if email sent successfully, False otherwise
    """
    try:
        # Format email subject
        feedback_type = feedback_data.get('feedback_type', 'feedback')
        subject = feedback_data.get('subject', 'No subject')
        email_subject = f"[ScatterPilot Feedback] {feedback_type.title()}: {subject}"

        # Format email body
        email_body = f"""New feedback received from ScatterPilot

Type: {feedback_type.title()}
Subject: {subject}

Message:
{feedback_data.get('message', 'No message provided')}

User Details:
• Email: {feedback_data.get('user_email', 'Not provided')}
• User ID: {feedback_data.get('user_id', 'Anonymous')}
• Subscription: {feedback_data.get('subscription_status', 'Unknown')}
• Page: {feedback_data.get('page_url', 'Not provided')}
• Browser: {feedback_data.get('user_agent', 'Not provided')}
• Time: {feedback_data.get('created_at', 'Unknown')}

Reply directly to this email to respond to the user.
"""

        # Send email via SES
        response = ses_client.send_email(
            Source=SENDER_EMAIL,
            Destination={
                'ToAddresses': [NOTIFICATION_EMAIL]
            },
            ReplyToAddresses=[feedback_data.get('user_email', NOTIFICATION_EMAIL)],
            Message={
                'Subject': {
                    'Data': email_subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Text': {
                        'Data': email_body,
                        'Charset': 'UTF-8'
                    }
                }
            }
        )

        logger.info(f"Email notification sent successfully. MessageId: {response['MessageId']}")
        return True

    except ClientError as e:
        error_code = e.response['Error']['Code']
        error_message = e.response['Error']['Message']
        logger.error(f"SES error: {error_code} - {error_message}")

        # Check if it's a verification issue
        if error_code == 'MessageRejected' and 'Email address is not verified' in error_message:
            logger.warning("SES email not verified. Feedback saved but email not sent.")

        return False

    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for submitting feedback

    Request body:
    {
        "type": "bug|feature|question|other",
        "subject": "string",
        "message": "string",
        "email": "string (optional if logged in)",
        "user_id": "string (auto-filled if logged in)"
    }

    Returns:
        API Gateway response
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Parse request body
        try:
            body = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return create_error_response(400, "Invalid JSON in request body", "InvalidJSON")

        # Validate required fields
        feedback_type = body.get('type', 'other')
        subject = body.get('subject', '').strip()
        message = body.get('message', '').strip()
        user_email = body.get('email', '').strip()

        if not subject:
            return create_error_response(400, "Subject is required", "ValidationError")

        if not message:
            return create_error_response(400, "Message is required", "ValidationError")

        if not user_email:
            return create_error_response(400, "Email is required", "ValidationError")

        if len(message) > 5000:
            return create_error_response(400, "Message too long (max 5000 characters)", "ValidationError")

        # Validate feedback type
        valid_types = ['bug', 'feature', 'question', 'other']
        if feedback_type not in valid_types:
            feedback_type = 'other'

        # Extract optional user_id (from Cognito if logged in)
        user_id = None
        try:
            auth_context = event.get('requestContext', {}).get('authorizer', {})
            claims = auth_context.get('claims', {})
            user_id = claims.get('sub') or claims.get('cognito:username')
        except:
            pass  # User not logged in - that's okay

        # Capture context
        headers = event.get('headers', {})
        user_agent = headers.get('User-Agent', headers.get('user-agent', 'Unknown'))
        page_url = body.get('page_url', headers.get('Referer', headers.get('referer', 'Unknown')))

        db_helper = DynamoDBHelper()

        # Check rate limit
        is_allowed, remaining = check_rate_limit(user_email, db_helper)
        if not is_allowed:
            logger.warning(f"Rate limit exceeded for {user_email}")
            return create_error_response(
                429,
                "Please wait before submitting more feedback. You can submit up to 3 feedback messages per hour.",
                "RateLimitExceeded"
            )

        # Get subscription status
        subscription_status = get_user_subscription_status(user_id, db_helper)

        # Generate feedback ID
        feedback_id = str(uuid.uuid4())
        created_at = datetime.utcnow().isoformat() + 'Z'

        # Prepare feedback record
        feedback_record = {
            'feedback_id': feedback_id,
            'created_at': created_at,
            'user_id': user_id or 'anonymous',
            'user_email': user_email,
            'feedback_type': feedback_type,
            'subject': subject,
            'message': message,
            'page_url': page_url,
            'user_agent': user_agent,
            'subscription_status': subscription_status,
            'status': 'new'
        }

        # Save to DynamoDB
        table = dynamodb.Table(FEEDBACK_TABLE)
        table.put_item(Item=feedback_record)

        logger.info(f"Feedback saved: {feedback_id}",
                   feedback_type=feedback_type,
                   user_email=user_email)

        # Send email notification (don't fail if email fails)
        email_sent = send_email_notification(feedback_record)

        if not email_sent:
            logger.warning("Feedback saved but email notification failed")

        return create_success_response({
            'message': 'Feedback submitted successfully. We\'ll respond within 24 hours.',
            'feedback_id': feedback_id,
            'email_sent': email_sent
        })

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Failed to save feedback. Please try again.", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
