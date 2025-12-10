"""
Security utilities for input validation, sanitization, and rate limiting
Implements defense-in-depth against common web vulnerabilities
"""

import html
import json
import re
from typing import Any, Dict, Optional
from datetime import datetime, timedelta


class SecurityException(Exception):
    """Base exception for security violations"""
    pass


class InputValidationError(SecurityException):
    """Raised when input validation fails"""
    pass


class RateLimitExceeded(SecurityException):
    """Raised when rate limit is exceeded"""
    pass


# Dangerous patterns that should be rejected
DANGEROUS_PATTERNS = [
    re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),  # XSS
    re.compile(r'javascript:', re.IGNORECASE),  # XSS
    re.compile(r'on\w+\s*=', re.IGNORECASE),  # Event handlers
    re.compile(r'eval\s*\(', re.IGNORECASE),  # Code execution
    re.compile(r'expression\s*\(', re.IGNORECASE),  # CSS expressions
    re.compile(r'import\s+', re.IGNORECASE),  # Code injection
    re.compile(r'<iframe[^>]*>', re.IGNORECASE),  # Iframe injection
    re.compile(r'<embed[^>]*>', re.IGNORECASE),  # Embed injection
    re.compile(r'<object[^>]*>', re.IGNORECASE),  # Object injection
]

# SQL injection patterns (defense in depth - Pydantic/DynamoDB prevent this, but check anyway)
# NOTE: Relaxed to allow apostrophes in natural language (user messages like "I'm", "client's", etc.)
# We use DynamoDB (NoSQL) so SQL injection is not relevant, but keeping obvious SQL keyword patterns
SQL_INJECTION_PATTERNS = [
    # Only block actual SQL keywords in context, not simple punctuation
    re.compile(r'\b(UNION\s+(ALL\s+)?SELECT|SELECT\s+.*\s+FROM|INSERT\s+INTO|DELETE\s+FROM|DROP\s+TABLE|UPDATE\s+.*\s+SET)\b', re.IGNORECASE),
    # Block common SQL injection patterns with multiple keywords
    re.compile(r"('.*OR.*'.*=.*'|'.*AND.*'.*=.*'|\d+\s*=\s*\d+\s+(OR|AND)\s+\d+\s*=\s*\d+)", re.IGNORECASE),
]


def sanitize_input(text: str, max_length: int = 10000) -> str:
    """
    Sanitize user input to prevent XSS and injection attacks

    Args:
        text: User-provided text
        max_length: Maximum allowed length

    Returns:
        Sanitized text

    Raises:
        InputValidationError: If input contains dangerous patterns
    """
    if not isinstance(text, str):
        raise InputValidationError("Input must be a string")

    # Check length
    if len(text) > max_length:
        raise InputValidationError(f"Input exceeds maximum length of {max_length}")

    # Check for dangerous patterns
    for pattern in DANGEROUS_PATTERNS:
        if pattern.search(text):
            raise InputValidationError("Input contains potentially dangerous content")

    # Check for SQL injection (defense in depth)
    for pattern in SQL_INJECTION_PATTERNS:
        if pattern.search(text):
            raise InputValidationError("Input contains potentially dangerous SQL patterns")

    # HTML entity encoding to prevent XSS
    sanitized = html.escape(text, quote=True)

    # Additional cleanup: remove null bytes
    sanitized = sanitized.replace('\x00', '')

    return sanitized.strip()


def sanitize_dict(data: Dict[str, Any], max_depth: int = 5, current_depth: int = 0) -> Dict[str, Any]:
    """
    Recursively sanitize all string values in a dictionary

    Args:
        data: Dictionary to sanitize
        max_depth: Maximum recursion depth
        current_depth: Current recursion level

    Returns:
        Sanitized dictionary

    Raises:
        InputValidationError: If depth limit exceeded
    """
    if current_depth >= max_depth:
        raise InputValidationError("Data structure too deeply nested")

    if not isinstance(data, dict):
        return data

    sanitized = {}
    for key, value in data.items():
        # Sanitize the key itself
        if not isinstance(key, str):
            continue

        safe_key = sanitize_input(key, max_length=256)

        # Sanitize the value based on type
        if isinstance(value, str):
            sanitized[safe_key] = sanitize_input(value)
        elif isinstance(value, dict):
            sanitized[safe_key] = sanitize_dict(value, max_depth, current_depth + 1)
        elif isinstance(value, list):
            sanitized[safe_key] = [
                sanitize_dict(item, max_depth, current_depth + 1) if isinstance(item, dict)
                else sanitize_input(item) if isinstance(item, str)
                else item
                for item in value
            ]
        else:
            sanitized[safe_key] = value

    return sanitized


