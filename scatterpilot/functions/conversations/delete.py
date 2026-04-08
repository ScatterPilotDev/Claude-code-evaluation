"""
Lambda function: Delete Conversation
Deletes a conversation owned by the authenticated user
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

logger = get_logger("delete_conversation")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for deleting a conversation

    Path Parameters:
    - conversation_id: The conversation to delete

    Returns:
        API Gateway response confirming deletion
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

        logger.info("Deleting conversation", conversation_id=conversation_id, user_id=user_id)

        db_helper = DynamoDBHelper()
        db_helper.delete_conversation(conversation_id, user_id)

        return create_success_response({'deleted': True, 'conversation_id': conversation_id})

    except ItemNotFoundError:
        return create_error_response(404, "Conversation not found", "NotFoundError")

    except DynamoDBException as e:
        logger.error("Database error", error=e)
        return create_error_response(500, "Failed to delete conversation", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=e)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
