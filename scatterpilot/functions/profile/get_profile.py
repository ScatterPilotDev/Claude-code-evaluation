"""
Lambda function: Get User Profile
Returns business and contact information for the current user
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
    create_success_response,
)
from common.logger import get_logger

logger = get_logger("get_profile")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for getting user profile

    Returns:
        API Gateway response with profile details
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        db_helper = DynamoDBHelper()

        # Get user profile
        profile = db_helper.get_user_profile(user_id)

        if not profile:
            # No profile record - return empty defaults
            return create_success_response({
                'business_name': None,
                'contact_name': None,
                'email': None,
                'phone': None,
                'address_line1': None,
                'address_line2': None,
                'city': None,
                'state': None,
                'zip_code': None,
                'country': 'USA'
            })

        logger.info("Profile retrieved", has_business_name=bool(profile.get('business_name')))

        return create_success_response(profile)

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
