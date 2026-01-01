"""
Structured logging with PII redaction for CloudWatch
Uses AWS Lambda Powertools for consistent log formatting
"""

import json
import re
from typing import Any, Dict, Optional
from aws_lambda_powertools import Logger
from aws_lambda_powertools.logging import correlation_paths


# PII patterns to redact
PII_PATTERNS = {
    "email": re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'),
    "phone": re.compile(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'),
    "ssn": re.compile(r'\b\d{3}-\d{2}-\d{4}\b'),
    "credit_card": re.compile(r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'),
    "api_key": re.compile(r'(?i)(api[_-]?key|apikey|access[_-]?key)["\']?\s*[:=]\s*["\']?([a-zA-Z0-9_\-]{20,})'),
}

# Fields that should always be redacted
SENSITIVE_FIELDS = {
    "password", "secret", "token", "authorization", "api_key", "access_key",
    "private_key", "ssn", "credit_card", "cvv", "pin"
}


def redact_pii(text: str) -> str:
    """
    Redact personally identifiable information from text

    Args:
        text: Text that may contain PII

    Returns:
        Text with PII replaced by [REDACTED]
    """
    if not isinstance(text, str):
        return text

    redacted = text
    for pattern_name, pattern in PII_PATTERNS.items():
        if pattern_name == "api_key":
            # Special handling for API keys in key-value pairs
            redacted = pattern.sub(r'\1=[REDACTED]', redacted)
        else:
            redacted = pattern.sub('[REDACTED]', redacted)

    return redacted


def sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Recursively sanitize a dictionary to remove sensitive information

    Args:
        data: Dictionary that may contain sensitive data

    Returns:
        Sanitized dictionary with sensitive values redacted
    """
    if not isinstance(data, dict):
        return data

    sanitized = {}
    for key, value in data.items():
        # Check if key indicates sensitive data
        if key.lower() in SENSITIVE_FIELDS:
            sanitized[key] = "[REDACTED]"
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value)
        elif isinstance(value, list):
            sanitized[key] = [
                sanitize_dict(item) if isinstance(item, dict) else redact_pii(str(item))
                for item in value
            ]
        elif isinstance(value, str):
            sanitized[key] = redact_pii(value)
        else:
            sanitized[key] = value

    return sanitized


class ScatterPilotLogger:
    """
    Enhanced logger with PII redaction and request tracing
    Wraps AWS Lambda Powertools Logger
    """

    def __init__(self, service_name: str, log_level: str = "INFO"):
        """
        Initialize logger

        Args:
            service_name: Name of the service/function
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        """
        self.logger = Logger(
            service=service_name,
            level=log_level
        )
        self.service_name = service_name

    def set_correlation_id(self, correlation_id: str) -> None:
        """
        Set correlation ID for request tracing

        Args:
            correlation_id: Unique identifier for the request chain
        """
        self.logger.append_keys(correlation_id=correlation_id)

    def set_user_id(self, user_id: str) -> None:
        """
        Set user ID for tracking user actions (non-PII)

        Args:
            user_id: User identifier
        """
        # Hash or anonymize if needed for privacy
        self.logger.append_keys(user_id=user_id)

    def info(self, message: str, **kwargs) -> None:
        """
        Log info level message with PII redaction

        Args:
            message: Log message
            **kwargs: Additional context (will be sanitized)
        """
        sanitized_kwargs = sanitize_dict(kwargs)
        redacted_message = redact_pii(message)
        self.logger.info(redacted_message, extra=sanitized_kwargs)

    def error(self, message: str, error: Optional[Exception] = None, **kwargs) -> None:
        """
        Log error level message with exception details

        Args:
            message: Error message
            error: Exception object
            **kwargs: Additional context (will be sanitized)
        """
        sanitized_kwargs = sanitize_dict(kwargs)
        redacted_message = redact_pii(message)

        if error:
            sanitized_kwargs["error_type"] = type(error).__name__
            sanitized_kwargs["error_message"] = redact_pii(str(error))

        self.logger.error(redacted_message, extra=sanitized_kwargs)

    def warning(self, message: str, **kwargs) -> None:
        """
        Log warning level message

        Args:
            message: Warning message
            **kwargs: Additional context (will be sanitized)
        """
        sanitized_kwargs = sanitize_dict(kwargs)
        redacted_message = redact_pii(message)
        self.logger.warning(redacted_message, extra=sanitized_kwargs)

    def debug(self, message: str, **kwargs) -> None:
        """
        Log debug level message

        Args:
            message: Debug message
            **kwargs: Additional context (will be sanitized)
        """
        sanitized_kwargs = sanitize_dict(kwargs)
        redacted_message = redact_pii(message)
        self.logger.debug(redacted_message, extra=sanitized_kwargs)

    def log_api_call(
        self,
        service: str,
        operation: str,
        status: str,
        duration_ms: float,
        **kwargs
    ) -> None:
        """
        Log external API call with metrics

        Args:
            service: Service name (e.g., 'bedrock', 'dynamodb')
            operation: Operation name (e.g., 'converse', 'put_item')
            status: Status (success/error)
            duration_ms: Call duration in milliseconds
            **kwargs: Additional context
        """
        sanitized_kwargs = sanitize_dict(kwargs)
        self.logger.info(
            f"API call: {service}.{operation}",
            extra={
                "service": service,
                "operation": operation,
                "status": status,
                "duration_ms": round(duration_ms, 2),
                **sanitized_kwargs
            }
        )

    def log_lambda_invocation(
        self,
        event: Dict[str, Any],
        context: Optional[Any] = None
    ) -> None:
        """
        Log Lambda function invocation details

        Args:
            event: Lambda event object (will be sanitized)
            context: Lambda context object
        """
        sanitized_event = sanitize_dict(event)

        log_data = {
            "event_keys": list(event.keys()),
            "event_sample": str(sanitized_event)[:500]  # Truncate for log size
        }

        if context:
            log_data.update({
                "function_name": getattr(context, 'function_name', None),
                "request_id": getattr(context, 'aws_request_id', None),
                "memory_limit_mb": getattr(context, 'memory_limit_in_mb', None)
            })

        self.logger.info("Lambda invocation started", extra=log_data)

    def log_bedrock_usage(
        self,
        input_tokens: int,
        output_tokens: int,
        conversation_id: str
    ) -> None:
        """
        Log Bedrock API usage metrics for cost tracking

        Args:
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            conversation_id: Conversation identifier
        """
        self.logger.info(
            "Bedrock API usage",
            extra={
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": input_tokens + output_tokens,
                "conversation_id": conversation_id,
                "model": "us.anthropic.claude-sonnet-4-5-20250929-v1:0"
            }
        )


def get_logger(service_name: str, log_level: str = "INFO") -> ScatterPilotLogger:
    """
    Factory function to create a logger instance

    Args:
        service_name: Name of the service/function
        log_level: Logging level

    Returns:
        Configured logger instance
    """
    return ScatterPilotLogger(service_name=service_name, log_level=log_level)
