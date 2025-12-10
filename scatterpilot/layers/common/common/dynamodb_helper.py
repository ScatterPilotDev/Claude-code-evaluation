"""
DynamoDB helper for CRUD operations with proper error handling
Implements repository pattern for data access abstraction
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

from .models import (
    Conversation, Invoice, RateLimit, InvoiceStatus,
    ConversationState, Message
)
from .logger import get_logger

logger = get_logger("dynamodb_helper")


class DynamoDBException(Exception):
    """Base exception for DynamoDB operations"""
    pass


class ItemNotFoundError(DynamoDBException):
    """Raised when item is not found"""
    pass


class DynamoDBHelper:
    """
    DynamoDB operations helper with automatic retry and error handling
    """

    def __init__(self):
        """Initialize DynamoDB client and table references"""
        self.dynamodb = boto3.resource('dynamodb')

        # Table names from environment variables
        self.conversations_table_name = os.environ.get('CONVERSATIONS_TABLE', 'ScatterPilot-Conversations')
        self.invoices_table_name = os.environ.get('INVOICES_TABLE', 'ScatterPilot-Invoices')
        self.rate_limits_table_name = os.environ.get('RATE_LIMITS_TABLE', 'ScatterPilot-RateLimits')
        self.subscriptions_table_name = os.environ.get('SUBSCRIPTIONS_TABLE', 'ScatterPilot-Subscriptions')

        # Table references
        self.conversations_table = self.dynamodb.Table(self.conversations_table_name)
        self.invoices_table = self.dynamodb.Table(self.invoices_table_name)
        self.rate_limits_table = self.dynamodb.Table(self.rate_limits_table_name)
        self.subscriptions_table = self.dynamodb.Table(self.subscriptions_table_name)

    # ========================
    # Conversation Operations
    # ========================

    def create_conversation(self, conversation: Conversation) -> None:
        """
        Create a new conversation

        Args:
            conversation: Conversation object to create

        Raises:
            DynamoDBException: If creation fails
        """
        try:
            item = conversation.to_dynamodb()
            self.conversations_table.put_item(Item=item)
            logger.info(
                "Conversation created",
                conversation_id=conversation.conversation_id,
                user_id=conversation.user_id
            )
        except ClientError as e:
            logger.error(
                "Failed to create conversation",
                error=e,
                conversation_id=conversation.conversation_id
            )
            raise DynamoDBException(f"Failed to create conversation: {str(e)}")

    def get_conversation(self, conversation_id: str) -> Optional[Conversation]:
        """
        Get conversation by ID

        Args:
            conversation_id: Conversation identifier

        Returns:
            Conversation object or None if not found

        Raises:
            DynamoDBException: If retrieval fails
        """
        try:
            response = self.conversations_table.get_item(
                Key={'conversation_id': conversation_id}
            )

            if 'Item' not in response:
                return None

            item = response['Item']
            return self._item_to_conversation(item)

        except ClientError as e:
            logger.error(
                "Failed to get conversation",
                error=e,
                conversation_id=conversation_id
            )
            raise DynamoDBException(f"Failed to get conversation: {str(e)}")

    def update_conversation(self, conversation: Conversation) -> None:
        """
        Update existing conversation

        Args:
            conversation: Updated conversation object

        Raises:
            DynamoDBException: If update fails
        """
        try:
            conversation.updated_at = datetime.utcnow()
            item = conversation.to_dynamodb()

            self.conversations_table.put_item(Item=item)
            logger.info(
                "Conversation updated",
                conversation_id=conversation.conversation_id
            )

        except ClientError as e:
            logger.error(
                "Failed to update conversation",
                error=e,
                conversation_id=conversation.conversation_id
            )
            raise DynamoDBException(f"Failed to update conversation: {str(e)}")

    def list_user_conversations(
        self,
        user_id: str,
        limit: int = 20,
        last_evaluated_key: Optional[Dict] = None
    ) -> tuple[List[Conversation], Optional[Dict]]:
        """
        List conversations for a user with pagination

        Args:
            user_id: User identifier
            limit: Maximum number of items to return
            last_evaluated_key: Pagination token from previous call

        Returns:
            Tuple of (conversations list, next pagination token)

        Raises:
            DynamoDBException: If query fails
        """
        try:
            query_params = {
                'IndexName': 'UserIdIndex',
                'KeyConditionExpression': 'user_id = :user_id',
                'ExpressionAttributeValues': {':user_id': user_id},
                'Limit': limit,
                'ScanIndexForward': False  # Most recent first
            }

            if last_evaluated_key:
                query_params['ExclusiveStartKey'] = last_evaluated_key

            response = self.conversations_table.query(**query_params)

            conversations = [
                self._item_to_conversation(item)
                for item in response.get('Items', [])
            ]

            next_key = response.get('LastEvaluatedKey')

            return conversations, next_key

        except ClientError as e:
            logger.error("Failed to list conversations", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to list conversations: {str(e)}")

    # ==================
    # Invoice Operations
    # ==================

    def create_invoice(self, invoice: Invoice) -> None:
        """
        Create a new invoice

        Args:
            invoice: Invoice object to create

        Raises:
            DynamoDBException: If creation fails
        """
        try:
            item = invoice.to_dynamodb()
            self.invoices_table.put_item(Item=item)
            logger.info(
                "Invoice created",
                invoice_id=invoice.invoice_id,
                user_id=invoice.user_id
            )
        except ClientError as e:
            logger.error(
                "Failed to create invoice",
                error=e,
                invoice_id=invoice.invoice_id
            )
            raise DynamoDBException(f"Failed to create invoice: {str(e)}")

    def get_invoice(self, invoice_id: str) -> Optional[Invoice]:
        """
        Get invoice by ID

        Args:
            invoice_id: Invoice identifier

        Returns:
            Invoice object or None if not found

        Raises:
            DynamoDBException: If retrieval fails
        """
        try:
            response = self.invoices_table.get_item(
                Key={'invoice_id': invoice_id}
            )

            if 'Item' not in response:
                return None

            item = response['Item']
            return self._item_to_invoice(item)

        except ClientError as e:
            logger.error("Failed to get invoice", error=e, invoice_id=invoice_id)
            raise DynamoDBException(f"Failed to get invoice: {str(e)}")

    def list_user_invoices(
        self,
        user_id: str,
        limit: int = 20,
        last_evaluated_key: Optional[Dict] = None,
        status_filter: Optional[InvoiceStatus] = None
    ) -> tuple[List[Invoice], Optional[Dict]]:
        """
        List invoices for a user with optional status filter

        Args:
            user_id: User identifier
            limit: Maximum number of items to return
            last_evaluated_key: Pagination token
            status_filter: Optional status to filter by

        Returns:
            Tuple of (invoices list, next pagination token)

        Raises:
            DynamoDBException: If query fails
        """
        try:
            query_params = {
                'IndexName': 'UserIdIndex',
                'KeyConditionExpression': 'user_id = :user_id',
                'ExpressionAttributeValues': {':user_id': user_id},
                'Limit': limit,
                'ScanIndexForward': False  # Most recent first
            }

            if status_filter:
                query_params['FilterExpression'] = '#status = :status'
                query_params['ExpressionAttributeNames'] = {'#status': 'status'}
                query_params['ExpressionAttributeValues'][':status'] = status_filter.value

            if last_evaluated_key:
                query_params['ExclusiveStartKey'] = last_evaluated_key

            response = self.invoices_table.query(**query_params)

            invoices = [
                self._item_to_invoice(item)
                for item in response.get('Items', [])
            ]

            next_key = response.get('LastEvaluatedKey')

            return invoices, next_key

        except ClientError as e:
            logger.error("Failed to list invoices", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to list invoices: {str(e)}")

    def update_invoice_status(
        self,
        invoice_id: str,
        status: InvoiceStatus,
        pdf_s3_key: Optional[str] = None
    ) -> None:
        """
        Update invoice status and optionally PDF location

        Args:
            invoice_id: Invoice identifier
            status: New status
            pdf_s3_key: Optional S3 key for generated PDF

        Raises:
            DynamoDBException: If update fails
        """
        try:
            update_expr = "SET #status = :status, updated_at = :updated_at"
            expr_attr_names = {'#status': 'status'}
            expr_attr_values = {
                ':status': status.value,
                ':updated_at': datetime.utcnow().isoformat()
            }

            if pdf_s3_key:
                update_expr += ", pdf_s3_key = :pdf_key"
                expr_attr_values[':pdf_key'] = pdf_s3_key

            self.invoices_table.update_item(
                Key={'invoice_id': invoice_id},
                UpdateExpression=update_expr,
                ExpressionAttributeNames=expr_attr_names,
                ExpressionAttributeValues=expr_attr_values
            )

            logger.info(
                "Invoice status updated",
                invoice_id=invoice_id,
                status=status.value
            )

        except ClientError as e:
            logger.error(
                "Failed to update invoice status",
                error=e,
                invoice_id=invoice_id
            )
            raise DynamoDBException(f"Failed to update invoice status: {str(e)}")

    # =====================
    # Rate Limit Operations
    # =====================

    def get_rate_limit(self, user_id: str) -> Optional[RateLimit]:
        """
        Get rate limit record for user

        Args:
            user_id: User identifier

        Returns:
            RateLimit object or None if not found

        Raises:
            DynamoDBException: If retrieval fails
        """
        try:
            response = self.rate_limits_table.get_item(
                Key={'user_id': user_id}
            )

            if 'Item' not in response:
                return None

            item = response['Item']
            return RateLimit(
                user_id=item['user_id'],
                request_count=int(item['request_count']),
                window_start=datetime.fromisoformat(item['window_start']),
                ttl=int(item['ttl'])
            )

        except ClientError as e:
            logger.error("Failed to get rate limit", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to get rate limit: {str(e)}")

    def update_rate_limit(self, rate_limit: RateLimit) -> None:
        """
        Update or create rate limit record

        Args:
            rate_limit: RateLimit object

        Raises:
            DynamoDBException: If update fails
        """
        try:
            item = rate_limit.to_dynamodb()
            self.rate_limits_table.put_item(Item=item)

        except ClientError as e:
            logger.error(
                "Failed to update rate limit",
                error=e,
                user_id=rate_limit.user_id
            )
            raise DynamoDBException(f"Failed to update rate limit: {str(e)}")

    def increment_rate_limit(self, user_id: str) -> int:
        """
        Atomically increment rate limit counter

        Args:
            user_id: User identifier

        Returns:
            New request count

        Raises:
            DynamoDBException: If increment fails
        """
        try:
            response = self.rate_limits_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='ADD request_count :inc',
                ExpressionAttributeValues={':inc': 1},
                ReturnValues='UPDATED_NEW'
            )

            return int(response['Attributes']['request_count'])

        except ClientError as e:
            logger.error("Failed to increment rate limit", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to increment rate limit: {str(e)}")

    # ======================
    # Subscription Operations
    # ======================

    def get_user_subscription(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get subscription record for user

        Args:
            user_id: User identifier

        Returns:
            Subscription dict or None if not found
        """
        try:
            response = self.subscriptions_table.get_item(
                Key={'user_id': user_id}
            )
            return response.get('Item')
        except ClientError as e:
            logger.error("Failed to get subscription", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to get subscription: {str(e)}")

    def create_or_update_user_subscription(
        self,
        user_id: str,
        stripe_customer_id: Optional[str] = None,
        subscription_id: Optional[str] = None,
        subscription_status: Optional[str] = None,
        current_period_end: Optional[int] = None
    ) -> None:
        """
        Create or update user subscription

        Args:
            user_id: User identifier
            stripe_customer_id: Stripe customer ID
            subscription_id: Stripe subscription ID
            subscription_status: 'free', 'pro', or 'cancelled'
            current_period_end: Unix timestamp of period end
        """
        try:
            # Build update expression dynamically
            update_parts = ['updated_at = :updated_at']
            expr_values = {':updated_at': datetime.utcnow().isoformat()}

            if stripe_customer_id is not None:
                update_parts.append('stripe_customer_id = :customer_id')
                expr_values[':customer_id'] = stripe_customer_id

            if subscription_id is not None:
                update_parts.append('subscription_id = :sub_id')
                expr_values[':sub_id'] = subscription_id
            elif subscription_id == '':
                # Explicitly remove subscription ID
                update_parts.append('subscription_id = :sub_id')
                expr_values[':sub_id'] = None

            if subscription_status is not None:
                update_parts.append('subscription_status = :status')
                expr_values[':status'] = subscription_status

            if current_period_end is not None:
                update_parts.append('current_period_end = :period_end')
                expr_values[':period_end'] = current_period_end

            self.subscriptions_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='SET ' + ', '.join(update_parts),
                ExpressionAttributeValues=expr_values
            )

            logger.info(
                "Subscription updated",
                user_id=user_id,
                status=subscription_status
            )

        except ClientError as e:
            logger.error("Failed to update subscription", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to update subscription: {str(e)}")

    def get_user_by_stripe_customer(self, stripe_customer_id: str) -> Optional[Dict[str, Any]]:
        """
        Find user by Stripe customer ID

        Args:
            stripe_customer_id: Stripe customer ID

        Returns:
            Subscription dict or None
        """
        try:
            response = self.subscriptions_table.query(
                IndexName='StripeCustomerIndex',
                KeyConditionExpression='stripe_customer_id = :customer_id',
                ExpressionAttributeValues={':customer_id': stripe_customer_id},
                Limit=1
            )

            items = response.get('Items', [])
            return items[0] if items else None

        except ClientError as e:
            logger.error("Failed to find user by Stripe customer", error=e)
            raise DynamoDBException(f"Failed to find user: {str(e)}")

    def increment_monthly_invoice_count(self, user_id: str) -> int:
        """
        Increment user's monthly invoice count

        Args:
            user_id: User identifier

        Returns:
            New invoice count
        """
        try:
            response = self.subscriptions_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='SET invoices_this_month = if_not_exists(invoices_this_month, :zero) + :inc, updated_at = :updated_at',
                ExpressionAttributeValues={
                    ':inc': 1,
                    ':zero': 0,
                    ':updated_at': datetime.utcnow().isoformat()
                },
                ReturnValues='UPDATED_NEW'
            )

            return int(response['Attributes'].get('invoices_this_month', 1))

        except ClientError as e:
            logger.error("Failed to increment invoice count", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to increment invoice count: {str(e)}")

    def reset_monthly_invoice_count(self, user_id: str) -> None:
        """
        Reset user's monthly invoice count to 0

        Args:
            user_id: User identifier
        """
        try:
            self.subscriptions_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='SET invoices_this_month = :zero, invoice_count_reset_at = :reset_at, updated_at = :updated_at',
                ExpressionAttributeValues={
                    ':zero': 0,
                    ':reset_at': datetime.utcnow().isoformat(),
                    ':updated_at': datetime.utcnow().isoformat()
                }
            )

            logger.info("Invoice count reset", user_id=user_id)

        except ClientError as e:
            logger.error("Failed to reset invoice count", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to reset invoice count: {str(e)}")

    def update_user_invoice_color(self, user_id: str, invoice_color: str) -> None:
        """
        Update user's invoice color preference (Pro feature)

        Args:
            user_id: User identifier
            invoice_color: Color preference (purple, blue, green, orange, red)

        Raises:
            DynamoDBException: If update fails
        """
        try:
            self.subscriptions_table.update_item(
                Key={'user_id': user_id},
                UpdateExpression='SET invoice_color = :color, updated_at = :updated_at',
                ExpressionAttributeValues={
                    ':color': invoice_color,
                    ':updated_at': datetime.utcnow().isoformat()
                }
            )

            logger.info("Invoice color preference updated", user_id=user_id, color=invoice_color)

        except ClientError as e:
            logger.error("Failed to update invoice color", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to update invoice color: {str(e)}")

    def check_and_reset_monthly_count(self, user_id: str) -> Dict[str, Any]:
        """
        Check if monthly count needs reset (1st of month) and get subscription

        Args:
            user_id: User identifier

        Returns:
            Subscription dict with potentially reset count
        """
        try:
            subscription = self.get_user_subscription(user_id)

            if not subscription:
                # Create default free subscription
                self.subscriptions_table.put_item(
                    Item={
                        'user_id': user_id,
                        'subscription_status': 'free',
                        'invoices_this_month': 0,
                        'invoice_count_reset_at': datetime.utcnow().isoformat(),
                        'created_at': datetime.utcnow().isoformat(),
                        'updated_at': datetime.utcnow().isoformat()
                    }
                )
                return {
                    'user_id': user_id,
                    'subscription_status': 'free',
                    'invoices_this_month': 0
                }

            # Check if we need to reset (1st of month)
            reset_at = subscription.get('invoice_count_reset_at')
            if reset_at:
                reset_date = datetime.fromisoformat(reset_at)
                now = datetime.utcnow()

                # Reset if different month
                if reset_date.month != now.month or reset_date.year != now.year:
                    self.reset_monthly_invoice_count(user_id)
                    subscription['invoices_this_month'] = 0

            return subscription

        except ClientError as e:
            logger.error("Failed to check monthly count", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to check monthly count: {str(e)}")

    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Get user profile data from subscription record

        Args:
            user_id: User identifier

        Returns:
            Profile dict with business info AND subscription info or None if not found
        """
        try:
            subscription = self.get_user_subscription(user_id)
            if not subscription:
                return None

            # Extract profile fields AND subscription fields
            profile = {
                'business_name': subscription.get('business_name'),
                'contact_name': subscription.get('contact_name'),
                'email': subscription.get('email'),
                'phone': subscription.get('phone'),
                'address_line1': subscription.get('address_line1'),
                'address_line2': subscription.get('address_line2'),
                'city': subscription.get('city'),
                'state': subscription.get('state'),
                'zip_code': subscription.get('zip_code'),
                'country': subscription.get('country', 'USA'),
                # CRITICAL FIX: Include subscription fields
                'subscription_status': subscription.get('subscription_status', 'free'),
                'subscription_end_date': subscription.get('subscription_end_date'),
                'invoices_this_month': int(subscription.get('invoices_this_month', 0)),  # Convert Decimal to int
                'invoice_color': subscription.get('invoice_color', 'purple')
            }

            return profile

        except ClientError as e:
            logger.error("Failed to get user profile", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to get user profile: {str(e)}")

    def update_user_profile(
        self,
        user_id: str,
        business_name: Optional[str] = None,
        contact_name: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        address_line1: Optional[str] = None,
        address_line2: Optional[str] = None,
        city: Optional[str] = None,
        state: Optional[str] = None,
        zip_code: Optional[str] = None,
        country: Optional[str] = None
    ) -> None:
        """
        Update user profile information

        Args:
            user_id: User identifier
            business_name: Business/company name (appears on invoices)
            contact_name: Contact person name
            email: Contact email
            phone: Contact phone number
            address_line1: Address line 1
            address_line2: Address line 2
            city: City
            state: State/province
            zip_code: Postal/ZIP code
            country: Country

        Raises:
            DynamoDBException: If update fails
        """
        try:
            # Build update expression dynamically
            update_parts = ['updated_at = :updated_at']
            expr_values = {':updated_at': datetime.utcnow().isoformat()}

            if business_name is not None:
                update_parts.append('business_name = :business_name')
                expr_values[':business_name'] = business_name

            if contact_name is not None:
                update_parts.append('contact_name = :contact_name')
                expr_values[':contact_name'] = contact_name

            if email is not None:
                update_parts.append('email = :email')
                expr_values[':email'] = email

            if phone is not None:
                update_parts.append('phone = :phone')
                expr_values[':phone'] = phone

            if address_line1 is not None:
                update_parts.append('address_line1 = :address_line1')
                expr_values[':address_line1'] = address_line1

            if address_line2 is not None:
                update_parts.append('address_line2 = :address_line2')
                expr_values[':address_line2'] = address_line2

            if city is not None:
                update_parts.append('city = :city')
                expr_values[':city'] = city

            if state is not None:
                update_parts.append('#state = :state')
                expr_values[':state'] = state

            if zip_code is not None:
                update_parts.append('zip_code = :zip_code')
                expr_values[':zip_code'] = zip_code

            if country is not None:
                update_parts.append('country = :country')
                expr_values[':country'] = country

            # Build expression attribute names for reserved words
            expr_names = {}
            if state is not None:
                expr_names['#state'] = 'state'

            update_params = {
                'Key': {'user_id': user_id},
                'UpdateExpression': 'SET ' + ', '.join(update_parts),
                'ExpressionAttributeValues': expr_values
            }

            if expr_names:
                update_params['ExpressionAttributeNames'] = expr_names

            self.subscriptions_table.update_item(**update_params)

            logger.info("User profile updated", user_id=user_id)

        except ClientError as e:
            logger.error("Failed to update user profile", error=e, user_id=user_id)
            raise DynamoDBException(f"Failed to update user profile: {str(e)}")

    # =================
    # Helper Methods
    # =================

    @staticmethod
    def _item_to_conversation(item: Dict[str, Any]) -> Conversation:
        """Convert DynamoDB item to Conversation object"""
        messages = [
            Message(
                role=msg['role'],
                content=msg['content'],
                timestamp=datetime.fromisoformat(msg['timestamp'])
            )
            for msg in item.get('messages', [])
        ]

        return Conversation(
            conversation_id=item['conversation_id'],
            user_id=item['user_id'],
            state=ConversationState(item['state']),
            messages=messages,
            extracted_data=item.get('extracted_data'),
            created_at=datetime.fromisoformat(item['created_at']),
            updated_at=datetime.fromisoformat(item['updated_at'])
        )

    @staticmethod
    def _item_to_invoice(item: Dict[str, Any]) -> Invoice:
        """Convert DynamoDB item to Invoice object"""
        from .models import InvoiceData, LineItem
        from decimal import Decimal
        from datetime import date

        # Parse line items
        line_items = [
            LineItem(
                description=li['description'],
                quantity=Decimal(li['quantity']),
                unit_price=Decimal(li['unit_price'])
            )
            for li in item['data'].get('line_items', [])
        ]

        # Parse invoice data
        invoice_data = InvoiceData(
            customer_name=item['data']['customer_name'],
            customer_email=item['data'].get('customer_email'),
            customer_address=item['data'].get('customer_address'),
            invoice_date=date.fromisoformat(item['data']['invoice_date']),
            due_date=date.fromisoformat(item['data']['due_date']),
            invoice_number=item['data'].get('invoice_number'),
            line_items=line_items,
            tax_rate=Decimal(item['data']['tax_rate']),
            discount=Decimal(item['data'].get('discount', '0')),
            notes=item['data'].get('notes')
        )

        return Invoice(
            invoice_id=item['invoice_id'],
            user_id=item['user_id'],
            conversation_id=item.get('conversation_id'),
            data=invoice_data,
            status=InvoiceStatus(item['status']),
            pdf_s3_key=item.get('pdf_s3_key'),
            created_at=datetime.fromisoformat(item['created_at']),
            updated_at=datetime.fromisoformat(item['updated_at'])
        )


# ======================
# Standalone Helper Functions
# ======================

def get_invoice(user_id: str, invoice_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific invoice for a user (security check included).
    Returns None if invoice doesn't exist or doesn't belong to user.

    Args:
        user_id: User identifier
        invoice_id: Invoice identifier

    Returns:
        Invoice dict or None if not found or unauthorized
    """
    try:
        db_helper = DynamoDBHelper()
        invoice = db_helper.get_invoice(invoice_id)

        # Check if invoice exists and belongs to the user
        if not invoice or invoice.user_id != user_id:
            logger.warning(
                "Invoice not found or unauthorized access attempt",
                user_id=user_id,
                invoice_id=invoice_id
            )
            return None

        # Return the raw dict representation for use in Lambda functions
        return invoice.to_dynamodb()

    except Exception as e:
        logger.error(f"Error getting invoice: {str(e)}")
        return None