def validate_user_id(user_id: Optional[str]) -> str:
    """
    Validate user ID format - REQUIRED for authenticated requests

    Args:
        user_id: User identifier from Cognito

    Returns:
        Validated user ID

    Raises:
        InputValidationError: If user ID is missing or invalid
    """
    # Require authentication - no default user
    if not user_id or not isinstance(user_id, str):
        raise InputValidationError("Authentication required: Missing user ID")

    # Cognito user IDs are UUIDs or similar alphanumeric strings
    if not re.match(r'^[a-zA-Z0-9_\-:.]{1,256}$', user_id):
        raise InputValidationError("Invalid user ID format")

    return user_id


def validate_uuid(value: str, field_name: str = "ID") -> str:
    """
    Validate UUID format

    Args:
        value: UUID string
        field_name: Name of the field for error messages

    Returns:
        Validated UUID

    Raises:
        InputValidationError: If UUID is invalid
    """
    if not value or not isinstance(value, str):
        raise InputValidationError(f"{field_name} is required")

    # UUID v4 pattern
    uuid_pattern = r'^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    if not re.match(uuid_pattern, value.lower()):
        raise InputValidationError(f"Invalid {field_name} format")

    return value


def validate_pagination_params(limit: Optional[int], offset: Optional[int]) -> tuple[int, int]:
    """
    Validate and sanitize pagination parameters

    Args:
        limit: Number of items to return
        offset: Number of items to skip

    Returns:
        Tuple of (validated_limit, validated_offset)

    Raises:
        InputValidationError: If parameters are invalid
    """
    # Default and max values
    default_limit = 20
    max_limit = 100
    max_offset = 10000

    validated_limit = default_limit
    validated_offset = 0

    if limit is not None:
        if not isinstance(limit, int) or limit < 1:
            raise InputValidationError("Limit must be a positive integer")
        if limit > max_limit:
            raise InputValidationError(f"Limit cannot exceed {max_limit}")
        validated_limit = limit

    if offset is not None:
        if not isinstance(offset, int) or offset < 0:
            raise InputValidationError("Offset must be a non-negative integer")
        if offset > max_offset:
            raise InputValidationError(f"Offset cannot exceed {max_offset}")
        validated_offset = offset

    return validated_limit, validated_offset


class RateLimiter:
    """
    Rate limiting logic (works with DynamoDB storage)
    Implements token bucket algorithm
    """

    def __init__(
        self,
        max_requests: int = 100,
        window_seconds: int = 3600
    ):
        """
        Initialize rate limiter

        Args:
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds (default: 1 hour)
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    def check_limit(
        self,
        current_count: int,
        window_start: datetime
    ) -> bool:
        """
        Check if request should be allowed

        Args:
            current_count: Current request count in window
            window_start: Start of the current window

        Returns:
            True if request is allowed, False otherwise
        """
        # Check if window has expired
        elapsed = (datetime.utcnow() - window_start).total_seconds()
        if elapsed >= self.window_seconds:
            # New window, allow request
            return True

        # Within window, check count
        return current_count < self.max_requests

    def get_reset_time(self, window_start: datetime) -> datetime:
        """
        Calculate when the rate limit will reset

        Args:
            window_start: Start of the current window

        Returns:
            Timestamp when limit resets
        """
        return window_start + timedelta(seconds=self.window_seconds)

    def calculate_ttl(self) -> int:
        """
        Calculate TTL for DynamoDB record

        Returns:
            Unix timestamp for TTL (window_seconds from now)
        """
        return int((datetime.utcnow() + timedelta(seconds=self.window_seconds)).timestamp())


def create_error_response(
    status_code: int,
    message: str,
    error_type: str = "Error"
) -> Dict[str, Any]:
    """
    Create standardized error response for API Gateway

    Args:
        status_code: HTTP status code
        message: Error message
        error_type: Type of error

    Returns:
        API Gateway response object
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
        },
        "body": json.dumps({
            "error": {
                "type": error_type,
                "message": message
            }
        })
    }


def create_success_response(
    data: Any,
    status_code: int = 200
) -> Dict[str, Any]:
    """
    Create standardized success response for API Gateway

    Args:
        data: Response data
        status_code: HTTP status code

    Returns:
        API Gateway response object
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
        },
        "body": json.dumps(data)
    }


def extract_user_id_from_event(event: Dict[str, Any]) -> str:
    """
    Extract and validate user ID from API Gateway event with Cognito authorization

    Args:
        event: Lambda event from API Gateway

    Returns:
        Validated user ID from Cognito claims

    Raises:
        InputValidationError: If user ID is missing or invalid (401 Unauthorized)
    """
    # Get from Cognito authorizer context
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})

    # Cognito authorizer puts claims in 'claims' object
    claims = authorizer.get("claims", {})
    user_id = claims.get("sub") or claims.get("cognito:username")

    # Validate and return - will raise InputValidationError if missing
    return validate_user_id(user_id)
