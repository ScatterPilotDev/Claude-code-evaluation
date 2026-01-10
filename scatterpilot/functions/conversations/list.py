"""
Lambda function: List Conversations
Retrieves user's conversation history with pagination support
"""

import json
import os
import sys
from typing import Any, Dict

# Add layer to path
sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response
)
from common.logger import get_logger

logger = get_logger("list_conversations")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for listing user conversations

    Query Parameters:
    - limit: Number of conversations to return (default: 20, max: 100)
    - last_key: Pagination token from previous response

    Returns:
        API Gateway response with conversations list
    """
    # Log invocation
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract and validate user ID from Cognito authorizer
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse query parameters
        query_params = event.get('queryStringParameters') or {}

        # Limit: default 20, max 100
        try:
            limit = int(query_params.get('limit', '20'))
            limit = min(max(1, limit), 100)  # Clamp between 1 and 100
        except (ValueError, TypeError):
            limit = 20

        # Pagination token
        last_key = None
        last_key_param = query_params.get('last_key')
        if last_key_param:
            try:
                last_key = json.loads(last_key_param)
            except json.JSONDecodeError:
                logger.warning("Invalid pagination token", last_key_param=last_key_param)
                # Continue without pagination token

        logger.info(
            "Listing conversations",
            user_id=user_id,
            limit=limit,
            has_pagination=bool(last_key)
        )

        # Query database
        db_helper = DynamoDBHelper()
        conversations, next_key = db_helper.list_user_conversations(
            user_id=user_id,
            limit=limit,
            last_evaluated_key=last_key
        )

        # Convert conversations to response format
        conversations_data = []
        for conv in conversations:
            # Get last message preview
            last_message = None
            last_message_timestamp = None
            if conv.messages:
                last_msg = conv.messages[-1]
                last_message = last_msg.content[:100]  # First 100 chars
                last_message_timestamp = last_msg.timestamp.isoformat()

            conversations_data.append({
                'conversation_id': conv.conversation_id,
                'state': conv.state.value,
                'created_at': conv.created_at.isoformat(),
                'updated_at': conv.updated_at.isoformat(),
                'message_count': len(conv.messages),
                'last_message': last_message,
                'last_message_timestamp': last_message_timestamp,
                'has_invoice': bool(conv.extracted_data and
                                   conv.extracted_data.get('action') == 'create_invoice')
            })

        logger.info(
            "Conversations retrieved",
            user_id=user_id,
            count=len(conversations_data),
            has_more=bool(next_key)
        )

        # Build response
        response_data = {
            'conversations': conversations_data,
            'count': len(conversations_data),
            'has_more': bool(next_key)
        }

        # Include pagination token if there are more results
        if next_key:
            response_data['next_key'] = json.dumps(next_key)

        return create_success_response(response_data)

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(
            500,
            "Failed to retrieve conversations",
            "DatabaseError"
        )

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(
            500,
            "An unexpected error occurred",
            "InternalError"
        )
