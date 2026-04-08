"""
Lambda function: Get Conversation
Retrieves a single conversation with its full message history
"""

import json
import os
import sys
from typing import Any, Dict

sys.path.insert(0, '/opt/python')

from common.dynamodb_helper import DynamoDBHelper, DynamoDBException, ItemNotFoundError
from common.security import (
    extract_user_id_from_event,
    create_error_response,
    create_success_response
)
from common.logger import get_logger

logger = get_logger("get_conversation")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for getting a single conversation

    Path Parameters:
    - conversation_id: The conversation to retrieve

    Returns:
        API Gateway response with conversation data including messages
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        path_params = event.get('pathParameters') or {}
        conversation_id = path_params.get('conversation_id')
        if not conversation_id:
            return create_error_response(400, "conversation_id is required", "ValidationError")

        logger.info("Getting conversation", conversation_id=conversation_id, user_id=user_id)

        db_helper = DynamoDBHelper()
        conversation = db_helper.get_conversation(conversation_id)

        if conversation is None or conversation.user_id != user_id:
            return create_error_response(404, "Conversation not found", "NotFoundError")

        messages = [
            {
                'role': msg.role,
                'content': msg.content,
                'timestamp': msg.timestamp.isoformat() if msg.timestamp else None
            }
            for msg in (conversation.messages or [])
        ]

        response_data = {
            'conversation_id': conversation.conversation_id,
            'state': conversation.state.value,
            'created_at': conversation.created_at.isoformat(),
            'updated_at': conversation.updated_at.isoformat(),
            'message_count': len(messages),
            'messages': messages,
            'has_invoice': bool(
                conversation.extracted_data and
                conversation.extracted_data.get('action') == 'create_invoice'
            )
        }

        return create_success_response(response_data)

    except ItemNotFoundError:
        return create_error_response(404, "Conversation not found", "NotFoundError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Failed to retrieve conversation", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
