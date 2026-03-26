"""
Lambda function: Create Stripe Payment Link
Creates a payment link for an invoice using the user's connected Stripe account.
Pro users can collect payments directly through their Stripe account.
"""

import json
import os
import sys
from typing import Any, Dict
from datetime import datetime
from decimal import Decimal

# Add layer to path
sys.path.insert(0, '/opt/python')

import boto3
import stripe
from botocore.exceptions import ClientError

from common.security import (
    extract_user_id_from_event,
    validate_uuid,
    create_error_response,
    create_success_response,
    InputValidationError
)
from common.logger import get_logger

logger = get_logger("create_payment_link")

# Environment configuration
INVOICES_TABLE = os.environ.get('INVOICES_TABLE', 'ScatterPilot-Invoices-dev')
SUBSCRIPTIONS_TABLE = os.environ.get('SUBSCRIPTIONS_TABLE', 'ScatterPilot-Subscriptions-dev')
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# DynamoDB
dynamodb = boto3.resource('dynamodb')
invoices_table = dynamodb.Table(INVOICES_TABLE)
subscriptions_table = dynamodb.Table(SUBSCRIPTIONS_TABLE)


class StripePaymentError(Exception):
    """Raised when Stripe payment link creation fails"""
    pass


def get_invoice(invoice_id: str) -> Dict[str, Any]:
    """
    Retrieve invoice from DynamoDB

    Args:
        invoice_id: Invoice identifier

    Returns:
        Invoice data dictionary

    Raises:
        Exception if invoice not found
    """
    try:
        response = invoices_table.get_item(Key={'invoice_id': invoice_id})

        if 'Item' not in response:
            return None

        return response['Item']

    except ClientError as e:
        logger.error("Failed to get invoice", error=str(e), invoice_id=invoice_id)
        raise


def get_user_subscription(user_id: str) -> Dict[str, Any]:
    """
    Get user's subscription data including Stripe connection info

    Args:
        user_id: User identifier

    Returns:
        Subscription data dictionary or None
    """
    try:
        response = subscriptions_table.get_item(Key={'user_id': user_id})
        return response.get('Item')

    except ClientError as e:
        logger.error("Failed to get subscription", error=str(e), user_id=user_id)
        raise


def create_stripe_payment_link(
    invoice_data: Dict[str, Any],
    invoice_id: str,
    stripe_account_id: str
) -> str:
    """
    Create a Stripe Payment Link for the invoice using the connected account

    Args:
        invoice_data: Invoice data from DynamoDB
        invoice_id: Invoice identifier for metadata
        stripe_account_id: Connected Stripe account ID

    Returns:
        Payment link URL

    Raises:
        StripePaymentError if creation fails
    """
    try:
        # Extract invoice details
        data = invoice_data.get('data', {})
        customer_name = data.get('customer_name', 'Customer')
        invoice_number = data.get('invoice_number', invoice_id[:8])
        total = data.get('total', '0')

        # Convert total to cents (Stripe uses smallest currency unit)
        total_decimal = Decimal(str(total))
        amount_cents = int(total_decimal * 100)

        if amount_cents <= 0:
            raise StripePaymentError("Invoice total must be greater than zero")

        # Build line item descriptions for the product
        line_items = data.get('line_items', [])
        description_parts = []
        for item in line_items[:5]:  # Limit to first 5 items for description
            desc = item.get('description', 'Item')
            qty = item.get('quantity', '1')
            description_parts.append(f"{desc} (x{qty})")

        product_description = "; ".join(description_parts) if description_parts else "Invoice items"
        if len(product_description) > 500:
            product_description = product_description[:497] + "..."

        # Create a product on the connected account
        product = stripe.Product.create(
            name=f"Invoice #{invoice_number} - {customer_name}",
            description=product_description,
            metadata={
                'invoice_id': invoice_id,
                'customer_name': customer_name,
                'invoice_number': invoice_number
            },
            stripe_account=stripe_account_id
        )

        logger.info(
            "Created Stripe product",
            product_id=product.id,
            stripe_account=stripe_account_id
        )

        # Create a price for this product (one-time payment)
        price = stripe.Price.create(
            product=product.id,
            unit_amount=amount_cents,
            currency='usd',
            metadata={
                'invoice_id': invoice_id
            },
            stripe_account=stripe_account_id
        )

        logger.info(
            "Created Stripe price",
            price_id=price.id,
            amount_cents=amount_cents
        )

        # Create the payment link
        payment_link = stripe.PaymentLink.create(
            line_items=[{
                'price': price.id,
                'quantity': 1
            }],
            metadata={
                'invoice_id': invoice_id,
                'customer_name': customer_name,
                'invoice_number': invoice_number
            },
            after_completion={
                'type': 'redirect',
                'redirect': {
                    'url': f"{FRONTEND_URL}/payment-success?invoice_id={invoice_id}"
                }
            },
            stripe_account=stripe_account_id
        )

        logger.info(
            "Created Stripe payment link",
            payment_link_id=payment_link.id,
            url=payment_link.url
        )

        return payment_link.url

    except stripe.error.StripeError as e:
        logger.error(
            "Stripe API error",
            error=str(e),
            error_type=type(e).__name__,
            stripe_account=stripe_account_id
        )
        raise StripePaymentError(f"Failed to create payment link: {str(e)}")


