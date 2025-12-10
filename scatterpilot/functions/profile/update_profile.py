"""
Lambda function: Update User Profile
Allows users to update their business and contact information
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
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("update_profile")


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for updating user profile

    Request body:
    {
        "business_name": "MAYROD",
        "contact_name": "John Doe",
        "email": "john@mayrod.com",
        "phone": "+1-555-0100",
        "address_line1": "123 Main St",
        "address_line2": "Suite 100",
        "city": "New York",
        "state": "NY",
        "zip_code": "10001",
        "country": "USA"
    }

    Returns:
        API Gateway response with updated profile
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract user ID
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)
        logger.info("Processing profile update request", user_id=user_id)

        # Parse request body
        try:
            body = json.loads(event.get('body', '{}'))
            logger.debug("Request body parsed", body_keys=list(body.keys()))
        except json.JSONDecodeError as e:
            logger.warning("Invalid JSON in request body", error=str(e))
            return create_error_response(400, "Invalid JSON in request body", "ValidationError")

        # Extract profile fields
        business_name = body.get('business_name')
        contact_name = body.get('contact_name')
        email = body.get('email')
        phone = body.get('phone')
        address_line1 = body.get('address_line1')
        address_line2 = body.get('address_line2')
        city = body.get('city')
        state = body.get('state')
        zip_code = body.get('zip_code')
        country = body.get('country')

        logger.info("Profile fields extracted",
                   has_business_name=business_name is not None,
                   business_name_value=repr(business_name),
                   has_contact_name=contact_name is not None,
                   has_email=email is not None,
                   has_phone=phone is not None)

        # Validate business_name if provided and not empty
        # Note: Empty strings should be treated as "not provided"
        if business_name is not None and business_name != "":
            business_name = business_name.strip()
            logger.debug("Validating business_name", length=len(business_name))

            if len(business_name) < 2:
                logger.warning("business_name validation failed: too short",
                             business_name_length=len(business_name))
                return create_error_response(
                    400,
                    "business_name must be at least 2 characters",
                    "ValidationError"
                )
            if len(business_name) > 100:
                logger.warning("business_name validation failed: too long",
                             business_name_length=len(business_name))
                return create_error_response(
                    400,
                    "business_name must be less than 100 characters",
                    "ValidationError"
                )
            logger.info("business_name validation passed")
        elif business_name == "":
            # Treat empty string as None (not provided)
            logger.info("business_name is empty string, treating as not provided")
            business_name = None

        # Update profile
        logger.info("Initiating database update", user_id=user_id)
        db_helper = DynamoDBHelper()
        db_helper.update_user_profile(
            user_id=user_id,
            business_name=business_name,
            contact_name=contact_name,
            email=email,
            phone=phone,
            address_line1=address_line1,
            address_line2=address_line2,
            city=city,
            state=state,
            zip_code=zip_code,
            country=country
        )
        logger.info("Database update completed successfully")

        # Get updated profile
        logger.debug("Fetching updated profile from database")
        updated_profile = db_helper.get_user_profile(user_id)
        logger.debug("Updated profile retrieved", profile_keys=list(updated_profile.keys()) if updated_profile else None)

        logger.info("Profile updated successfully")

        return create_success_response({
            'message': 'Profile updated successfully',
            'profile': updated_profile
        })

    except InputValidationError as e:
        logger.warning("Input validation error", error=str(e))
        return create_error_response(400, str(e), "ValidationError")

    except DynamoDBException as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e))
        return create_error_response(500, "An unexpected error occurred", "InternalError")