def update_invoice_payment_link(invoice_id: str, payment_link_url: str) -> None:
    """
    Update invoice record with payment link URL

    Args:
        invoice_id: Invoice identifier
        payment_link_url: Stripe payment link URL
    """
    try:
        now = datetime.utcnow().isoformat()

        invoices_table.update_item(
            Key={'invoice_id': invoice_id},
            UpdateExpression='SET payment_link_url = :url, payment_link_created_at = :now, updated_at = :now',
            ExpressionAttributeValues={
                ':url': payment_link_url,
                ':now': now
            }
        )

        logger.info(
            "Updated invoice with payment link",
            invoice_id=invoice_id,
            payment_link_url=payment_link_url
        )

    except ClientError as e:
        logger.error(
            "Failed to update invoice",
            error=str(e),
            invoice_id=invoice_id
        )
        raise


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda handler for creating Stripe payment links

    Request body:
    - invoice_id: Invoice identifier (required)

    Returns:
        API Gateway response with payment link URL
    """
    logger.log_lambda_invocation(event, context)
    request_id = context.aws_request_id if context else "local"
    logger.set_correlation_id(request_id)

    try:
        # Extract and validate user ID from Cognito
        user_id = extract_user_id_from_event(event)
        logger.set_user_id(user_id)

        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body) if body else {}

        invoice_id = body.get('invoice_id')

        if not invoice_id:
            return create_error_response(
                400,
                "invoice_id is required",
                "ValidationError"
            )

        # Validate UUID format
        try:
            invoice_id = validate_uuid(invoice_id, "Invoice ID")
        except InputValidationError as e:
            return create_error_response(400, str(e), "ValidationError")

        logger.info("Creating payment link", invoice_id=invoice_id)

        # Get invoice from DynamoDB
        invoice = get_invoice(invoice_id)

        if not invoice:
            logger.warning("Invoice not found", invoice_id=invoice_id)
            return create_error_response(404, "Invoice not found", "NotFound")

        # Verify ownership
        if invoice.get('user_id') != user_id:
            logger.warning(
                "Unauthorized invoice access",
                invoice_id=invoice_id,
                invoice_owner=invoice.get('user_id'),
                requesting_user=user_id
            )
            return create_error_response(
                403,
                "Not authorized to access this invoice",
                "Forbidden"
            )

        # Check if payment link already exists
        existing_link = invoice.get('payment_link_url')
        if existing_link:
            logger.info(
                "Payment link already exists",
                invoice_id=invoice_id,
                payment_link_url=existing_link
            )
            return create_success_response({
                "invoice_id": invoice_id,
                "payment_link_url": existing_link,
                "already_exists": True,
                "message": "Payment link already exists for this invoice"
            })

        # Get user's subscription and Stripe connection
        subscription = get_user_subscription(user_id)

        if not subscription:
            logger.warning("No subscription found", user_id=user_id)
            return create_error_response(
                403,
                "Pro subscription required to create payment links",
                "SubscriptionRequired"
            )

        subscription_status = subscription.get('subscription_status', 'free')

        if subscription_status != 'pro':
            logger.warning(
                "Non-Pro user attempted payment link creation",
                user_id=user_id,
                subscription_status=subscription_status
            )
            return create_error_response(
                403,
                "Pro subscription required to create payment links. Upgrade to Pro to collect payments directly.",
                "ProRequired"
            )

        # Check Stripe connection
        stripe_account_id = subscription.get('stripe_account_id')
        stripe_access_token = subscription.get('stripe_access_token')

        if not stripe_account_id or not stripe_access_token:
            logger.warning(
                "Stripe not connected",
                user_id=user_id,
                has_account_id=bool(stripe_account_id),
                has_access_token=bool(stripe_access_token)
            )
            return create_error_response(
                400,
                "Stripe account not connected. Please connect your Stripe account in Settings to receive payments.",
                "StripeNotConnected"
            )

        # Verify invoice is not already paid
        invoice_status = invoice.get('status', 'draft')
        if invoice_status == 'paid':
            return create_error_response(
                400,
                "Cannot create payment link for an already paid invoice",
                "InvoiceAlreadyPaid"
            )

        if invoice_status == 'cancelled':
            return create_error_response(
                400,
                "Cannot create payment link for a cancelled invoice",
                "InvoiceCancelled"
            )

        # Create Stripe payment link using the connected account
        payment_link_url = create_stripe_payment_link(
            invoice_data=invoice,
            invoice_id=invoice_id,
            stripe_account_id=stripe_account_id
        )

        # Update invoice with payment link
        update_invoice_payment_link(invoice_id, payment_link_url)

        logger.info(
            "Payment link created successfully",
            invoice_id=invoice_id,
            payment_link_url=payment_link_url
        )

        return create_success_response({
            "invoice_id": invoice_id,
            "payment_link_url": payment_link_url,
            "already_exists": False,
            "message": "Payment link created successfully"
        })

    except StripePaymentError as e:
        logger.error("Stripe payment error", error=str(e))
        return create_error_response(
            500,
            str(e),
            "StripeError"
        )

    except InputValidationError as e:
        logger.warning("Input validation error", error=str(e))
        return create_error_response(400, str(e), "ValidationError")

    except json.JSONDecodeError as e:
        logger.warning("Invalid JSON in request body", error=str(e))
        return create_error_response(400, "Invalid JSON in request body", "ValidationError")

    except ClientError as e:
        logger.error("Database error", error=str(e))
        return create_error_response(500, "Database error occurred", "DatabaseError")

    except Exception as e:
        logger.error("Unexpected error", error=str(e), exc_info=True)
        return create_error_response(500, "An unexpected error occurred", "InternalError")
